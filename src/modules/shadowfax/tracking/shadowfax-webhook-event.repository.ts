import { Op } from 'sequelize';
import ShadowfaxWebhookEvent from './shadowfax-webhook-event.model';

export type InsertWebhookEventResult =
  | { inserted: true; event: ShadowfaxWebhookEvent }
  | { inserted: false; event: ShadowfaxWebhookEvent };

export async function insertWebhookEventIfNotExists(data: {
  eventKey: string;
  sfxOrderId: number | null;
  clientOrderId: string | null;
  status: string | null;
  payload: object;
}): Promise<InsertWebhookEventResult> {
  const existing = await ShadowfaxWebhookEvent.findOne({ where: { eventKey: data.eventKey } });
  if (existing) return { inserted: false, event: existing };

  try {
    const event = await ShadowfaxWebhookEvent.create(data);
    return { inserted: true, event };
  } catch (err: unknown) {
    const sequelizeError = err as { name?: string };
    if (sequelizeError.name === 'SequelizeUniqueConstraintError') {
      const dup = await ShadowfaxWebhookEvent.findOne({ where: { eventKey: data.eventKey } });
      if (dup) return { inserted: false, event: dup };
    }
    throw err;
  }
}

export async function markWebhookEventProcessed(
  eventId: string,
  remarks?: string | null,
): Promise<void> {
  await ShadowfaxWebhookEvent.update(
    { processed: true, processedAt: new Date(), remarks: remarks ?? null },
    { where: { id: eventId } },
  );
}

export async function findWebhookEventById(eventId: string): Promise<ShadowfaxWebhookEvent | null> {
  return ShadowfaxWebhookEvent.findByPk(eventId);
}

export async function findUnprocessedWebhookEvents(limit = 100): Promise<ShadowfaxWebhookEvent[]> {
  return ShadowfaxWebhookEvent.findAll({
    where: { processed: false },
    order: [['createdAt', 'ASC']],
    limit,
  });
}

export async function countWebhookEventsSince(since: Date): Promise<number> {
  return ShadowfaxWebhookEvent.count({ where: { createdAt: { [Op.gte]: since } } });
}
