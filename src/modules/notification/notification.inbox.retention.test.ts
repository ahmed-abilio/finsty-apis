import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Op } from 'sequelize';
import NotificationInbox from './notification-inbox.model';
import notificationInboxService, {
  NOTIFICATION_RETENTION_DAYS,
  notificationRetentionCutoff,
} from './notification.inbox.service';

vi.mock('./notification-inbox.model', () => ({
  default: {
    destroy: vi.fn(),
  },
}));

describe('notificationRetentionCutoff', () => {
  it(`is ${NOTIFICATION_RETENTION_DAYS} days before now`, () => {
    const now = new Date('2026-07-23T12:00:00.000Z');
    const cutoff = notificationRetentionCutoff(now);
    expect(cutoff.toISOString()).toBe('2026-06-23T12:00:00.000Z');
  });
});

describe('NotificationInboxService.deleteOlderThan', () => {
  beforeEach(() => {
    vi.mocked(NotificationInbox.destroy).mockReset();
  });

  it('destroys rows with createdAt before cutoff', async () => {
    const cutoff = new Date('2026-06-23T12:00:00.000Z');
    vi.mocked(NotificationInbox.destroy).mockResolvedValue(7);

    const deleted = await notificationInboxService.deleteOlderThan(cutoff);

    expect(deleted).toBe(7);
    expect(NotificationInbox.destroy).toHaveBeenCalledWith({
      where: { createdAt: { [Op.lt]: cutoff } },
    });
  });
});
