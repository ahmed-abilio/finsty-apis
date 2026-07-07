import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { DecodedIdToken } from 'firebase-admin/auth';
import { firebaseAuth } from '@config/firebase';
import redis from '@config/redis';
import userService from '@modules/user/user.service';
import { AppError } from '@utils/appError';
import { AuthProvider, JwtPayload, TokenPair } from '@types-app/index';
import type User from '@modules/user/user.model';
import { Roles } from '@modules/user/user.model';
import otpService from '@modules/otp/otp.service';

const JWT_SECRET = process.env.JWT_SECRET as string;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN as string;
const REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN as string;

if (!JWT_SECRET || !JWT_EXPIRES_IN || !REFRESH_TOKEN_EXPIRES_IN) {
  throw new Error('JWT_SECRET, JWT_EXPIRES_IN, and REFRESH_TOKEN_EXPIRES_IN environment variables are required');
}

// ─── Single-session store (Redis) ──────────────────────────────────────────────
//
// Exactly one active session is allowed per user. The current session id (sid) is
// stored at `session:{role}:{userId}`; every issued JWT carries that sid. A new
// login overwrites the value, so any previously issued token's sid stops matching
// and is rejected as SESSION_REVOKED.

/** Parse a jsonwebtoken-style duration (e.g. "45m", "7d") into whole seconds. */
function parseDurationToSeconds(duration: string): number {
  const match = /^(\d+)\s*([smhd])$/.exec(duration.trim());
  if (!match) {
    // Fall back to treating the value as raw seconds; default to 7 days.
    const asNumber = parseInt(duration, 10);
    return Number.isFinite(asNumber) && asNumber > 0 ? asNumber : 7 * 24 * 60 * 60;
  }
  const value = parseInt(match[1], 10);
  const unitSeconds: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
  return value * unitSeconds[match[2]];
}

const SESSION_TTL_SECONDS = parseDurationToSeconds(REFRESH_TOKEN_EXPIRES_IN);

function sessionKey(role: string, userId: string): string {
  return `session:${role}:${userId}`;
}

export async function setActiveSession(role: string, userId: string, sid: string): Promise<void> {
  await redis.set(sessionKey(role, userId), sid, 'EX', SESSION_TTL_SECONDS);
}

export async function getActiveSession(role: string, userId: string): Promise<string | null> {
  return redis.get(sessionKey(role, userId));
}

export async function clearActiveSession(role: string, userId: string): Promise<void> {
  await redis.del(sessionKey(role, userId));
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// ─── Core Firebase token verification (used by Google / Apple flows only) ────

/**
 * Verifies a Firebase ID token and returns the decoded claims.
 * Throws AppError(401) on any failure so callers don't handle Firebase errors directly.
 */
export async function verifyFirebaseToken(idToken: string): Promise<DecodedIdToken> {
  try {
    console.log('Firebase token:', idToken);
    return await firebaseAuth.verifyIdToken(idToken, true /* check revoked */);
  } catch (err) {
    const error = err as Error & { errorInfo?: { code: string } };
    const code = error.errorInfo?.code ?? '';

    if (
      code.includes('id-token-expired') ||
      code.includes('id-token-revoked') ||
      code.includes('invalid-id-token') ||
      code.includes('argument-error')
    ) {
      throw AppError.unauthorized('Firebase token is invalid or expired', 'INVALID_FIREBASE_TOKEN');
    }

    throw AppError.internal('Firebase token verification failed', 'FIREBASE_ERROR');
  }
}

// ─── Phone OTP flow (no Firebase — third-party provider to be wired later) ───

export async function sendOtp(phone: string): Promise<void> {
  await otpService.sendPhoneOtp(phone);
}

export async function createAdmin(phone: string, superKey: string): Promise<User> {
  const configuredKey = process.env.SUPER_KEY;
  if (!configuredKey) {
    throw AppError.internal('SUPER_KEY is not configured', 'SUPER_KEY_NOT_CONFIGURED');
  }
  if (!superKey || superKey !== configuredKey) {
    throw AppError.unauthorized('Invalid super key', 'INVALID_SUPER_KEY');
  }

  const existing = await userService.findByPhoneForRole(phone, { role: Roles.ADMIN });
  if (existing) {
    throw AppError.conflict(
      'An admin account already exists for this phone number',
      'ADMIN_ALREADY_EXISTS',
    );
  }

  const [user] = await userService.upsertForRole(
    {
      firebaseUid: phone,
      phone,
      provider: 'phone',
      role: Roles.ADMIN,
      isActive: true,
    },
    { role: Roles.ADMIN },
  );

  return user;
}

export async function verifyOtp(
  phone: string,
  otp: string,
  ipAddress?: string | null,
  referralCode?: string | null,
  requiredRole?: 'admin' | 'vendor' | 'user',
): Promise<{ tokens: TokenPair; user: User; isNew: boolean }> {
  try {
    await otpService.verifyPhoneOtp(phone, otp);
  } catch (error) {
    if (error instanceof AppError) {
      throw AppError.unauthorized('Invalid or expired OTP', 'INVALID_OTP');
    }
    throw error;
  }

  // ─── Role-specific endpoints (Admin / Vendor) ──────────────────────────────
  if (requiredRole) {
    const existingUser = await userService.findByPhoneForRole(phone, {
      role: requiredRole as Roles,
    });

    if (existingUser) {
      const isActive =
        existingUser.isActive ??
        (existingUser as { dataValues?: { isActive?: boolean; is_active?: boolean } }).dataValues
          ?.isActive ??
        (existingUser as { dataValues?: { is_active?: boolean } }).dataValues?.is_active;
      if (isActive === false) {
        throw AppError.forbidden('Account is deactivated', 'ACCOUNT_DEACTIVATED');
      }
      await existingUser.update({ ipAddress: ipAddress ?? null });
      await existingUser.reload();
      const tokens = await issueTokenPair(existingUser);
      return { tokens, user: existingUser, isNew: false };
    }

    // Vendors may self-register: first OTP verify creates vendor_users row (store onboarding is separate).
    if (requiredRole === Roles.VENDOR) {
      const [user, isNew] = await userService.upsertForRole({
        firebaseUid: phone,
        phone,
        provider: 'phone',
        role: Roles.VENDOR,
        ipAddress: ipAddress ?? null,
        isActive: true,
      });
      const tokens = await issueTokenPair(user);
      return { tokens, user, isNew };
    }

    throw AppError.forbidden(
      'No admin account exists for this phone number',
      'ADMIN_NOT_FOUND',
    );
  }

  // ─── Generic customer endpoint ─────────────────────────────────────────────
  const [user, isNew] = await userService.upsertForRole({
    firebaseUid: phone,
    phone,
    provider: 'phone',
    role: Roles.USER,
    ipAddress: ipAddress ?? null,
    referralCode: referralCode ?? null,
  });

  const tokens = await issueTokenPair(user);
  return { tokens, user, isNew };
}

// ─── JWT helpers ─────────────────────────────────────────────────────────────

export function signAccessToken(payload: JwtPayload): string {
  // `type` distinguishes this from a refresh token so the two are never
  // identical and cannot be used interchangeably.
  return jwt.sign({ ...payload, type: 'access' }, JWT_SECRET as string, {
    expiresIn: JWT_EXPIRES_IN,
    issuer: 'finsty-api',
    audience: 'finsty-client',
  } as jwt.SignOptions);
}

export function signRefreshToken(payload: JwtPayload): string {
  return jwt.sign({ ...payload, type: 'refresh' }, JWT_SECRET as string, {
    expiresIn: REFRESH_TOKEN_EXPIRES_IN,
    issuer: 'finsty-api',
    audience: 'finsty-client',
  } as jwt.SignOptions);
}

export function verifyAccessToken(token: string): JwtPayload {
  try {
    const decoded = jwt.verify(token, JWT_SECRET as string, {
      issuer: 'finsty-api',
      audience: 'finsty-client',
    }) as JwtPayload;
    // Reject refresh tokens presented as access tokens.
    if (decoded.type !== 'access') {
      throw AppError.unauthorized('Access token is invalid or expired', 'INVALID_ACCESS_TOKEN');
    }
    return decoded;
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw AppError.unauthorized('Access token is invalid or expired', 'INVALID_ACCESS_TOKEN');
  }
}

export function verifyRefreshToken(token: string): JwtPayload {
  try {
    const decoded = jwt.verify(token, JWT_SECRET as string, {
      issuer: 'finsty-api',
      audience: 'finsty-client',
    }) as JwtPayload;
    // Reject access tokens presented as refresh tokens.
    if (decoded.type !== 'refresh') {
      throw AppError.unauthorized('Refresh token is invalid or expired', 'INVALID_REFRESH_TOKEN');
    }
    return decoded;
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw AppError.unauthorized('Refresh token is invalid or expired', 'INVALID_REFRESH_TOKEN');
  }
}

export async function issueTokenPair(user: User, existingSessionId?: string): Promise<TokenPair> {
  const raw = (user as any).dataValues || {};

  // Login (no existing sid) mints a fresh session and evicts the previous one.
  // Refresh passes the validated sid so the same session continues (TTL reset).
  const sid = existingSessionId ?? randomUUID();

  const payload: JwtPayload = {
    sub: user.id || raw.id || '',
    uid: user.firebaseUid || raw.firebaseUid || raw.firebase_uid || '',
    provider: user.provider || raw.provider || 'phone',
    role: user.role || raw.role || 'user',
    sid,
  };

  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  await setActiveSession(payload.role, payload.sub, sid);

  return { accessToken, refreshToken };
}

// ─── Auth flows ───────────────────────────────────────────────────────────────

async function handleFirebaseAuth(
  idToken: string,
  expectedProvider: AuthProvider,
  ipAddress?: string | null,
  referralCode?: string | null,
  requiredRole?: 'admin' | 'vendor' | 'user',
): Promise<{ tokens: TokenPair; user: User; isNew: boolean }> {
  const decoded = await verifyFirebaseToken(idToken);

  // Validate provider matches sign-in method
  const signInMethod = decoded.firebase?.sign_in_provider ?? '';

  if (expectedProvider === 'phone' && signInMethod !== 'phone') {
    throw AppError.unauthorized('Token was not issued by phone auth', 'PROVIDER_MISMATCH');
  }
  if (expectedProvider === 'google' && signInMethod !== 'google.com') {
    throw AppError.unauthorized('Token was not issued by Google auth', 'PROVIDER_MISMATCH');
  }
  if (expectedProvider === 'apple' && signInMethod !== 'apple.com') {
    throw AppError.unauthorized('Token was not issued by Apple auth', 'PROVIDER_MISMATCH');
  }

  if ((expectedProvider === 'google' || expectedProvider === 'apple') && requiredRole && requiredRole !== Roles.USER) {
    throw AppError.forbidden('Google and Apple auth are only allowed for user role', 'SOCIAL_AUTH_ROLE_NOT_ALLOWED');
  }

  const targetRole = (requiredRole as Roles | undefined) ?? Roles.USER;

  if (requiredRole) {
    const existingUser = await userService.findByFirebaseUidForRole(decoded.uid, {
      role: targetRole,
    });

    if (existingUser) {
      await existingUser.update({ ipAddress: ipAddress ?? null });
      await existingUser.reload();
      const tokens = await issueTokenPair(existingUser);
      return { tokens, user: existingUser, isNew: false };
    }

    // New user — create with the requiredRole
    const [newUser] = await userService.upsertForRole({
      firebaseUid: decoded.uid,
      phone: decoded.phone_number ?? null,
      email: decoded.email ?? null,
      provider: expectedProvider,
      role: targetRole,
      ipAddress: ipAddress ?? null,
      referralCode: referralCode ?? null,
      isActive: targetRole === Roles.VENDOR ? false : true,
    });

    const tokens = await issueTokenPair(newUser);
    return { tokens, user: newUser, isNew: true };
  }

  // Generic (customer) flow — no role restriction
  const [user, isNew] = await userService.upsertForRole({
    firebaseUid: decoded.uid,
    phone: decoded.phone_number ?? null,
    email: decoded.email ?? null,
    provider: expectedProvider,
    role: Roles.USER,
    ipAddress: ipAddress ?? null,
    referralCode: referralCode ?? null,
  });

  const tokens = await issueTokenPair(user);

  return { tokens, user, isNew };
}

export async function googleSignIn(idToken: string, ipAddress?: string | null, referralCode?: string | null, requiredRole?: 'admin' | 'vendor' | 'user') {
  return handleFirebaseAuth(idToken, 'google', ipAddress, referralCode, requiredRole ?? Roles.USER);
}

export async function appleSignIn(idToken: string, ipAddress?: string | null, referralCode?: string | null, requiredRole?: 'admin' | 'vendor' | 'user') {
  return handleFirebaseAuth(idToken, 'apple', ipAddress, referralCode, requiredRole ?? Roles.USER);
}

// ─── Refresh token flow ───────────────────────────────────────────────────────

export async function refreshAccessToken(
  refreshToken: string,
): Promise<{ tokens: TokenPair; userId: string; role: Roles }> {
  // 1. Verify the JWT signature and expiry
  const payload = verifyRefreshToken(refreshToken);
  const role = payload.role as Roles;

  // 2. Ensure this refresh token belongs to the currently active session.
  const activeSid = await getActiveSession(payload.role, payload.sub);
  if (!activeSid || activeSid !== payload.sid) {
    throw AppError.unauthorized('Session superseded by another login', 'SESSION_REVOKED');
  }

  const user = await userService.findByIdForRole(payload.sub, {
    role,
  });
  const isActive = user.isActive ?? (user as any).dataValues?.isActive ?? (user as any).dataValues?.is_active;

  if (isActive === false) {
    throw AppError.unauthorized('Account is deactivated', 'ACCOUNT_DEACTIVATED');
  }

  const userId = user.id ?? (user as { dataValues?: { id?: string } }).dataValues?.id;
  if (!userId) {
    throw AppError.internal('Could not resolve user id from refresh token', 'REFRESH_FAILED');
  }

  // Reissue with the same sid so the session continues (and its TTL is refreshed).
  const tokens = await issueTokenPair(user, payload.sid);
  return { tokens, userId, role };
}

// ─── Logout ───────────────────────────────────────────────────────────────────

export async function logout(refreshToken: string): Promise<void> {
  try {
    const payload = verifyRefreshToken(refreshToken);
    // Only clear if this token owns the active session, so a stale logout can't
    // wipe a session created by a newer login.
    const activeSid = await getActiveSession(payload.role, payload.sub);
    if (activeSid && activeSid === payload.sid) {
      await clearActiveSession(payload.role, payload.sub);
    }
  } catch {
    // Invalid/expired refresh token — nothing to revoke.
  }
}
