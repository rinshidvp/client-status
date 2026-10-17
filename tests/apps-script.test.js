// Runs Code.gs in a sandbox with fake Google services to check the API contract.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const SOURCE = fs.readFileSync(path.join(__dirname, "..", "apps-script", "Code.gs"), "utf8");

function fakeSheet(values) {
  return { getDataRange: () => ({ getValues: () => values }) };
}

function load({ key = "secret123", sheets = {} } = {}) {
  const props = key ? { ACCESS_KEY: key } : {};
  const ctx = {
    console: { log() {}, error() {} },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (k) => (k in props ? props[k] : null),
        setProperty: (k, v) => { props[k] = v; },
      }),
    },
    ContentService: {
      MimeType: { JSON: "json" },
      createTextOutput: (text) => ({ text, setMimeType() { return this; } }),
    },
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ({
        getSpreadsheetTimeZone: () => "Asia/Kolkata",
        getSheetByName: (n) => sheets[n] || null,
      }),
    },
    Utilities: {
      // Good enough for tests: format in UTC.
      formatDate: (d, tz, fmt) => {
        const iso = d.toISOString();
        if (fmt === "yyyy-MM-dd") return iso.slice(0, 10);
        if (fmt === "HH:mm:ss") return iso.slice(11, 19);
        return iso;
      },
      getUuid: () => "00000000-0000-0000-0000-000000000000",
    },
  };
  vm.createContext(ctx);
  vm.runInContext(SOURCE, ctx);
  return { ctx, props, call: (k) => JSON.parse(ctx.doGet({ parameter: k == null ? {} : { k } }).text) };
}

test("rejects missing or wrong key", () => {
  const api = load();
  assert.deepEqual(api.call(), { ok: false, error: "unauthorized" });
  assert.deepEqual(api.call("wrong"), { ok: false, error: "unauthorized" });
});

test("rejects everything when no key has been set up", () => {
  const api = load({ key: null });
  assert.deepEqual(api.call(""), { ok: false, error: "unauthorized" });
});

test("returns project, tasks and updates with correct key", () => {
  const due = new Date(Date.UTC(2026, 10, 1));
  const api = load({
    sheets: {
      Project: fakeSheet([
        ["Project name", "Website"],
        ["Client name", " ACME "],
        ["Deadline", due],
        ["Status", "On track"],
        ["Unknown row", "ignored"],
      ]),
      Tasks: fakeSheet([
        ["Task", "Status", "Due date", "Note"],
        ["Design", "Done", due, ""],
        ["", "", "", ""],
        ["Build", "In progress", "", 42],
      ]),
      Updates: fakeSheet([["Date", "Message"], [due, "Started"]]),
    },
  });
  const res = api.call("secret123");
  assert.equal(res.ok, true);
  assert.deepEqual(res.data.project, { name: "Website", client: "ACME", deadline: "2026-11-01", status: "On track" });
  assert.equal(res.data.tasks.length, 2, "blank rows skipped");
  assert.deepEqual(res.data.tasks[1], { task: "Build", status: "In progress", dueDate: "", note: "42" });
  assert.deepEqual(res.data.updates, [{ date: "2026-11-01", message: "Started" }]);
});

test("missing tabs give empty data instead of an error", () => {
  const res = load().call("secret123");
  assert.equal(res.ok, true);
  assert.deepEqual(res.data.tasks, []);
  assert.deepEqual(res.data.project, {});
});

test("onEdit records last edit time", () => {
  const api = load();
  api.ctx.onEdit();
  assert.ok(!isNaN(Date.parse(api.props.LAST_EDIT)));
  assert.equal(api.call("secret123").data.lastUpdated, api.props.LAST_EDIT);
});

test("rotateKey invalidates the old key", () => {
  const api = load();
  api.ctx.SpreadsheetApp.getUi = () => { throw new Error("no ui"); };
  api.ctx.rotateKey();
  assert.notEqual(api.props.ACCESS_KEY, "secret123");
  assert.equal(api.call("secret123").ok, false);
  assert.equal(api.call(api.props.ACCESS_KEY).ok, true);
});
