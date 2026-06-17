import { describe, expect, it } from 'vitest';
import { Op } from 'sequelize';
import { buildAdminListWhere, buildPublishedReadWhere, normalizeSlug } from './cms.service';
import { Roles } from '@modules/user/user.model';

describe('normalizeSlug', () => {
  it('lowercases and trims', () => {
    expect(normalizeSlug('  Terms-Of-Service  ')).toBe('terms-of-service');
  });
});

describe('buildPublishedReadWhere', () => {
  it('filters published rows for type and all', () => {
    const where = buildPublishedReadWhere({ type: 'vendor' }, Roles.USER);
    expect(where).toEqual({
      isPublished: true,
      audienceType: { [Op.in]: ['vendor', 'all'] },
    });
  });

  it('uses JWT role when type omitted', () => {
    const where = buildPublishedReadWhere({}, Roles.USER);
    expect(where).toEqual({
      isPublished: true,
      audienceType: { [Op.in]: ['user', 'all'] },
    });
  });

  it('adds slug filter when provided', () => {
    const where = buildPublishedReadWhere({ slug: 'Privacy', type: 'user' }, Roles.VENDOR);
    expect(where).toMatchObject({
      slug: 'privacy',
      isPublished: true,
      audienceType: { [Op.in]: ['user', 'all'] },
    });
  });
});

describe('buildAdminListWhere', () => {
  it('builds optional admin filters', () => {
    const where = buildAdminListWhere({
      slug: 'terms',
      type: 'admin',
      isPublished: false,
    });
    expect(where).toEqual({
      slug: 'terms',
      audienceType: 'admin',
      isPublished: false,
    });
  });
});
