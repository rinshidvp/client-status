const test = require("node:test");
const assert = require("node:assert/strict");
const L = require("../lib.js");

test("normalizeStatus maps sheet wording to the four buckets", () => {
  assert.equal(L.normalizeStatus("Done"), "done");
  assert.equal(L.normalizeStatus(" completed "), "done");
  assert.equal(L.normalizeStatus("In progress"), "progress");
  assert.equal(L.normalizeStatus("WIP"), "progress");
  assert.equal(L.normalizeStatus("Waiting for client"), "blocked");
  assert.equal(L.normalizeStatus("Blocked"), "blocked");
  assert.equal(L.normalizeStatus("To do"), "todo");
  assert.equal(L.normalizeStatus(""), "todo");
  assert.equal(L.normalizeStatus(null), "todo");
  assert.equal(L.normalizeStatus("something odd"), "todo");
});

test("computeProgress rounds and handles no tasks", () => {
  assert.deepEqual(L.computeProgress([]), { done: 0, total: 0, percent: 0 });
  const tasks = [{ status: "Done" }, { status: "Done" }, { status: "To do" }];
  assert.deepEqual(L.computeProgress(tasks), { done: 2, total: 3, percent: 67 });
  assert.equal(L.computeProgress([{ status: "done" }]).percent, 100);
});

test("groupTasks orders groups and drops empty ones", () => {
  const groups = L.groupTasks([
    { task: "a", status: "Done" },
    { task: "b", status: "In progress" },
    { task: "c", status: "Done" },
  ]);
  assert.deepEqual(groups.map((g) => g.key), ["progress", "done"]);
  assert.deepEqual(groups[1].tasks.map((t) => t.task), ["a", "c"]);
});

test("parseDate treats plain dates as local calendar days", () => {
  const d = L.parseDate("2026-03-05");
  assert.equal(d.getFullYear(), 2026);
  assert.equal(d.getMonth(), 2);
  assert.equal(d.getDate(), 5);
  assert.equal(L.parseDate(""), null);
  assert.equal(L.parseDate("not a date"), null);
});

test("daysUntil counts calendar days regardless of time of day", () => {
  const today = new Date(2026, 9, 17, 23, 30);
  assert.equal(L.daysUntil("2026-10-17", today), 0);
  assert.equal(L.daysUntil("2026-10-18", today), 1);
  assert.equal(L.daysUntil("2026-10-15", today), -2);
  assert.equal(L.daysUntil("2026-11-01", today), 15);
  assert.equal(L.daysUntil("", today), null);
});

test("describeDaysLeft wording", () => {
  assert.equal(L.describeDaysLeft(0), "Due today");
  assert.equal(L.describeDaysLeft(1), "1 day left");
  assert.equal(L.describeDaysLeft(9), "9 days left");
  assert.equal(L.describeDaysLeft(-1), "1 day overdue");
  assert.equal(L.describeDaysLeft(-4), "4 days overdue");
  assert.equal(L.describeDaysLeft(null), "");
});

test("formatRelative", () => {
  const now = new Date(2026, 9, 17, 12, 0);
  assert.equal(L.formatRelative(new Date(2026, 9, 17, 11, 59, 40), now), "just now");
  assert.equal(L.formatRelative(new Date(2026, 9, 17, 11, 15), now), "45 minutes ago");
  assert.equal(L.formatRelative(new Date(2026, 9, 17, 9, 0), now), "3 hours ago");
  assert.equal(L.formatRelative(new Date(2026, 9, 16, 8, 0), now), "yesterday");
  assert.equal(L.formatRelative(new Date(2026, 9, 10, 8, 0), now), "7 days ago");
});

test("sortUpdates puts newest first and drops blank messages", () => {
  const out = L.sortUpdates([
    { date: "2026-10-01", message: "old" },
    { date: "2026-10-10", message: "new" },
    { date: "2026-10-12", message: "  " },
  ]);
  assert.deepEqual(out.map((u) => u.message), ["new", "old"]);
});

test("healthTone", () => {
  assert.equal(L.healthTone("On track"), "good");
  assert.equal(L.healthTone("at risk"), "warn");
  assert.equal(L.healthTone("Delayed"), "bad");
  assert.equal(L.healthTone(""), "neutral");
});

test("readKey reads ?k= or #k=", () => {
  assert.equal(L.readKey("?k=abc", ""), "abc");
  assert.equal(L.readKey("", "#k=xyz"), "xyz");
  assert.equal(L.readKey("?x=1", ""), "");
});
