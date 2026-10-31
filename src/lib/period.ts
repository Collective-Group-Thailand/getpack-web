/** Period arithmetic for monthly/daily reports (Bangkok time, ISO strings). */

/** The step labels as words only: the copy may carry its own arrow glyph ("‹ เดือนก่อน"), the button draws one. */
export const stepLabel = (copy: string) => copy.replace(/[‹›«»←→]/g, "").trim();

/** This month in Bangkok (`YYYY-MM`) — the default period of a monthly report. */
export const bangkokMonth = () => new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 7);

/** A `YYYY-MM` month `by` months away. */
export const shiftMonth = (month: string, by: number) => {
  const [y, m] = month.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(y, m - 1 + by, 1)).toISOString().slice(0, 7);
};

/** A `YYYY-MM-DD` day `by` days away. */
export const shiftDay = (day: string, by: number) =>
  new Date(Date.parse(`${day}T00:00:00Z`) + by * 86_400_000).toISOString().slice(0, 10);
