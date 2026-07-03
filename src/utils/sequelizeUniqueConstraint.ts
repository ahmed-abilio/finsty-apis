import { UniqueConstraintError, Op } from 'sequelize';
import Store from '@modules/store/store.model';
import { AppError } from './appError';

type UniqueViolation = {
  code: string;
  message: string;
  field?: string;
};

function fieldFromConstraint(constraint: string): string | undefined {
  const match = constraint.match(/_([^_]+)_key$/);
  return match?.[1];
}

export function mapUniqueConstraintViolation(err: UniqueConstraintError): UniqueViolation {
  const constraint =
    (err.parent as { constraint?: string } | undefined)?.constraint?.toLowerCase() ?? '';
  const field =
    Object.keys(err.fields ?? {})[0] ?? fieldFromConstraint(constraint) ?? undefined;

  if (constraint.includes('stores_email') || field === 'email') {
    return {
      code: 'STORE_EMAIL_ALREADY_EXISTS',
      message: 'A store with this email address already exists. Please use a different email.',
      field: 'email',
    };
  }

  if (constraint.includes('stores_slug') || field === 'slug') {
    return {
      code: 'STORE_SLUG_ALREADY_EXISTS',
      message: 'A store with this name already exists. Please choose a different store name.',
      field: 'slug',
    };
  }

  const label = field ? field.replace(/_/g, ' ') : 'value';
  return {
    code: 'DUPLICATE_VALUE',
    message: `This ${label} is already in use.`,
    field,
  };
}

export function isUniqueConstraintError(err: unknown): err is UniqueConstraintError {
  return err instanceof UniqueConstraintError || (err as { name?: string })?.name === 'SequelizeUniqueConstraintError';
}

export function throwIfUniqueConstraint(err: unknown): void {
  if (!isUniqueConstraintError(err)) return;
  const mapped = mapUniqueConstraintViolation(err);
  throw new AppError(
    mapped.message,
    409,
    mapped.code,
    mapped.field ? { field: mapped.field } : undefined,
  );
}

export async function assertStoreEmailAvailable(
  email: string | null | undefined,
  excludeStoreId?: string,
): Promise<void> {
  if (!email?.trim()) return;

  const existing = await Store.findOne({
    where: {
      email: email.trim(),
      ...(excludeStoreId ? { id: { [Op.ne]: excludeStoreId } } : {}),
    },
    attributes: ['id'],
  });

  if (existing) {
    throw new AppError(
      'A store with this email address already exists. Please use a different email.',
      409,
      'STORE_EMAIL_ALREADY_EXISTS',
      { field: 'email' },
    );
  }
}
