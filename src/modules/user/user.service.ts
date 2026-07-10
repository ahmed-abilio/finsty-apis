import crypto from 'crypto';
import { Op, QueryTypes, WhereOptions } from 'sequelize';
import { Transaction } from 'sequelize';
import sequelize from '@config/database';
import User, { Roles, UserCreationAttributes } from './user.model';
import { getRoleUserModel, RoleUserCreationAttributes } from './role-user.model';
import { AppError } from '@utils/appError';
import { AuthProvider } from '@types-app/index';
import logger from '@utils/logger';
import { normalizeRangeEnd, normalizeRangeStart } from '@modules/dashboard/dashboard.utils';

export interface AdminUserListFilters {
  page?: number;
  limit?: number;
  role?: Roles;
  isActive?: boolean;
  search?: string;
  email?: string;
  from?: string;
  to?: string;
}

export interface AdminUserSummary {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  role: string;
  isActive: boolean;
  provider: string;
  profileImage: string | null;
  createdAt: string;
  updatedAt: string;
}

function formatAdminUserSummary(user: User): AdminUserSummary {
  const json = user.toPublicJSON();
  return {
    id: json.id,
    name: json.name ?? null,
    phone: json.phone ?? null,
    email: json.email ?? null,
    role: String(json.role),
    isActive: Boolean(json.isActive),
    provider: String(json.provider ?? 'phone'),
    profileImage: json.profileImage ?? null,
    createdAt: json.createdAt ?? '',
    updatedAt: json.updatedAt ?? '',
  };
}

function buildUserWhere(filters: AdminUserListFilters): WhereOptions {
  const where: WhereOptions = {};

  if (filters.isActive !== undefined) {
    where.isActive = filters.isActive;
  }

  if (filters.from || filters.to) {
    where.createdAt = {
      ...(filters.from ? { [Op.gte]: normalizeRangeStart(filters.from) } : {}),
      ...(filters.to ? { [Op.lte]: normalizeRangeEnd(filters.to) } : {}),
    };
  }

  if (filters.email?.trim()) {
    (where as Record<string, unknown>).email = {
      [Op.iLike]: `%${filters.email.trim()}%`,
    };
  }

  if (filters.search?.trim()) {
    const term = `%${filters.search.trim()}%`;
    const searchOr = {
      [Op.or]: [
        { name: { [Op.iLike]: term } },
        { phone: { [Op.iLike]: term } },
      ],
    };
    return Object.keys(where).length > 0 ? { [Op.and]: [where, searchOr] } : searchOr;
  }

  return where;
}

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

export interface AuthLookupOptions {
  role?: Roles;
}

function generateReferralCode(): string {
  return crypto.randomBytes(5).toString('hex').toUpperCase(); // 10-char hex
}

export interface UpdateUserInput {
  name?: string;
  profileImage?: string;
}

class UserService {
  private resolveRole(role?: Roles): Roles {
    return role ?? Roles.USER;
  }

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

  async upsertForRole(input: UpsertUserInput, options: AuthLookupOptions = {}): Promise<[User, boolean]> {
    const role = this.resolveRole(options.role ?? input.role);
    const RoleModel = getRoleUserModel(role);

    let referredById: string | null = null;
    if (input.referralCode) {
      const referrer = await User.findOne({ where: { referralCode: input.referralCode } });
      if (referrer) {
        referredById = referrer.id;
      }
    }

    const [roleUser, created] = await RoleModel.findOrCreate({
      where: { firebaseUid: input.firebaseUid },
      defaults: {
        firebaseUid: input.firebaseUid,
        phone: input.phone ?? null,
        email: input.email ?? null,
        provider: input.provider,
        role,
        isActive: input.isActive ?? true,
        ipAddress: input.ipAddress ?? null,
        referralCode: generateReferralCode(),
        referredById,
      } as RoleUserCreationAttributes,
    });

    if (!created) {
      const updates: Partial<{ email: string; phone: string; ipAddress: string | null }> = {};
      if (input.email && !roleUser.email) updates.email = input.email;
      if (input.phone && !roleUser.phone) updates.phone = input.phone;
      if (input.ipAddress !== undefined) updates.ipAddress = input.ipAddress ?? null;
      if (Object.keys(updates).length > 0) {
        await roleUser.update(updates);
      }
    }

    await roleUser.reload();
    return [roleUser as unknown as User, created];
  }

  async findByPhoneForRole(phone: string, options: AuthLookupOptions = {}): Promise<User | null> {
    const role = this.resolveRole(options.role);
    const RoleModel = getRoleUserModel(role);
    const roleUser = await RoleModel.findOne({ where: { phone } });
    if (roleUser) return roleUser as unknown as User;

    return null;
  }

  async findByFirebaseUidForRole(firebaseUid: string, options: AuthLookupOptions = {}): Promise<User | null> {
    const role = this.resolveRole(options.role);
    const RoleModel = getRoleUserModel(role);
    const roleUser = await RoleModel.findOne({ where: { firebaseUid } });
    if (roleUser) return roleUser as unknown as User;

    return null;
  }

  async findByIdForRole(id: string, options: AuthLookupOptions = {}): Promise<User> {
    const role = this.resolveRole(options.role);
    const RoleModel = getRoleUserModel(role);
    const roleUser = await RoleModel.findByPk(id);
    if (roleUser) return roleUser as unknown as User;

    throw AppError.notFound('User not found');
  }

  async findById(id: string): Promise<User> {
    const user = await User.findByPk(id);
    if (!user) throw AppError.notFound('User not found');
    return user;
  }

  /** Store owners may live in vendor_users, users, or admin_users after the role split. */
  async findStoreOwnerById(id: string): Promise<User | null> {
    for (const role of [Roles.VENDOR, Roles.USER, Roles.ADMIN]) {
      const RoleModel = getRoleUserModel(role);
      const row = await RoleModel.findByPk(id);
      if (row) return row as unknown as User;
    }
    return null;
  }

  async findByFirebaseUid(firebaseUid: string): Promise<User | null> {
    return User.findOne({ where: { firebaseUid } });
  }

  async findByPhone(phone: string): Promise<User | null> {
    return User.findOne({ where: { phone } });
  }

  async update(id: string, input: UpdateUserInput, role: Roles = Roles.USER): Promise<User> {
    const user = await this.findByIdForRole(id, { role });

    const updates: Partial<{ name: string | null; profileImage: string | null }> = {};
    if (input.name !== undefined) updates.name = input.name;
    if (input.profileImage !== undefined) updates.profileImage = input.profileImage;

    if (Object.keys(updates).length > 0) {
      await user.update(updates);
    }

    return user;
  }

  async updateAvatar(id: string, profileImageUrl: string, role: Roles = Roles.USER): Promise<User> {
    const user = await this.findByIdForRole(id, { role });
    await user.update({ profileImage: profileImageUrl });
    return user;
  }

  /**
   * Soft-delete: mark isActive = false instead of destroying the row.
   */
  async deactivate(id: string, role: Roles = Roles.USER): Promise<void> {
    const user = await this.findByIdForRole(id, { role });
    await user.update({ isActive: false });
  }

  /** Sync isActive on the store owner across role-specific user tables. */
  async setStoreOwnerActive(
    id: string,
    isActive: boolean,
    transaction?: Transaction,
  ): Promise<void> {
    for (const role of [Roles.VENDOR, Roles.USER, Roles.ADMIN]) {
      const RoleModel = getRoleUserModel(role);
      const row = await RoleModel.findByPk(id, {
        transaction,
        ...(transaction ? { lock: transaction.LOCK.UPDATE } : {}),
      });
      if (row) {
        await row.update({ isActive }, { transaction });
        return;
      }
    }
    logger.warn({ ownerId: id, isActive }, 'Store owner not found while syncing isActive');
  }

  async validateReferralCode(code: string): Promise<{ name: string | null } | null> {
    const user = await User.findOne({ where: { referralCode: code } });
    if (!user) return null;
    return { name: user.name ?? null };
  }

  async findIdsByEmail(email: string): Promise<string[]> {
    const term = `%${email.trim()}%`;
    const rows = await sequelize.query<{ id: string }>(
      `SELECT id FROM (
        SELECT id, email FROM user_users
        UNION ALL
        SELECT id, email FROM vendor_users
        UNION ALL
        SELECT id, email FROM admin_users
      ) AS all_users
      WHERE email ILIKE :term`,
      { replacements: { term }, type: QueryTypes.SELECT },
    );
    return rows.map((row) => row.id);
  }

  async listForAdmin(filters: AdminUserListFilters = {}) {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
    const offset = (page - 1) * limit;

    if (filters.role) {
      const RoleModel = getRoleUserModel(filters.role);
      const where = buildUserWhere(filters);
      const { count, rows } = await RoleModel.findAndCountAll({
        where,
        order: [['createdAt', 'DESC']],
        limit,
        offset,
      });

      return {
        users: rows.map((row) => formatAdminUserSummary(row as unknown as User)),
        pagination: {
          total: count,
          page,
          limit,
          totalPages: Math.ceil(count / limit) || 1,
        },
      };
    }

    const conditions: string[] = [];
    const replacements: Record<string, unknown> = { limit, offset };

    if (filters.isActive !== undefined) {
      conditions.push('is_active = :isActive');
      replacements.isActive = filters.isActive;
    }
    if (filters.from) {
      conditions.push('created_at >= :from');
      replacements.from = normalizeRangeStart(filters.from);
    }
    if (filters.to) {
      conditions.push('created_at <= :to');
      replacements.to = normalizeRangeEnd(filters.to);
    }
    if (filters.email?.trim()) {
      conditions.push('email ILIKE :email');
      replacements.email = `%${filters.email.trim()}%`;
    }
    if (filters.search?.trim()) {
      conditions.push('(name ILIKE :search OR phone ILIKE :search)');
      replacements.search = `%${filters.search.trim()}%`;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const unionSql = `
      SELECT id, name, phone, email, role, is_active, provider, profile_image, created_at, updated_at
      FROM (
        SELECT id, name, phone, email, 'user'::text AS role, is_active, provider::text AS provider, profile_image, "createdAt" AS created_at, "updatedAt" AS updated_at
        FROM user_users
        UNION ALL
        SELECT id, name, phone, email, 'vendor'::text, is_active, provider::text AS provider, profile_image, "createdAt" AS created_at, "updatedAt" AS updated_at
        FROM vendor_users
        UNION ALL
        SELECT id, name, phone, email, 'admin'::text, is_active, provider::text AS provider, profile_image, "createdAt" AS created_at, "updatedAt" AS updated_at
        FROM admin_users
      ) AS all_users
      ${whereClause}
    `;

    const countRows = await sequelize.query<{ count: string }>(
      `SELECT COUNT(*)::int AS count FROM (${unionSql}) AS counted`,
      { replacements, type: QueryTypes.SELECT },
    );
    const total = Number(countRows[0]?.count ?? 0);

    const rows = await sequelize.query<{
      id: string;
      name: string | null;
      phone: string | null;
      email: string | null;
      role: string;
      is_active: boolean;
      provider: string;
      profile_image: string | null;
      created_at: Date;
      updated_at: Date;
    }>(
      `${unionSql} ORDER BY created_at DESC LIMIT :limit OFFSET :offset`,
      { replacements, type: QueryTypes.SELECT },
    );

    return {
      users: rows.map((row) => ({
        id: row.id,
        name: row.name,
        phone: row.phone,
        email: row.email,
        role: row.role,
        isActive: row.is_active,
        provider: row.provider,
        profileImage: row.profile_image,
        createdAt: row.created_at ? new Date(row.created_at).toISOString() : '',
        updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : '',
      })),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async getByIdForAdmin(userId: string): Promise<AdminUserSummary> {
    for (const role of [Roles.USER, Roles.VENDOR, Roles.ADMIN]) {
      const RoleModel = getRoleUserModel(role);
      const row = await RoleModel.findByPk(userId);
      if (row) return formatAdminUserSummary(row as unknown as User);
    }
    throw AppError.notFound('User not found', 'USER_NOT_FOUND');
  }

  /** Primary platform admin contact for support (first active admin by registration date). */
  async getAdminContact(): Promise<{ email: string | null; phone: string | null }> {
    const AdminModel = getRoleUserModel(Roles.ADMIN);
    const admin = await AdminModel.findOne({
      where: { isActive: true },
      order: [['createdAt', 'ASC']],
      attributes: ['email', 'phone'],
    });

    return {
      email: admin?.email ?? null,
      phone: admin?.phone ?? null,
    };
  }
}

export default new UserService();
