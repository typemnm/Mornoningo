export function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export function addDays(base, days) {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
