import redis from '@config/redis';
import User from '@modules/user/user.model';
import logger from '@utils/logger';

const TOUCH_TTL_SECONDS = 60;
const touchKey = (userId: string) => `last-active-touch:${userId}`;

/**
 * Throttled last-active update for buyer users (at most once per minute).
 * Fire-and-forget — never blocks the request path.
 */
export function touchUserLastActive(userId: string): void {
  if (!userId) return;

  void (async () => {
    try {
      const acquired = await redis.set(touchKey(userId), '1', 'EX', TOUCH_TTL_SECONDS, 'NX');
      if (acquired !== 'OK') return;
      await User.update({ lastActiveAt: new Date() }, { where: { id: userId } });
    } catch (err) {
      logger.warn({ err, userId }, 'Failed to touch user lastActiveAt');
    }
  })();
}
