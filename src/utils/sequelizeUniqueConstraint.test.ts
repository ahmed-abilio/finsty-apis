import { describe, expect, it } from 'vitest';
import { UniqueConstraintError } from 'sequelize';
import {
  mapUniqueConstraintViolation,
  throwIfUniqueConstraint,
} from './sequelizeUniqueConstraint';
import { AppError } from './appError';

describe('sequelizeUniqueConstraint', () => {
  it('maps store email unique violation to readable message', () => {
    const err = new UniqueConstraintError({
      message: 'duplicate',
      errors: [],
      fields: { email: 'awearo@gmail.com' },
      parent: { constraint: 'stores_email_key' } as never,
    });

    const mapped = mapUniqueConstraintViolation(err);
    expect(mapped.code).toBe('STORE_EMAIL_ALREADY_EXISTS');
    expect(mapped.message).toContain('email');
    expect(mapped.field).toBe('email');
  });

  it('throws AppError.conflict for unique violations', () => {
    const err = new UniqueConstraintError({
      message: 'duplicate',
      errors: [],
      fields: { email: 'taken@example.com' },
      parent: { constraint: 'stores_email_key' } as never,
    });

    expect(() => throwIfUniqueConstraint(err)).toThrow(AppError);
    try {
      throwIfUniqueConstraint(err);
    } catch (e) {
      expect(e).toMatchObject({
        statusCode: 409,
        code: 'STORE_EMAIL_ALREADY_EXISTS',
      });
    }
  });
});
