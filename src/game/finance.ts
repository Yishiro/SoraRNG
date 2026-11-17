import { economy } from './config';
import type { Player } from './core';
export const bonusRules = {
  hourly: { amount: 1000, delay: 3600000 },
  daily: { amount: 5000, delay: 86400000 },
  weekly: { amount: 5000, delay: 604800000 },
  monthly: { amount: 10000, delay: 2592000000 },
} as const;
export type Bonus = keyof typeof bonusRules;
export type FinanceState = {
  claims: Partial<Record<Bonus, number>>;
  bank: { micros: string; at: number };
  reserved: number;
  liability: number;
};
export class FinanceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FinanceError';
  }
}
const UNIT = 1000000n,
  Q = 10n ** 36n,
  FACTOR = 1000000000229197075213530846699726725n;
export function financeState(p: Player, now: number): FinanceState {
  return (p.finance ??= {
    claims: {},
    bank: { micros: '0', at: now },
    reserved: 0,
    liability: 0,
  });
}
export function safeAmount(value: bigint) {
  if (value < 0n || value > BigInt(Number.MAX_SAFE_INTEGER))
    throw new FinanceError(
      'Montant non représentable. Choisissez un montant plus petit.',
    );
  return Number(value);
}
export function assertWallet(p: Player) {
  const reserve = p.finance?.reserved ?? 0,
    liability = p.finance?.liability ?? 0;
  if (
    !Number.isSafeInteger(p.munny) ||
    p.munny < 0 ||
    !Number.isSafeInteger(reserve) ||
    reserve < 0 ||
    !Number.isSafeInteger(liability) ||
    liability < 0
  )
    throw new FinanceError('Solde invalide.');
  safeAmount(BigInt(p.munny) + BigInt(reserve) + BigInt(liability));
}
export function credit(p: Player, amount: number) {
  p.munny = safeAmount(BigInt(p.munny) + BigInt(amount));
  assertWallet(p);
}
export function amountFrom(input: unknown, available: bigint | number) {
  if (typeof input === 'string') input = input.trim();
  const maximum = BigInt(available);
  let value: bigint;
  if (
    typeof input === 'string' &&
    ['all', 'tout'].includes(input.toLowerCase())
  )
    value = maximum;
  else if (typeof input === 'number' && Number.isSafeInteger(input))
    value = BigInt(input);
  else if (typeof input === 'string' && /^\d{1,16}$/.test(input))
    value = BigInt(input);
  else throw new FinanceError('Indiquez un montant entier positif ou tout.');
  if (value <= 0n) throw new FinanceError('Le montant doit être positif.');
  if (value > maximum)
    throw new FinanceError('Munny disponibles insuffisants.');
  return safeAmount(value);
}
function pow(base: bigint, exponent: number) {
  let result = Q;
  while (exponent > 0) {
    if (exponent % 2) result = (result * base) / Q;
    base = (base * base) / Q;
    exponent = Math.floor(exponent / 2);
  }
  return result;
}
export function bankMicros(p: Player, now: number) {
  const bank = p.finance?.bank;
  if (!bank) return 0n;
  const principal = BigInt(bank.micros);
  if (principal < 0n || !Number.isSafeInteger(bank.at))
    throw new FinanceError('Épargne invalide.');
  if (!principal) return 0n;
  const elapsed = Math.max(0, Math.floor(now - bank.at));
  return (principal * pow(FACTOR, elapsed) + Q / 2n) / Q;
}
export function settleBank(p: Player, now: number) {
  const state = financeState(p, now);
  state.bank = { micros: bankMicros(p, now).toString(), at: now };
  return BigInt(state.bank.micros);
}
export function bankMove(
  p: Player,
  kind: 'deposit' | 'withdraw',
  input: unknown,
  now: number,
) {
  let balance = settleBank(p, now);
  const amount = amountFrom(
    input,
    kind === 'deposit' ? p.munny : balance / UNIT,
  );
  if (kind === 'deposit') {
    p.munny -= amount;
    balance += BigInt(amount) * UNIT;
  } else {
    balance -= BigInt(amount) * UNIT;
    credit(p, amount);
  }
  p.finance!.bank.micros = balance.toString();
  assertWallet(p);
  return amount;
}
export function bonusNext(p: Player, type: Bonus) {
  const at = p.finance?.claims[type];
  if (at !== undefined) return at + bonusRules[type].delay;
  if (type === 'daily' && p.daily) {
    const legacy = Date.parse(p.daily + 'T00:00:00.000Z');
    if (Number.isFinite(legacy)) return legacy + bonusRules.daily.delay;
  }
  return 0;
}
export function claimBonus(p: Player, type: Bonus, now: number) {
  const rule = bonusRules[type];
  if (!rule) throw new FinanceError('Bonus inconnu.');
  const next = bonusNext(p, type);
  if (next > now)
    throw new FinanceError(
      `Bonus disponible dans ${Math.ceil((next - now) / 60000)} min.`,
    );
  financeState(p, now).claims[type] = now;
  credit(p, rule.amount);
  if (type === 'daily') {
    p.daily = new Date(now).toISOString().slice(0, 10);
    p.fragments += economy.dailyFragments;
  }
  return { type, amount: rule.amount, nextAt: now + rule.delay };
}
export function reserve(
  p: Player,
  amount: number,
  multiplier: number,
  now: number,
) {
  const f = financeState(p, now);
  if (p.munny < amount)
    throw new FinanceError('Munny disponibles insuffisants.');
  f.reserved = safeAmount(BigInt(f.reserved) + BigInt(amount));
  f.liability = safeAmount(
    BigInt(f.liability) + BigInt(amount) * BigInt(multiplier - 1),
  );
  p.munny -= amount;
  assertWallet(p);
}
export function release(
  p: Player,
  stake: number,
  multiplier: number,
  payout: number,
) {
  const f = p.finance!;
  f.reserved -= stake;
  f.liability -= stake * (multiplier - 1);
  credit(p, payout);
  assertWallet(p);
}
export function financeView(p: Player, now: number) {
  const micros = bankMicros(p, now);
  return {
    wallet: p.munny,
    bank: (micros / UNIT).toString(),
    bankMicros: micros.toString(),
    reserved: p.finance?.reserved ?? 0,
    bonuses: Object.fromEntries(
      Object.keys(bonusRules).map((key) => {
        const type = key as Bonus;
        return [
          type,
          {
            ...bonusRules[type],
            nextAt: bonusNext(p, type),
            available: bonusNext(p, type) <= now,
          },
        ];
      }),
    ) as Record<
      Bonus,
      { amount: number; delay: number; nextAt: number; available: boolean }
    >,
  };
}
export const redNumbers = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
]);
export function rouletteChoice(input: unknown) {
  if (typeof input !== 'string') throw new FinanceError('Choix invalide.');
  const choice = input.toLowerCase().trim();
  if (['rouge', 'noir', 'vert'].includes(choice)) return choice;
  if (/^\d{1,2}$/.test(choice) && Number(choice) <= 36)
    return String(Number(choice));
  throw new FinanceError(
    'Choisissez rouge, noir, vert ou un numéro de 0 à 36.',
  );
}
export function rouletteResult(choice: string, number: number) {
  const color =
    number === 0 ? 'vert' : redNumbers.has(number) ? 'rouge' : 'noir';
  const won = choice === color || choice === String(number);
  return {
    number,
    color,
    won,
    multiplier: ['rouge', 'noir'].includes(choice) ? 2 : 36,
  };
}
