import logger from '@utils/logger';

const BHASH_SMS_URL = 'http://bhashsms.com/api/sendmsg.php';
const DEFAULT_BHASH_SMS_USER = 'Awearo_01';

function normalizeIndianMobile(phone: string): string {
  const digitsOnly = phone.replace(/\D/g, '');
  if (digitsOnly.length === 12 && digitsOnly.startsWith('91')) {
    return digitsOnly.slice(2);
  }
  if (digitsOnly.length === 11 && digitsOnly.startsWith('0')) {
    return digitsOnly.slice(1);
  }
  return digitsOnly;
}

export async function sendBhashSms(phone: string, text: string): Promise<void> {
  const user = process.env.BHASH_SMS_USER || DEFAULT_BHASH_SMS_USER;
  const pass = process.env.BHASH_SMS_PASS;
  const sender = process.env.BHASH_SMS_SENDER;
  const priority = process.env.BHASH_SMS_PRIORITY || 'ndnd';
  const stype = process.env.BHASH_SMS_STYPE || 'normal';
  const normalizedPhone = normalizeIndianMobile(phone);

  if (!pass || !sender || !user) {
    throw new Error('BhashSMS credentials (BHASH_SMS_USER, BHASH_SMS_PASS, BHASH_SMS_SENDER) are not configured');
  }

  if (!/^\d{10}$/.test(normalizedPhone)) {
    throw new Error(`BhashSMS phone must be 10 digits without country code. Got: ${phone}`);
  }

  const params = new URLSearchParams({
    user,
    pass,
    sender,
    phone: normalizedPhone,
    text,
    priority,
    stype,
  });

  const url = `${BHASH_SMS_URL}?${params.toString()}`;

  const response = await fetch(url);

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    logger.error({ phone: normalizedPhone, status: response.status, body }, 'BhashSMS request failed');
    throw new Error(`BhashSMS API error: HTTP ${response.status}`);
  }

  const result = await response.text();
  const normalizedResult = result.trim().toLowerCase();
  const rawResult = result.trim();
  const success =
    /^s\.\d+$/i.test(rawResult) ||
    normalizedResult.includes('success') ||
    normalizedResult.includes('sent') ||
    normalizedResult.includes('ok');

  if (!success) {
    const hasErrorSignal =
      normalizedResult.includes('error') ||
      normalizedResult.includes('invalid') ||
      normalizedResult.includes('fail') ||
      normalizedResult.includes('reject');

    if (!hasErrorSignal) {
      logger.info({ phone: normalizedPhone, result: rawResult }, 'BhashSMS SMS accepted with vendor reference');
      return;
    }

    logger.error({ phone: normalizedPhone, result: rawResult }, 'BhashSMS vendor rejected SMS');
    throw new Error(`BhashSMS API rejected SMS: ${result}`);
  }

  logger.info({ phone: normalizedPhone, result: rawResult }, 'BhashSMS SMS sent');
}
