export default function formatCurrency(value: number, currencyCode = 'USD') {
    const isUSD = currencyCode === 'USD';
    const locale = isUSD ? 'en-US' : 'en-IN';
    try {
        return new Intl.NumberFormat(locale, {
            style: 'currency',
            currency: currencyCode,
            maximumFractionDigits: 2,
        }).format(value);
    } catch {
        return new Intl.NumberFormat(locale, {
            style: 'currency',
            currency: 'USD',
            maximumFractionDigits: 2,
        }).format(value);
    }
}