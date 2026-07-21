/** Shabbat dinners only happen on Friday nights, so dinner creation only ever needs to offer
 *  Fridays — not a general-purpose calendar. This also sidesteps
 *  @react-native-community/datetimepicker, which is native-only and doesn't render on web via
 *  react-native-web (there's no .web shim for it), so a raw <DateTimePicker> silently failed to show
 *  anything there. A plain list of upcoming Fridays works identically on every platform. */
export function nextFriday(from: Date = new Date()): Date {
  const d = new Date(from);
  const day = d.getDay();
  const diff = (5 - day + 7) % 7 || 7;
  d.setDate(d.getDate() + diff);
  return d;
}

/** The next `count` Fridays, starting with the soonest upcoming one. */
export function upcomingFridays(count: number, from: Date = new Date()): Date[] {
  const first = nextFriday(from);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(first);
    d.setDate(d.getDate() + i * 7);
    return d;
  });
}
