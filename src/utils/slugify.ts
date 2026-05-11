import { Op, ModelStatic, Model } from 'sequelize';

export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function randomSuffix(): string {
  return Math.random().toString(36).substring(2, 6);
}

export async function generateUniqueSlug(
  text: string,
  model: ModelStatic<Model>,
  excludeId?: string,
): Promise<string> {
  const base = generateSlug(text);
  let slug = base;

  for (let i = 0; i < 10; i++) {
    const where: Record<string, unknown> = { slug };
    if (excludeId) where.id = { [Op.ne]: excludeId };

    const existing = await model.findOne({ where });
    if (!existing) return slug;

    slug = `${base}-${randomSuffix()}`;
  }

  return slug;
}
