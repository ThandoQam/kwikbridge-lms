// KwikBridge LMS — Formatters

export const fmt = {
  date: d => d ? new Date(d).toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "numeric" }) : "—",
  dateTime: d => d ? new Date(d).toLocaleString("en-ZA", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—",
  cur: n => "R " + Number(n || 0).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  pct: (n, d = 1) => (n * 100).toFixed(d) + "%",
  num: n => Number(n || 0).toLocaleString("en-ZA"),
};
