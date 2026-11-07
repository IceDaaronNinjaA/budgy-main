// Pure integer-cent money helpers. No React or Firebase dependencies.
export function assertCents(value, label = 'amountCents', { allowNegative = false, allowZero = true } = {}) {
  if (!Number.isSafeInteger(value)) throw new TypeError(`${label} must be a safe integer number of cents`);
  if (!allowNegative && value < 0) throw new RangeError(`${label} cannot be negative`);
  if (!allowZero && value === 0) throw new RangeError(`${label} must be greater than zero`);
  return value;
}

export function parseUsdToCents(input) {
  if (typeof input !== 'string') throw new TypeError('Enter a dollar amount as text');
  const text = input.trim();
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(text)) {
    throw new RangeError('Enter a nonnegative USD amount with at most two decimal places');
  }
  const [whole, fraction = ''] = text.split('.');
  const result = Number(BigInt(whole) * 100n + BigInt((fraction + '00').slice(0, 2)));
  return assertCents(result);
}

export function formatUsdFromCents(amountCents) {
  assertCents(amountCents, 'amountCents', { allowNegative: true });
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
    .format(amountCents / 100);
}

export function safeCentsSum(values) {
  return values.reduce((total, value) => {
    assertCents(value, 'value', { allowNegative: true });
    const result = total + value;
    return assertCents(result, 'sum', { allowNegative: true });
  }, 0);
}
