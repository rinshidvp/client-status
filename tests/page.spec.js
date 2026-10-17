const { test, expect } = require("@playwright/test");

const API = "https://api.example.test/exec";
const KEY = "goodkey";

const SAMPLE = {
  project: { name: "Shop App", client: "ACME Ltd", startDate: "2026-01-01", deadline: "2099-01-01", status: "At risk", summary: "Online store" },
  tasks: [
    { task: "Design", status: "Done", dueDate: "2026-01-10", note: "" },
    { task: "Checkout", status: "In progress", dueDate: "2000-01-01", note: "Payment gateway" },
    { task: "Photos", status: "Waiting for client", dueDate: "", note: "" },
    { task: "<img src=x onerror=window.__xss=1>", status: "To do", dueDate: "", note: "<b>bold?</b>" },
    { task: "", status: "Done", dueDate: "", note: "blank rows are ignored" },
  ],
  updates: [
    { date: "2026-02-01", message: "Older update" },
    { date: "2026-03-01", message: "Newest update" },
  ],
  lastUpdated: new Date().toISOString(),
};

async function connect(page, handler) {
  await page.route("**/config.js", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: `window.STATUS_CONFIG = { API_URL: "${API}", OWNER_NAME: "Muhammed Rinshid VP", OWNER_LINK: "https://github.com/rinshidvp", REFRESH_MINUTES: 0 };`,
    })
  );
  await page.route(API + "**", handler);
}

function api(data) {
  return (route) => {
    const k = new URL(route.request().url()).searchParams.get("k");
    const body = k === KEY ? { ok: true, data } : { ok: false, error: "unauthorized" };
    return route.fulfill({ contentType: "application/json", body: JSON.stringify(body) });
  };
}

test("shows the project from the sheet with a valid link", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await connect(page, api(SAMPLE));
  await page.goto("/?k=" + KEY);

  await expect(page.locator("#project-name")).toHaveText("Shop App");
  await expect(page.locator("#client-name")).toHaveText("Prepared for ACME Ltd");
  await expect(page.locator("#owner-name")).toHaveText("Muhammed Rinshid VP");
  await expect(page.locator("#project-health")).toHaveText("At risk");
  await expect(page.locator("#project-health")).toHaveClass(/tone-warn/);
  // 1 done of 4 real tasks (blank one skipped)
  await expect(page.locator("#progress-percent")).toHaveText("25%");
  await expect(page.locator("#progress-count")).toHaveText("1 of 4 tasks completed");
  await expect(page).toHaveTitle("Shop App · Project Status");

  const groups = page.locator(".group-title");
  await expect(groups).toHaveCount(4);
  await expect(groups.nth(0)).toContainText("In progress");
  await expect(groups.nth(3)).toContainText("Done");
  await expect(page.locator(".due.late")).toHaveText("Due 1 Jan 2000");

  await expect(page.locator("#updates li p").first()).toHaveText("Newest update");
  await expect(page.locator("#last-updated")).toContainText("Last updated just now");
  await expect(page.locator("#refresh")).toBeVisible();

  // Sheet text is shown as text, never run as HTML.
  await expect(page.getByText("<img src=x onerror=window.__xss=1>")).toBeVisible();
  expect(await page.evaluate(() => window.__xss)).toBeUndefined();
  expect(errors).toEqual([]);
});

test("key in #hash works too", async ({ page }) => {
  await connect(page, api(SAMPLE));
  await page.goto("/#k=" + KEY);
  await expect(page.locator("#project-name")).toHaveText("Shop App");
});

test("wrong key shows link-not-valid message", async ({ page }) => {
  await connect(page, api(SAMPLE));
  await page.goto("/?k=bad");
  await expect(page.locator("#state h1")).toHaveText("Link not valid");
  await expect(page.locator("#dashboard")).toBeHidden();
});

test("missing key asks for the full link", async ({ page }) => {
  await connect(page, api(SAMPLE));
  await page.goto("/");
  await expect(page.locator("#state h1")).toHaveText("Link incomplete");
});

test("network failure offers retry, and retry recovers", async ({ page }) => {
  let fail = true;
  await connect(page, (route) => (fail ? route.abort() : api(SAMPLE)(route)));
  await page.goto("/?k=" + KEY);
  await expect(page.locator("#state h1")).toHaveText("Couldn't load status");
  fail = false;
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.locator("#project-name")).toHaveText("Shop App");
});

test("refresh button picks up sheet changes", async ({ page }) => {
  let data = SAMPLE;
  await connect(page, (route) => api(data)(route));
  await page.goto("/?k=" + KEY);
  await expect(page.locator("#progress-percent")).toHaveText("25%");
  data = { ...SAMPLE, tasks: SAMPLE.tasks.map((t) => ({ ...t, status: "Done" })) };
  await page.locator("#refresh").click();
  await expect(page.locator("#progress-percent")).toHaveText("100%");
  await expect(page.locator("#days-left")).toHaveText("Completed");
});

test("empty sheet shows friendly placeholders", async ({ page }) => {
  await connect(page, api({ project: {}, tasks: [], updates: [], lastUpdated: null }));
  await page.goto("/?k=" + KEY);
  await expect(page.locator("#project-name")).toHaveText("Project");
  await expect(page.locator("#progress-count")).toHaveText("No tasks added yet");
  await expect(page.getByText("No updates yet.")).toBeVisible();
  await expect(page.locator("#deadline")).toHaveText("—");
});

test("not configured shows setup message", async ({ page }) => {
  await page.goto("/?k=" + KEY);
  await expect(page.locator("#state h1")).toHaveText("Not connected yet");
});

test("demo mode renders and has no horizontal scroll", async ({ page }, info) => {
  await page.goto("/?demo=1");
  await expect(page.locator("#project-name")).toHaveText("Company Website Redesign");
  await expect(page.locator("#progress-percent")).toHaveText("38%");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await page.screenshot({ path: `test-results/demo-${info.project.name}.png`, fullPage: true });
});

test("page is not indexed by search engines", async ({ page }) => {
  await page.goto("/?demo=1");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
});
