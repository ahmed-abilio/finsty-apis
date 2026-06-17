import { Op, WhereOptions } from 'sequelize';
import CmsPage, { type CmsPageAttributes } from './cms.model';
import {
  CMS_AUDIENCE_TYPES,
  type CmsAudienceType,
  type CmsListFilters,
  type CmsReadFilters,
  type CreateCmsPageInput,
  type UpdateCmsPageInput,
} from './cms.types';
import { CMS_CONTENT_MAX_LENGTH, sanitizeCmsHtml } from './cms.sanitize';
import { AppError } from '@utils/appError';
import type { Roles } from '@modules/user/user.model';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function normalizeSlug(slug: string): string {
  return slug.trim().toLowerCase();
}

export function assertValidSlug(slug: string): void {
  const normalized = normalizeSlug(slug);
  if (normalized.length < 2 || normalized.length > 128 || !SLUG_PATTERN.test(normalized)) {
    throw AppError.badRequest(
      'Slug must be 2–128 characters: lowercase letters, numbers, and hyphens only',
      'INVALID_SLUG',
    );
  }
}

function assertValidAudienceType(type: string): asserts type is CmsAudienceType {
  if (!(CMS_AUDIENCE_TYPES as readonly string[]).includes(type)) {
    throw AppError.badRequest('Invalid audience type', 'INVALID_AUDIENCE_TYPE');
  }
}

function assertContentLength(html: string): void {
  if (html.length > CMS_CONTENT_MAX_LENGTH) {
    throw AppError.badRequest('Content exceeds maximum allowed length', 'CONTENT_TOO_LONG');
  }
}

/** Published read: audience matches type or all; optional slug. */
export function buildPublishedReadWhere(
  filters: CmsReadFilters,
  callerRole: Roles,
): WhereOptions<CmsPageAttributes> {
  const audienceType = filters.type ?? callerRole;
  assertValidAudienceType(audienceType);

  const where: WhereOptions = {
    isPublished: true,
    audienceType: { [Op.in]: [audienceType, 'all'] },
  };

  if (filters.slug) {
    where.slug = normalizeSlug(filters.slug);
  }

  return where;
}

export function buildAdminListWhere(filters: CmsListFilters): WhereOptions {
  const where: WhereOptions = {};

  if (filters.slug) {
    where.slug = normalizeSlug(filters.slug);
  }
  if (filters.type) {
    assertValidAudienceType(filters.type);
    where.audienceType = filters.type;
  }
  if (filters.isPublished !== undefined) {
    where.isPublished = filters.isPublished;
  }

  return where;
}

class CmsService {
  async listPublished(filters: CmsReadFilters, callerRole: Roles) {
    const where = buildPublishedReadWhere(filters, callerRole);
    const rows = await CmsPage.findAll({
      where,
      order: [['updatedAt', 'DESC']],
    });
    return rows;
  }

  async adminList(filters: CmsListFilters) {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
    const offset = (page - 1) * limit;
    const where = buildAdminListWhere(filters);

    const { count, rows } = await CmsPage.findAndCountAll({
      where,
      order: [['updatedAt', 'DESC']],
      limit,
      offset,
    });

    return { items: rows, pagination: { page, limit, total: count, totalPages: Math.ceil(count / limit) } };
  }

  async getById(id: string, options?: { publishedOnly?: boolean }) {
    const row = await CmsPage.findByPk(id);
    if (!row) throw AppError.notFound('CMS page not found', 'CMS_NOT_FOUND');
    if (options?.publishedOnly && !row.isPublished) {
      throw AppError.notFound('CMS page not found', 'CMS_NOT_FOUND');
    }
    return row;
  }

  async create(input: CreateCmsPageInput) {
    assertValidSlug(input.slug);
    assertValidAudienceType(input.audienceType);
    assertContentLength(input.contentHtml);

    const slug = normalizeSlug(input.slug);
    const contentHtml = sanitizeCmsHtml(input.contentHtml);

    try {
      return await CmsPage.create({
        slug,
        title: input.title.trim(),
        audienceType: input.audienceType,
        contentHtml,
        isPublished: input.isPublished ?? true,
      });
    } catch (err: unknown) {
      if ((err as { name?: string }).name === 'SequelizeUniqueConstraintError') {
        throw AppError.conflict(
          'A CMS page with this slug and audience type already exists',
          'SLUG_AUDIENCE_CONFLICT',
        );
      }
      throw err;
    }
  }

  async update(id: string, input: UpdateCmsPageInput) {
    const row = await this.getById(id);

    if (input.slug !== undefined) {
      assertValidSlug(input.slug);
      row.slug = normalizeSlug(input.slug);
    }
    if (input.title !== undefined) row.title = input.title.trim();
    if (input.audienceType !== undefined) {
      assertValidAudienceType(input.audienceType);
      row.audienceType = input.audienceType;
    }
    if (input.contentHtml !== undefined) {
      assertContentLength(input.contentHtml);
      row.contentHtml = sanitizeCmsHtml(input.contentHtml);
    }
    if (input.isPublished !== undefined) row.isPublished = input.isPublished;

    try {
      await row.save();
      return row;
    } catch (err: unknown) {
      if ((err as { name?: string }).name === 'SequelizeUniqueConstraintError') {
        throw AppError.conflict(
          'A CMS page with this slug and audience type already exists',
          'SLUG_AUDIENCE_CONFLICT',
        );
      }
      throw err;
    }
  }

  async remove(id: string): Promise<void> {
    const row = await this.getById(id);
    await row.destroy();
  }
}

export default new CmsService();
