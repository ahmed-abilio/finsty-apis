import jwt from 'jsonwebtoken';
import { DecodedIdToken } from 'firebase-admin/auth';
import { firebaseAuth } from '@config/firebase';
import redis from '@config/redis';
import userService from '@modules/user/user.service';
import { AppError } from '@utils/appError';
import { AuthProvider, JwtPayload, TokenPair } from '@types-app/index';
import type User from '@modules/user/user.model';

// TODO: replace with third-party OTP provider (e.g. Twilio, Termii)
const DEFAULT_OTP = '1234';
const OTP_TTL_SECONDS = 300; // 5 minutes

const JWT_SECRET = process.env.JWT_SECRET as string;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN as string;
const REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN as string;

if (!JWT_SECRET || !JWT_EXPIRES_IN || !REFRESH_TOKEN_EXPIRES_IN) {
  throw new Error('JWT_SECRET, JWT_EXPIRES_IN, and REFRESH_TOKEN_EXPIRES_IN environment variables are required');
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

function otpRedisKey(phone: string): string {
  return `otp:${phone}`;
}

export async function sendOtp(phone: string): Promise<void> {
  await redis.set(otpRedisKey(phone), DEFAULT_OTP, 'EX', OTP_TTL_SECONDS);
  // TODO: trigger real SMS delivery via third-party provider here
}

export async function verifyOtp(
  phone: string,
  otp: string,
  ipAddress?: string | null,
  referralCode?: string | null,
  requiredRole?: 'admin' | 'vendor' | 'user',
): Promise<{ tokens: TokenPair; user: User; isNew: boolean }> {
  const key = otpRedisKey(phone);
  const stored = await redis.get(key);

  if (!stored || stored !== otp) {
    throw AppError.unauthorized('Invalid or expired OTP', 'INVALID_OTP');
  }

  // One-time use — delete immediately after successful verification
  await redis.del(key);

  // ─── Role-specific endpoints (Admin / Vendor) ──────────────────────────────
  if (requiredRole) {
    const existingUser = await userService.findByPhone(phone);

    if (existingUser) {
      // User exists — validate their role strictly
      const existingRole = existingUser.role || (existingUser as any).dataValues?.role;

      if (existingRole !== requiredRole) {
        throw AppError.forbidden(
          `Access denied: this phone is already registered as a ${existingRole}`,
          'ACCESS_DENIED',
        );
      }

      // Role matches — issue tokens and return
      await existingUser.update({ ipAddress: ipAddress ?? null });
      await existingUser.reload();
      const tokens = await issueTokenPair(existingUser);
      return { tokens, user: existingUser, isNew: false };
    }

    // User doesn't exist — create with the requiredRole
    const [newUser] = await userService.upsert({
      firebaseUid: phone,
      phone,
      provider: 'phone',
      role: requiredRole as any,
      ipAddress: ipAddress ?? null,
      referralCode: referralCode ?? null,
      isActive: requiredRole === 'vendor' ? false : true,
    });

    const tokens = await issueTokenPair(newUser);
    return { tokens, user: newUser, isNew: true };
  }

  // ─── Generic customer endpoint ─────────────────────────────────────────────
  const [user, isNew] = await userService.upsert({
    firebaseUid: phone,
    phone,
    provider: 'phone',
    ipAddress: ipAddress ?? null,
    referralCode: referralCode ?? null,
  });

  const tokens = await issueTokenPair(user);
  return { tokens, user, isNew };
}

// ─── JWT helpers ─────────────────────────────────────────────────────────────

export function signAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET as string, {
    expiresIn: JWT_EXPIRES_IN,
    issuer: 'finsty-api',
    audience: 'finsty-client',
  } as jwt.SignOptions);
}

export function signRefreshToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET as string, {
    expiresIn: REFRESH_TOKEN_EXPIRES_IN,
    issuer: 'finsty-api',
    audience: 'finsty-client',
  } as jwt.SignOptions);
}

export function verifyAccessToken(token: string): JwtPayload {
  try {
    return jwt.verify(token, JWT_SECRET as string, {
      issuer: 'finsty-api',
      audience: 'finsty-client',
    }) as JwtPayload;
  } catch {
    throw AppError.unauthorized('Access token is invalid or expired', 'INVALID_ACCESS_TOKEN');
  }
}

export function verifyRefreshToken(token: string): JwtPayload {
  try {
    return jwt.verify(token, JWT_SECRET as string, {
      issuer: 'finsty-api',
      audience: 'finsty-client',
    }) as JwtPayload;
  } catch {
    throw AppError.unauthorized('Refresh token is invalid or expired', 'INVALID_REFRESH_TOKEN');
  }
}

export async function issueTokenPair(user: User): Promise<TokenPair> {
  const raw = (user as any).dataValues || {};
  console.log('DEBUG: issueTokenPair raw dataValues:', JSON.stringify(raw, null, 2));

  const payload: JwtPayload = {
    sub: user.id || raw.id || '',
    uid: user.firebaseUid || raw.firebaseUid || raw.firebase_uid || '',
    provider: user.provider || raw.provider || 'phone',
    role: user.role || raw.role || 'user',
  };

  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

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

  if (requiredRole) {
    // Check if user already exists in DB
    const existingUser = await userService.findByFirebaseUid(decoded.uid);

    if (existingUser) {
      // User exists — strictly validate role
      const existingRole = existingUser.role || (existingUser as any).dataValues?.role;

      if (existingRole !== requiredRole) {
        throw AppError.forbidden(
          `Access denied: this account is already registered as a ${existingRole}`,
          'ACCESS_DENIED',
        );
      }

      // Role matches — update IP and issue tokens
      await existingUser.update({ ipAddress: ipAddress ?? null });
      await existingUser.reload();
      const tokens = await issueTokenPair(existingUser);
      return { tokens, user: existingUser, isNew: false };
    }

    // New user — create with the requiredRole
    const [newUser] = await userService.upsert({
      firebaseUid: decoded.uid,
      phone: decoded.phone_number ?? null,
      email: decoded.email ?? null,
      provider: expectedProvider,
      role: requiredRole as any,
      ipAddress: ipAddress ?? null,
      referralCode: referralCode ?? null,
      isActive: requiredRole === 'vendor' ? false : true,
    });

    const tokens = await issueTokenPair(newUser);
    return { tokens, user: newUser, isNew: true };
  }

  // Generic (customer) flow — no role restriction
  const [user, isNew] = await userService.upsert({
    firebaseUid: decoded.uid,
    phone: decoded.phone_number ?? null,
    email: decoded.email ?? null,
    provider: expectedProvider,
    ipAddress: ipAddress ?? null,
    referralCode: referralCode ?? null,
  });

  const tokens = await issueTokenPair(user);

  return { tokens, user, isNew };
}

export async function googleSignIn(idToken: string, ipAddress?: string | null, referralCode?: string | null, requiredRole?: 'admin' | 'vendor' | 'user') {
  return handleFirebaseAuth(idToken, 'google', ipAddress, referralCode, requiredRole);
}

export async function appleSignIn(idToken: string, ipAddress?: string | null, referralCode?: string | null, requiredRole?: 'admin' | 'vendor' | 'user') {
  return handleFirebaseAuth(idToken, 'apple', ipAddress, referralCode, requiredRole);
}

// ─── Refresh token flow ───────────────────────────────────────────────────────

export async function refreshAccessToken(refreshToken: string): Promise<TokenPair> {
  // 1. Verify the JWT signature and expiry
  const payload = verifyRefreshToken(refreshToken);

  const user = await userService.findById(payload.sub);
  const isActive = user.isActive ?? (user as any).dataValues?.isActive ?? (user as any).dataValues?.is_active;

  if (isActive === false) {
    throw AppError.unauthorized('Account is deactivated', 'ACCOUNT_DEACTIVATED');
  }

  return issueTokenPair(user);
}

// ─── Logout ───────────────────────────────────────────────────────────────────

export async function logout(_refreshToken: string): Promise<void> {
}
