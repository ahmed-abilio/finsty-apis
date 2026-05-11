import crypto from 'crypto';
import User, { Roles, UserCreationAttributes } from './user.model';
import { AppError } from '@utils/appError';
import { AuthProvider } from '@types-app/index';

export interface UpsertUserInput {
  firebaseUid: string;
  phone?: string | null;
  email?: string | null;
  provider: AuthProvider;
  role?: Roles;
  ipAddress?: string | null;
  referralCode?: string | null;
  isActive?: boolean;
}

function generateReferralCode(): string {
  return crypto.randomBytes(5).toString('hex').toUpperCase(); // 10-char hex
}

export interface UpdateUserInput {
  name?: string;
  profileImage?: string;
}

class UserService {
  /**
   * Find an existing user or create a new one based on firebaseUid.
   * Returns [user, wasCreated].
   */
  async upsert(input: UpsertUserInput): Promise<[User, boolean]> {
    // Resolve referrer before creating the user
    let referredById: string | null = null;
    if (input.referralCode) {
      const referrer = await User.findOne({ where: { referralCode: input.referralCode } });
      if (referrer) {
        referredById = referrer.id;
      }
      // Silently ignore invalid referral codes
    }

    let result: [User, boolean];
    try {
      result = await User.findOrCreate({
        where: { firebaseUid: input.firebaseUid },
        defaults: {
          firebaseUid: input.firebaseUid,
          phone: input.phone ?? null,
          email: input.email ?? null,
          provider: input.provider,
          role: input.role || Roles.USER,
          isActive: input.isActive ?? true,
          ipAddress: input.ipAddress ?? null,
          referralCode: generateReferralCode(),
          referredById,
        } as UserCreationAttributes,
      });
    } catch (err: any) {
      console.error('DATABASE ERROR in UserService.upsert:', {
        message: err.message,
        original: err.original?.message,
        detail: err.original?.detail,
        input: { ...input, firebaseUid: 'REDACTED' }
      });
      throw err;
    }

    const [user, created] = result;

    // If user exists but signs in with updated data, sync non-null fields
    if (!created) {
      const updates: Partial<{ email: string; phone: string; ipAddress: string | null }> = {};

      if (input.email && !user.email) updates.email = input.email;
      if (input.phone && !user.phone) updates.phone = input.phone;
      // Always update IP address on every login
      if (input.ipAddress !== undefined) updates.ipAddress = input.ipAddress ?? null;

      if (Object.keys(updates).length > 0) {
        await user.update(updates);
      }
    }

    // Always reload so DB-generated fields (id, role, createdAt, updatedAt)
    // are fully hydrated on the instance — critical for JWT signing & toPublicJSON()
    await user.reload();

    return [user, created];
  }

  async findById(id: string): Promise<User> {
    const user = await User.findByPk(id);
    if (!user) throw AppError.notFound('User not found');
    return user;
  }

  async findByFirebaseUid(firebaseUid: string): Promise<User | null> {
    return User.findOne({ where: { firebaseUid } });
  }

  async findByPhone(phone: string): Promise<User | null> {
    return User.findOne({ where: { phone } });
  }

  async update(id: string, input: UpdateUserInput): Promise<User> {
    const user = await this.findById(id);

    const updates: Partial<{ name: string | null; profileImage: string | null }> = {};
    if (input.name !== undefined) updates.name = input.name;
    if (input.profileImage !== undefined) updates.profileImage = input.profileImage;

    if (Object.keys(updates).length > 0) {
      await user.update(updates);
    }

    return user;
  }

  async updateAvatar(id: string, profileImageUrl: string): Promise<User> {
    const user = await this.findById(id);
    await user.update({ profileImage: profileImageUrl });
    return user;
  }

  /**
   * Soft-delete: mark isActive = false instead of destroying the row.
   */
  async deactivate(id: string): Promise<void> {
    const user = await this.findById(id);
    await user.update({ isActive: false });
  }

  async validateReferralCode(code: string): Promise<{ name: string | null } | null> {
    const user = await User.findOne({ where: { referralCode: code } });
    if (!user) return null;
    return { name: user.name ?? null };
  }
}

export default new UserService();
