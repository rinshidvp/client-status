/* Pure helpers shared by the page and the Node tests. No DOM access here. */
(function (root, factory) {
  const lib = factory();
  if (typeof module === "object" && module.exports) module.exports = lib;
  else root.StatusLib = lib;
})(typeof self !== "undefined" ? self : this, function () {
  const STATUSES = {
    progress: { label: "In progress", order: 0 },
    blocked: { label: "Waiting / blocked", order: 1 },
    todo: { label: "To do", order: 2 },
    done: { label: "Done", order: 3 },
  };

  const PROJECT_HEALTH = {
    "on track": "good",
    "at risk": "warn",
    delayed: "bad",
    completed: "good",
    "on hold": "warn",
  };

  function normalizeStatus(value) {
    const s = String(value == null ? "" : value).trim().toLowerCase();
    if (!s) return "todo";
    if (/^(done|complete|completed|finished)$/.test(s)) return "done";
    if (/progress|doing|working|ongoing|wip/.test(s)) return "progress";
    if (/block|wait|hold|stuck/.test(s)) return "blocked";
    return "todo";
  }

  function computeProgress(tasks) {
    const total = tasks.length;
    const done = tasks.filter((t) => normalizeStatus(t.status) === "done").length;
    const percent = total === 0 ? 0 : Math.round((done / total) * 100);
    return { done, total, percent };
  }

  function groupTasks(tasks) {
    const groups = {};
    Object.keys(STATUSES).forEach((k) => (groups[k] = []));
    tasks.forEach((t) => groups[normalizeStatus(t.status)].push(t));
    return Object.keys(STATUSES)
      .sort((a, b) => STATUSES[a].order - STATUSES[b].order)
      .map((key) => ({ key, label: STATUSES[key].label, tasks: groups[key] }))
      .filter((g) => g.tasks.length > 0);
  }

  // Parses "2026-10-17" as a local calendar date and full ISO strings as instants.
  function parseDate(value) {
    if (!value) return null;
    if (value instanceof Date) return isNaN(value) ? null : value;
    const s = String(value).trim();
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    const d = m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(s);
    return isNaN(d) ? null : d;
  }

  function startOfDay(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  // Whole calendar days from `today` to `target` (negative when target is past).
  function daysUntil(target, today) {
    const t = parseDate(target);
    if (!t) return null;
    const ms = startOfDay(t) - startOfDay(today || new Date());
    return Math.round(ms / 86400000);
  }

  function describeDaysLeft(days) {
    if (days == null) return "";
    if (days === 0) return "Due today";
    if (days === 1) return "1 day left";
    if (days > 1) return days + " days left";
    if (days === -1) return "1 day overdue";
    return -days + " days overdue";
  }

  function formatDate(value) {
    const d = parseDate(value);
    if (!d) return "";
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  }

  function formatRelative(value, now) {
    const d = parseDate(value);
    if (!d) return "";
    const n = now || new Date();
    const mins = Math.round((n - d) / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return mins + (mins === 1 ? " minute ago" : " minutes ago");
    const hours = Math.round(mins / 60);
    if (hours < 24) return hours + (hours === 1 ? " hour ago" : " hours ago");
    const days = daysUntil(n, d);
    if (days === 1) return "yesterday";
    if (days < 30) return days + " days ago";
    return formatDate(d);
  }

  function sortUpdates(updates) {
    return updates
      .filter((u) => u && String(u.message || "").trim())
      .slice()
      .sort((a, b) => (parseDate(b.date) || 0) - (parseDate(a.date) || 0));
  }

  function healthTone(status) {
    return PROJECT_HEALTH[String(status || "").trim().toLowerCase()] || "neutral";
  }

  function readKey(search, hash) {
    const fromSearch = new URLSearchParams(search || "").get("k");
    const fromHash = new URLSearchParams(String(hash || "").replace(/^#/, "")).get("k");
    return (fromSearch || fromHash || "").trim();
  }

  return {
    STATUSES,
    normalizeStatus,
    computeProgress,
    groupTasks,
    parseDate,
    daysUntil,
    describeDaysLeft,
    formatDate,
    formatRelative,
    sortUpdates,
    healthTone,
    readKey,
  };
});
