/**
 * A date picked in a form, as the Bangkok date-time the API expects (api-conventions §3): the
 * start of the day, or its last second for an end. Nothing is computed — the offset is fixed.
 */
export function bangkokMidnight(day: string, endOfDay = false): string {
  return `${day}T${endOfDay ? "23:59:59" : "00:00:00"}+07:00`;
}

/** The Bangkok calendar day of an API date-time (the API always sends `+07:00`). */
export function bangkokDayOf(value: string | null | undefined): string {
  return value ? value.slice(0, 10) : "";
}
