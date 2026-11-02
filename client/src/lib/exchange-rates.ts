export type IndicativeExchangeRate = {
  rate: number;
  date: string;
};

/**
 * Fetch a free daily reference rate from Frankfurter. It requires no API key
 * and allows browser requests, so conversions work directly in the app.
 */
export async function fetchIndicativeExchangeRate(
  from: string,
  to: string,
  signal?: AbortSignal,
): Promise<IndicativeExchangeRate> {
  const base = from.trim().toUpperCase();
  const quote = to.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(base) || !/^[A-Z]{3}$/.test(quote)) {
    throw new Error("Invalid currency code");
  }
  if (base === quote) return { rate: 1, date: new Date().toISOString().slice(0, 10) };

  const response = await fetch(
    `https://api.frankfurter.dev/v2/rate/${encodeURIComponent(base)}/${encodeURIComponent(quote)}`,
    { signal },
  );
  if (!response.ok) throw new Error("Live exchange rate is unavailable. Enter the converted amount manually.");

  const result = await response.json();
  const rate = Number(result?.rate);
  if (!Number.isFinite(rate) || rate <= 0 || result?.base !== base || result?.quote !== quote) {
    throw new Error("Live exchange rate is unavailable. Enter the converted amount manually.");
  }
  return { rate, date: String(result.date ?? "") };
}
