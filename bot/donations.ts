import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
export function donationConfirmation(
  author: string,
  recipient: string,
  amount: number,
  secret: string,
  now = Date.now(),
) {
  const payload = [
    author,
    recipient,
    amount.toString(36),
    Math.floor(now / 1000).toString(36) + '.' + randomBytes(3).toString('hex'),
  ].join(':');
  return (
    'gift:' +
    payload +
    ':' +
    createHmac('sha256', secret)
      .update(payload)
      .digest('base64url')
      .slice(0, 12)
  );
}
export function readDonation(
  customId: string,
  user: string,
  secret: string,
  now = Date.now(),
) {
  const [prefix, author, recipient, value, nonce, signature] =
    customId.split(':');
  const payload = [author, recipient, value, nonce].join(':');
  const expected = createHmac('sha256', secret)
    .update(payload)
    .digest('base64url')
    .slice(0, 12);
  const age = now - parseInt(nonce?.split('.')[0], 36) * 1000;
  if (
    prefix !== 'gift' ||
    user !== author ||
    !signature ||
    signature.length !== expected.length ||
    !timingSafeEqual(Buffer.from(signature), Buffer.from(expected)) ||
    !Number.isFinite(age) ||
    age < 0 ||
    age > 300000
  )
    throw new Error('Confirmation invalide ou expirée. Relancez /don.');
  return {
    recipient,
    amount: parseInt(value, 36),
    key: 'don:' + author + ':' + nonce,
  };
}
