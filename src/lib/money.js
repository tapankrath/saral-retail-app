// Centralized currency formatting so every screen displays amounts the same
// way for a given organization's country, instead of each screen carrying
// its own hard-coded "₹" + en-IN formatter. Add a new country here (locale +
// symbol) and every screen that imports from this file picks it up.
const CURRENCY = {
  IN: { symbol: '₹', locale: 'en-IN' },
  US: { symbol: '$', locale: 'en-US' },
}

export function currencyInfo(country) {
  return CURRENCY[country] || CURRENCY.IN
}

export function currencySymbol(country) {
  return currencyInfo(country).symbol
}

// Bare formatted number, no currency symbol — for tables/reports that show
// the symbol once (in a header or not at all) rather than repeating it.
export function formatAmount(n, country, { decimals = 2 } = {}) {
  const { locale } = currencyInfo(country)
  return Number(n || 0).toLocaleString(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

// Formatted number with the currency symbol prefixed.
export function formatMoney(n, country, { decimals = 2 } = {}) {
  return currencySymbol(country) + formatAmount(n, country, { decimals })
}
