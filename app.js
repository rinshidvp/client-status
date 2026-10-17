(function () {
  const config = window.STATUS_CONFIG || {};
  const L = window.StatusLib;
  const $ = (id) => document.getElementById(id);

  // Builds an element; text is always set via textContent so sheet data can't inject HTML.
  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function showState(title, message, action) {
    const box = $("state");
    box.replaceChildren();
    $("dashboard").hidden = true;
    box.hidden = false;
    box.append(el("h1", null, title), el("p", null, message));
    if (action) {
      const btn = el("button", "btn", action.label);
      btn.type = "button";
      btn.addEventListener("click", action.onClick);
      box.append(btn);
    }
  }

  function renderHeader() {
    $("owner-name").textContent = config.OWNER_NAME || "Project Status";
    const brand = $("brand");
    if (config.OWNER_LINK) brand.href = config.OWNER_LINK;
    else brand.removeAttribute("href");
  }

  function renderProject(project, progress) {
    $("project-name").textContent = project.name || "Project";
    $("client-name").textContent = project.client ? "Prepared for " + project.client : "";
    $("project-summary").textContent = project.summary || "";
    $("project-summary").hidden = !project.summary;
    document.title = (project.name ? project.name + " · " : "") + "Project Status";

    const health = $("project-health");
    health.textContent = project.status || "";
    health.className = "pill tone-" + L.healthTone(project.status);

    $("progress-percent").textContent = progress.percent + "%";
    $("progress-fill").style.width = progress.percent + "%";
    $("progress-bar").setAttribute("aria-valuenow", String(progress.percent));
    $("progress-count").textContent = progress.total
      ? progress.done + " of " + progress.total + " tasks completed"
      : "No tasks added yet";

    $("start-date").textContent = L.formatDate(project.startDate) || "—";
    $("deadline").textContent = L.formatDate(project.deadline) || "—";
    const days = L.daysUntil(project.deadline);
    const finished = progress.total > 0 && progress.done === progress.total;
    const left = $("days-left");
    left.textContent = finished ? "Completed" : L.describeDaysLeft(days) || "—";
    left.classList.toggle("overdue", !finished && days != null && days < 0);
  }

  function renderTask(task, statusKey) {
    const li = el("li", "task");
    const main = el("div");
    main.append(el("div", "task-name", task.task));
    if (task.note) main.append(el("div", "task-note", task.note));

    const meta = el("div", "task-meta");
    meta.append(el("span", "badge", String(task.status || L.STATUSES[statusKey].label)));
    if (task.dueDate && statusKey !== "done") {
      const days = L.daysUntil(task.dueDate);
      const due = el("span", "due" + (days < 0 ? " late" : ""), "Due " + L.formatDate(task.dueDate));
      meta.append(due);
    }
    li.append(main, meta);
    return li;
  }

  function renderTasks(tasks) {
    const box = $("task-groups");
    box.replaceChildren();
    const groups = L.groupTasks(tasks);
    if (!groups.length) {
      box.append(el("p", "empty", "Tasks will appear here once work is planned."));
      return;
    }
    groups.forEach((group) => {
      const section = el("div", "group s-" + group.key);
      const title = el("h3", "group-title");
      title.append(el("span", "dot"), el("span", null, group.label), el("span", "count", "· " + group.tasks.length));
      const list = el("ul", "tasks");
      group.tasks.forEach((t) => list.append(renderTask(t, group.key)));
      section.append(title, list);
      box.append(section);
    });
  }

  function renderUpdates(updates) {
    const list = $("updates");
    list.replaceChildren();
    const sorted = L.sortUpdates(updates);
    if (!sorted.length) {
      list.append(el("li", "empty", "No updates yet."));
      return;
    }
    sorted.forEach((u) => {
      const li = el("li");
      const time = el("time", null, L.formatDate(u.date));
      const d = L.parseDate(u.date);
      if (d) time.dateTime = d.toISOString();
      li.append(time, el("p", null, u.message));
      list.append(li);
    });
  }

  function render(data) {
    const tasks = (data.tasks || []).filter((t) => t && String(t.task || "").trim());
    const progress = L.computeProgress(tasks);
    renderProject(data.project || {}, progress);
    renderTasks(tasks);
    renderUpdates(data.updates || []);
    $("last-updated").textContent = data.lastUpdated
      ? "Last updated " + L.formatRelative(data.lastUpdated)
      : "";
    $("state").hidden = true;
    $("dashboard").hidden = false;
  }

  async function fetchData(key) {
    const url = config.API_URL + (config.API_URL.includes("?") ? "&" : "?") + "k=" + encodeURIComponent(key);
    const res = await fetch(url, { cache: "no-store", redirect: "follow" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    return res.json();
  }

  let loading = false;
  let hasData = false;

  async function load(key) {
    if (loading) return;
    loading = true;
    const btn = $("refresh");
    btn.disabled = true;
    try {
      const body = await fetchData(key);
      if (!body || body.ok !== true) {
        if (body && body.error === "unauthorized") {
          showState("Link not valid", "This status link is incorrect or has been changed. Please ask " + (config.OWNER_NAME || "the owner") + " for the latest link.");
        } else {
          throw new Error((body && body.error) || "Bad response");
        }
        return;
      }
      hasData = true;
      render(body.data);
      btn.hidden = false;
    } catch (err) {
      console.error(err);
      // Keep showing the last good data if a background refresh fails.
      if (!hasData) {
        showState("Couldn't load status", "Please check your internet connection and try again.", {
          label: "Try again",
          onClick: () => { showLoading(); load(key); },
        });
      }
    } finally {
      loading = false;
      btn.disabled = false;
    }
  }

  function showLoading() {
    const box = $("state");
    box.replaceChildren(el("div", "spinner"), el("p", null, "Loading project status…"));
  }

  function start() {
    renderHeader();
    const params = new URLSearchParams(location.search);

    if (params.get("demo") === "1") {
      render(window.DEMO_DATA);
      return;
    }

    const key = L.readKey(location.search, location.hash);
    if (!config.API_URL) {
      showState("Not connected yet", "This page isn't linked to a project sheet yet. Add the Apps Script URL to config.js.");
      return;
    }
    if (!key) {
      showState("Link incomplete", "This page needs the private link you were sent. Please open the full link again.");
      return;
    }

    $("refresh").addEventListener("click", () => load(key));
    load(key);
    const minutes = Number(config.REFRESH_MINUTES) || 0;
    if (minutes > 0) setInterval(() => { if (!document.hidden) load(key); }, minutes * 60000);
  }

  start();
})();
