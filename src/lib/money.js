export function moneyCents(value) {
  const amount = Number(String(value ?? '').replace(/,/g, '')) || 0
  return Math.round((amount + Number.EPSILON) * 100)
}

export function roundMoney(value) {
  return moneyCents(value) / 100
}

export function sumMoney(values) {
  return values.reduce((cents, value) => cents + moneyCents(value), 0) / 100
}
