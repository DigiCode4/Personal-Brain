(function () {
  /* ============ CONSTANTS ============ */
  const PLATFORMS = [
    {
      key: "instagram",
      label: "Instagram",
      letters: "IG",
      color: "linear-gradient(135deg,#DD2A7B,#8134AF)",
    },
    { key: "x", label: "X", letters: "X", color: "#111111" },
    { key: "tiktok", label: "TikTok", letters: "TT", color: "#111111" },
    { key: "youtube", label: "YouTube", letters: "YT", color: "#E23F3F" },
    { key: "facebook", label: "Facebook", letters: "FB", color: "#3A6FE0" },
    { key: "linkedin", label: "LinkedIn", letters: "in", color: "#2470C4" },
    { key: "github", label: "GitHub", letters: "GH", color: "#2B2B2B" },
    { key: "threads", label: "Threads", letters: "@", color: "#232323" },
    { key: "snapchat", label: "Snapchat", letters: "SC", color: "#E5C700" },
    { key: "custom", label: "Custom", letters: "🔗", color: "#55677A" },
  ];
  const LABELS = [
    { key: "personal", name: "Personal", color: "#3E5A45" },
    { key: "work", name: "Work", color: "#55677A" },
    { key: "important", name: "Important", color: "#A8562E" },
    { key: "health", name: "Health", color: "#8A4B9E" },
    { key: "other", name: "Other", color: "#7A7A72" },
  ];
  const ACCENTS = ["#3E5A45", "#A8562E", "#55677A", "#8A4B9E", "#23261F"];
  const BLOCK_TYPES = [
    { type: "paragraph", label: "Text", icon: "¶", cat: "Basic" },
    { type: "h1", label: "Heading 1", icon: "H1", cat: "Basic" },
    { type: "h2", label: "Heading 2", icon: "H2", cat: "Basic" },
    { type: "h3", label: "Heading 3", icon: "H3", cat: "Basic" },
    { type: "bulleted", label: "Bulleted list", icon: "•", cat: "Basic" },
    { type: "numbered", label: "Numbered list", icon: "1.", cat: "Basic" },
    { type: "checklist", label: "To-do checklist", icon: "☑", cat: "Basic" },
    { type: "toggle", label: "Toggle list", icon: "▸", cat: "Basic" },
    { type: "quote", label: "Quote", icon: '"', cat: "Basic" },
    { type: "callout", label: "Callout", icon: "✦", cat: "Basic" },
    { type: "divider", label: "Divider", icon: "—", cat: "Basic" },
    { type: "subpage", label: "Subpage", icon: "📄", cat: "Advanced" },
    {
      type: "database",
      label: "Database (inline)",
      icon: "🗄️",
      cat: "Advanced",
    },
    { type: "page-link", label: "Link to page", icon: "↪", cat: "Advanced" },
    { type: "image", label: "Image (URL)", icon: "▧", cat: "Media" },
  ];
  const PRIORITIES = {
    high: { label: "High", color: "#B04A3F" },
    medium: { label: "Medium", color: "#A8562E" },
    low: { label: "Low", color: "#55677A" },
  };
  const FOCUS_DURATIONS = { focus: 25 * 60, break: 5 * 60 };
  const STATUS_META = {
    "not-started": { label: "Not started", color: "#7A7A72" },
    "in-progress": { label: "In progress", color: "#A8562E" },
    done: { label: "Done", color: "#3E5A45" },
  };
  const STATUS_ORDER = ["not-started", "in-progress", "done"];
  const WIDGET_LABELS = {
    links: "Quick links",
    tasks: "Tasks",
    agenda: "Today's agenda",
    focus: "Focus timer",
    notes: "Recent notes",
    minical: "Mini calendar",
    connections: "Connections",
    stats: "Overview",
  };

  const uid = () =>
    Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  const pad2 = (n) => String(n).padStart(2, "0");
  const isoDate = (d) =>
    d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
  const todayISO = () => isoDate(new Date());
  const escapeHtml = (s) =>
    (s || "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const labelOf = (key) =>
    LABELS.find((l) => l.key === key) || LABELS[LABELS.length - 1];

  let state = { links: [], notes: [], events: [], tasks: [], settings: null };
  let activeNoteId = null;
  let activeTaskId = null;
  let editingEventId = null;
  let expandedTreeIds = new Set();
  let calYear, calMonth;
  let calView = "month";
  let weekAnchor = new Date();
  let miniYear, miniMonth;
  let selectedPlatform = PLATFORMS[0];
  let selectedEventLabel = LABELS[0].key;
  let pendingWidgetDraft = null;
  let focusState = {
    mode: "focus",
    secondsLeft: FOCUS_DURATIONS.focus,
    running: false,
    timerId: null,
  };
  let notifiedReminders = new Set();

  function defaultSettings() {
    return {
      name: "",
      accent: ACCENTS[0],
      theme: "light",
      widgetOrder: [
        "links",
        "tasks",
        "agenda",
        "focus",
        "notes",
        "minical",
        "connections",
        "stats",
      ],
      widgetVisible: {
        links: true,
        tasks: true,
        agenda: true,
        focus: true,
        notes: true,
        minical: true,
        connections: true,
        stats: true,
      },
      hiddenLabels: [],
      focusDate: "",
      focusCount: 0,
    };
  }
  function mergeSettings(saved) {
    const d = defaultSettings();
    const merged = Object.assign({}, d, saved || {});
    merged.widgetVisible = Object.assign(
      {},
      d.widgetVisible,
      (saved && saved.widgetVisible) || {},
    );
    const order = ((saved && saved.widgetOrder) || []).slice();
    d.widgetOrder.forEach((id) => {
      if (!order.includes(id)) order.push(id);
    });
    merged.widgetOrder = order;
    merged.hiddenLabels = (saved && saved.hiddenLabels) || [];
    return merged;
  }

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel, root) =>
    Array.from((root || document).querySelectorAll(sel));

  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove("show"), 1800);
  }

  /* ============ STORAGE ============ */
  const STORAGE_PREFIX = "basecamp:";
  const storage =
    typeof window.storage !== "undefined"
      ? window.storage
      : {
          async get(key) {
            const raw = localStorage.getItem(STORAGE_PREFIX + key);
            if (raw === null) throw new Error("missing key");
            return { key, value: raw };
          },
          async set(key, value) {
            localStorage.setItem(STORAGE_PREFIX + key, value);
            return { key, value };
          },
          async delete(key) {
            localStorage.removeItem(STORAGE_PREFIX + key);
            return { key, deleted: true };
          },
          async list(prefix) {
            const keys = Object.keys(localStorage)
              .filter((k) => k.startsWith(STORAGE_PREFIX))
              .map((k) => k.slice(STORAGE_PREFIX.length))
              .filter((k) => !prefix || k.startsWith(prefix));
            return { keys };
          },
        };
  const usingLocalStorage = typeof window.storage === "undefined";

  async function loadState() {
    for (const key of ["links", "notes", "events", "tasks", "settings"]) {
      try {
        const res = await storage.get(key, false);
        if (res && res.value) {
          state[key] = JSON.parse(res.value);
        }
      } catch (e) {
        /* not present yet */
      }
    }
    state.settings = mergeSettings(state.settings);
    state.notes.forEach((n) => {
      if (!n.blocks) {
        n.blocks = [
          {
            id: uid(),
            type: "paragraph",
            text: n.body ? stripHtml(n.body) : "",
          },
        ];
      }
      if (!n.icon) n.icon = "📄";
      if (!n.properties) n.properties = { status: "not-started", tags: [] };
      if (n.pinned === undefined) n.pinned = false;
      if (!n.type) n.type = "page";
      if (n.parentId === undefined) n.parentId = null;
      if (!n.customProperties) n.customProperties = [];
      if (n.propValues === undefined) n.propValues = {};
    });
    if (!Array.isArray(state.tasks)) state.tasks = [];
    state.tasks.forEach((t) => {
      if (t.linkedNoteId === undefined) t.linkedNoteId = null;
      if (!t.blocks) t.blocks = [{ id: uid(), type: "paragraph", text: "" }];
    });
    state.events.forEach((e) => {
      if (e.linkedNoteId === undefined) e.linkedNoteId = null;
      if (e.description === undefined) e.description = "";
      if (!Array.isArray(e.participants)) e.participants = [];
      if (!Array.isArray(e.links)) e.links = [];
      if (e.reminderMinutes === undefined) e.reminderMinutes = "";
    });
  }
  function stripHtml(html) {
    const d = document.createElement("div");
    d.innerHTML = html;
    return d.textContent.trim();
  }
  async function saveKey(key) {
    try {
      await storage.set(key, JSON.stringify(state[key]), false);
    } catch (e) {
      console.error("save failed", key, e);
      toast("Couldn't save — try again");
    }
  }

  /* ============ THEME / ACCENT ============ */
  function applyTheme() {
    document.body.setAttribute("data-theme", state.settings.theme);
    $("#themeToggle .knob").textContent =
      state.settings.theme === "dark" ? "☀" : "☾";
    document.documentElement.style.setProperty(
      "--accent",
      state.settings.accent,
    );
    document.documentElement.style.setProperty(
      "--accent-soft",
      hexToSoft(state.settings.accent, state.settings.theme),
    );
  }
  function hexToSoft(hex, theme) {
    const r = parseInt(hex.slice(1, 3), 16),
      g = parseInt(hex.slice(3, 5), 16),
      b = parseInt(hex.slice(5, 7), 16);
    const mix = theme === "dark" ? 0.22 : 0.16;
    const bg = theme === "dark" ? [27, 28, 24] : [251, 250, 246];
    return `rgb(${Math.round(r * mix + bg[0] * (1 - mix))},${Math.round(g * mix + bg[1] * (1 - mix))},${Math.round(b * mix + bg[2] * (1 - mix))})`;
  }
  function initThemeToggle() {
    $("#themeToggle").addEventListener("click", () => {
      state.settings.theme = state.settings.theme === "dark" ? "light" : "dark";
      applyTheme();
      saveKey("settings");
    });
  }

  /* ============ NAV / HEADER ============ */
  function initNav() {
    $$(".rail-btn[data-view]").forEach((btn) =>
      btn.addEventListener("click", () => switchToView(btn.dataset.view)),
    );
  }
  function initHeader() {
    const now = new Date(),
      hour = now.getHours();
    const greetWord =
      hour < 12
        ? "Good morning"
        : hour < 18
          ? "Good afternoon"
          : "Good evening";
    $("#greeting").textContent = greetWord;
    $("#todayLine").textContent = now.toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
    $("#clockFoot").textContent = now.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
    $("#clockFoot").title = usingLocalStorage
      ? "Data is saved in this browser (localStorage)"
      : "Data is saved to this artifact";
  }
  function updateGreeting() {
    const w = $("#greeting").textContent.split(",")[0] || "Welcome back";
    $("#greeting").textContent = state.settings.name
      ? `${w}, ${state.settings.name}`
      : w;
  }

  /* ============ HOME WIDGETS ============ */
  function renderHome() {
    const container = $("#homeWidgets");
    container.innerHTML = "";
    state.settings.widgetOrder.forEach((id) => {
      if (!state.settings.widgetVisible[id]) return;
      const wrap = document.createElement("section");
      wrap.className = "home-widget";
      if (id === "links") {
        wrap.innerHTML = `<div class="section-label">Quick links</div><div class="link-grid" id="linkGrid"></div>`;
      } else if (id === "agenda") {
        wrap.innerHTML = `<div class="section-label">Today's agenda</div><div class="card" id="agendaCard"></div>`;
      } else if (id === "notes") {
        wrap.innerHTML = `<div class="section-label">Recent notes</div><div class="card" id="recentNotesCard"></div>`;
      } else if (id === "minical") {
        wrap.innerHTML = `<div class="section-label">Mini calendar</div><div class="card" id="miniCalCard"></div>`;
      } else if (id === "tasks") {
        wrap.innerHTML = `<div class="section-label">Tasks</div><div class="card" id="taskWidgetCard"></div>`;
      } else if (id === "focus") {
        wrap.innerHTML = `<div class="section-label">Focus timer</div><div class="card" id="focusCard"></div>`;
      } else if (id === "connections") {
        wrap.innerHTML = `<div class="section-label">Connections</div><div class="card" id="connectionsCard"></div>`;
      } else if (id === "stats") {
        wrap.innerHTML = `<div class="section-label">Overview</div><div class="card" id="statsCard"></div>`;
      }
      container.appendChild(wrap);
    });
    if (state.settings.widgetVisible.links) renderLinks();
    if (state.settings.widgetVisible.agenda) renderAgenda();
    if (state.settings.widgetVisible.notes) renderRecentNotes();
    if (state.settings.widgetVisible.minical) renderMiniCal();
    if (state.settings.widgetVisible.tasks) renderTaskWidget();
    if (state.settings.widgetVisible.focus) renderFocusWidget();
    if (state.settings.widgetVisible.connections) renderConnectionsWidget();
    if (state.settings.widgetVisible.stats) renderStatsWidget();
  }

  function renderLinks() {
    const grid = $("#linkGrid");
    if (!grid) return;
    grid.innerHTML = "";
    state.links.forEach((link) => {
      const a = document.createElement("a");
      a.className = "link-card";
      a.href = link.url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.innerHTML = `<div class="link-remove" data-id="${link.id}" title="Remove">✕</div>
        <div class="link-badge" style="background:${link.color}">${escapeHtml(link.letters)}</div>
        <div class="link-label">${escapeHtml(link.label)}</div>`;
      grid.appendChild(a);
    });
    const addCard = document.createElement("button");
    addCard.className = "link-card link-add";
    addCard.innerHTML = `<div class="link-badge">+</div><div class="link-label">Add link</div>`;
    addCard.addEventListener("click", openLinkModal);
    grid.appendChild(addCard);
    $$(".link-remove").forEach((el) =>
      el.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        state.links = state.links.filter((l) => l.id !== el.dataset.id);
        saveKey("links");
        renderLinks();
      }),
    );
  }
  function openLinkModal() {
    selectedPlatform = PLATFORMS[0];
    $("#linkLabelInput").value = PLATFORMS[0].label;
    $("#linkUrlInput").value = "";
    renderPlatformGrid();
    $("#linkOverlay").classList.add("open");
    $("#linkLabelInput").focus();
  }
  function renderPlatformGrid() {
    const grid = $("#platformGrid");
    grid.innerHTML = "";
    PLATFORMS.forEach((p) => {
      const opt = document.createElement("div");
      opt.className =
        "platform-opt" + (p.key === selectedPlatform.key ? " sel" : "");
      opt.innerHTML = `<div class="b" style="background:${p.color}">${escapeHtml(p.letters)}</div><div class="l">${p.label}</div>`;
      opt.addEventListener("click", () => {
        selectedPlatform = p;
        if (
          $("#linkLabelInput").value === "" ||
          PLATFORMS.some((pl) => pl.label === $("#linkLabelInput").value)
        ) {
          $("#linkLabelInput").value = p.label === "Custom" ? "" : p.label;
        }
        renderPlatformGrid();
      });
      grid.appendChild(opt);
    });
  }
  function initLinkModal() {
    $("#linkCancel").addEventListener("click", () =>
      $("#linkOverlay").classList.remove("open"),
    );
    $("#linkOverlay").addEventListener("click", (e) => {
      if (e.target.id === "linkOverlay")
        $("#linkOverlay").classList.remove("open");
    });
    $("#linkSave").addEventListener("click", () => {
      const label = $("#linkLabelInput").value.trim();
      let url = $("#linkUrlInput").value.trim();
      if (!label || !url) {
        toast("Add a label and a URL");
        return;
      }
      if (!/^https?:\/\//i.test(url)) url = "https://" + url;
      state.links.push({
        id: uid(),
        label,
        url,
        letters: selectedPlatform.letters,
        color: selectedPlatform.color,
      });
      saveKey("links");
      renderLinks();
      $("#linkOverlay").classList.remove("open");
      toast("Link added");
    });
  }

  function renderAgenda() {
    const card = $("#agendaCard");
    if (!card) return;
    const t = todayISO();
    const todays = visibleEvents()
      .filter((e) => e.date === t)
      .sort((a, b) => (a.time || "99:99").localeCompare(b.time || "99:99"));
    if (todays.length === 0) {
      card.innerHTML = `<div class="empty">Nothing on the calendar today. Enjoy the quiet.</div>`;
      return;
    }
    card.innerHTML = todays
      .map(
        (e) => `
      <div class="agenda-item" data-open-event="${e.id}" style="cursor:pointer;">
        <div class="agenda-time">${e.time ? formatTime(e.time) : "All day"}</div>
        <div class="agenda-dot" style="background:${labelOf(e.label).color}"></div>
        <div class="agenda-title">${escapeHtml(e.title)}${e.linkedNoteId ? noteChip(e.linkedNoteId) : ""}</div>
      </div>`,
      )
      .join("");
    $$("[data-open-event]", card).forEach((el) =>
      el.addEventListener("click", (e) => {
        if (e.target.closest("[data-open-note]")) return;
        openEventModal(null, null, el.dataset.openEvent);
      }),
    );
    wireNoteChips(card);
  }
  function formatTime(t) {
    const [h, m] = t.split(":").map(Number);
    const period = h >= 12 ? "PM" : "AM";
    const hr = h % 12 === 0 ? 12 : h % 12;
    return `${hr}:${pad2(m)} ${period}`;
  }
  function visibleEvents() {
    return state.events.filter(
      (e) => !state.settings.hiddenLabels.includes(e.label || "other"),
    );
  }

  function renderRecentNotes() {
    const card = $("#recentNotesCard");
    if (!card) return;
    const pinned = state.notes
      .filter((n) => n.pinned)
      .sort((a, b) => b.updated - a.updated);
    const rest = state.notes
      .filter((n) => !n.pinned)
      .sort((a, b) => b.updated - a.updated);
    const recent = [...pinned, ...rest].slice(0, 5);
    if (recent.length === 0) {
      card.innerHTML = `<div class="empty">No notes yet — start one from the Notes tab.</div>`;
      return;
    }
    card.innerHTML = recent
      .map(
        (n) => `
      <div class="note-row" data-id="${n.id}">
        <div><div class="note-title">${n.pinned ? "📌 " : ""}${escapeHtml(n.icon || "📄")} ${escapeHtml(n.title || "Untitled")}</div>
        <div class="note-snip">${escapeHtml(snippetOf(n))}</div></div>
        <div class="note-date">${relativeDate(n.updated)}</div>
      </div>`,
      )
      .join("");
    $$("#recentNotesCard .note-row").forEach((row) =>
      row.addEventListener("click", () => {
        switchToView("notes");
        openNote(row.dataset.id);
      }),
    );
  }
  function snippetOf(note) {
    const first = (note.blocks || []).find((b) => b.text && b.text.trim());
    return first ? first.text.slice(0, 60) : "Empty page";
  }
  function relativeDate(ts) {
    const diff = Date.now() - ts,
      day = 86400000;
    if (diff < day) return "Today";
    if (diff < 2 * day) return "Yesterday";
    return new Date(ts).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  }

  function renderMiniCal() {
    const card = $("#miniCalCard");
    if (!card) return;
    const first = new Date(miniYear, miniMonth, 1);
    const startDow = first.getDay();
    const daysInMonth = new Date(miniYear, miniMonth + 1, 0).getDate();
    const t = todayISO();
    let html = `<div class="mini-cal-head">
      <button class="icon-btn" id="miniPrev" style="width:24px;height:24px;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px;"><path d="M15 6l-6 6 6 6"/></svg></button>
      <span>${first.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</span>
      <button class="icon-btn" id="miniNext" style="width:24px;height:24px;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px;"><path d="M9 6l6 6-6 6"/></svg></button>
    </div><div class="mini-cal-grid">`;
    ["S", "M", "T", "W", "T", "F", "S"].forEach(
      (d) => (html += `<div class="dow">${d}</div>`),
    );
    for (let i = 0; i < startDow; i++)
      html += `<div class="mini-cal-day pad"></div>`;
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = miniYear + "-" + pad2(miniMonth + 1) + "-" + pad2(d);
      const hasEvt = visibleEvents().some((e) => e.date === dateStr);
      html += `<div class="mini-cal-day${dateStr === t ? " today" : ""}" data-date="${dateStr}">${d}${hasEvt ? '<div class="evt-dot"></div>' : ""}</div>`;
    }
    html += `</div>`;
    card.innerHTML = html;
    $("#miniPrev").addEventListener("click", () => {
      miniMonth--;
      if (miniMonth < 0) {
        miniMonth = 11;
        miniYear--;
      }
      renderMiniCal();
    });
    $("#miniNext").addEventListener("click", () => {
      miniMonth++;
      if (miniMonth > 11) {
        miniMonth = 0;
        miniYear++;
      }
      renderMiniCal();
    });
    $$(".mini-cal-day[data-date]").forEach((el) =>
      el.addEventListener("click", () => {
        const d = new Date(el.dataset.date + "T00:00:00");
        calYear = d.getFullYear();
        calMonth = d.getMonth();
        weekAnchor = d;
        calView = "month";
        switchToView("calendar");
        $$("#viewSeg button").forEach((b) =>
          b.classList.toggle("active", b.dataset.v === "month"),
        );
        $("#monthWrap").style.display = "";
        $("#weekWrap").style.display = "none";
        renderCalendarView();
      }),
    );
  }

  /* ============ TASKS ============ */
  function taskDueInfo(task) {
    if (!task.due) return { text: "No date", cls: "" };
    const t = todayISO();
    if (task.due < t)
      return { text: "Overdue · " + shortDate(task.due), cls: "overdue" };
    if (task.due === t) return { text: "Today", cls: "today" };
    return { text: shortDate(task.due), cls: "" };
  }
  function shortDate(iso) {
    const d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  function toggleTask(id) {
    const task = state.tasks.find((t) => t.id === id);
    if (!task) return;
    task.done = !task.done;
    task.updated = Date.now();
    saveKey("tasks");
    renderTaskWidget();
    renderTasksView();
  }
  function deleteTask(id) {
    state.tasks = state.tasks.filter((t) => t.id !== id);
    saveKey("tasks");
    renderTaskWidget();
    renderTasksView();
  }
  function addTaskFrom(title, due, priority, linkedNoteId) {
    title = (title || "").trim();
    if (!title) return;
    state.tasks.push({
      id: uid(),
      title,
      due: due || "",
      priority: priority || "medium",
      done: false,
      updated: Date.now(),
      linkedNoteId: linkedNoteId || null,
      blocks: [{ id: uid(), type: "paragraph", text: "" }],
    });
    saveKey("tasks");
    renderTaskWidget();
    renderTasksView();
    renderHome();
  }

  function noteChip(noteId) {
    const n = state.notes.find((x) => x.id === noteId);
    if (!n) return "";
    return `<span class="small-link-icon" data-open-note="${n.id}" title="Linked to ${escapeHtml(n.title || "Untitled")}">🔗 ${escapeHtml(n.title || "Untitled")}</span>`;
  }
  function wireNoteChips(container) {
    $$("[data-open-note]", container).forEach((el) =>
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        switchToView("notes");
        openNote(el.dataset.openNote);
      }),
    );
  }

  function taskRowHtml(task) {
    const info = taskDueInfo(task);
    return `<div class="task-row${task.done ? " done" : ""}" data-id="${task.id}">
      <div class="task-box${task.done ? " checked" : ""}">${task.done ? "✓" : ""}</div>
      <div class="task-body" data-open-task="${task.id}" style="cursor:pointer;">
        <div class="task-title">${escapeHtml(task.title || "Untitled task")}</div>
        <div class="task-meta-row">
          <div class="task-pri-dot" style="background:${PRIORITIES[task.priority || "medium"].color}"></div>
          <div class="task-due ${info.cls}">${info.text}</div>
          ${task.linkedNoteId ? noteChip(task.linkedNoteId) : ""}
        </div>
      </div>
      <button class="task-del" data-del="${task.id}">✕</button>
    </div>`;
  }
  function wireTaskRows(container) {
    $$(".task-box", container).forEach((box) =>
      box.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleTask(box.closest(".task-row").dataset.id);
      }),
    );
    $$("[data-del]", container).forEach((btn) =>
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        deleteTask(btn.dataset.del);
      }),
    );
    $$("[data-open-task]", container).forEach((el) =>
      el.addEventListener("click", (e) => {
        if (e.target.closest("[data-open-note]")) return;
        openTaskDetail(el.dataset.openTask);
      }),
    );
    wireNoteChips(container);
  }

  function populateNoteSelect(sel, placeholder) {
    if (!sel) return;
    const current = sel.value;
    sel.innerHTML =
      `<option value="">${placeholder}</option>` +
      state.notes
        .map(
          (n) =>
            `<option value="${n.id}">${escapeHtml(n.icon || "📄")} ${escapeHtml(n.title || "Untitled")}</option>`,
        )
        .join("");
    if (state.notes.some((n) => n.id === current)) sel.value = current;
  }

  function renderTaskWidget() {
    const card = $("#taskWidgetCard");
    if (!card) return;
    const open = state.tasks
      .filter((x) => !x.done)
      .sort((a, b) =>
        (a.due || "9999-99-99").localeCompare(b.due || "9999-99-99"),
      );
    const top = open.slice(0, 5);
    let html = "";
    if (top.length === 0) {
      html += `<div class="empty">No open tasks — nice and clear.</div>`;
    } else {
      html += top
        .map(
          (task) =>
            `<div class="task-widget-row" data-id="${task.id}"><div class="task-box" data-id2="${task.id}"></div><div data-open-task="${task.id}" style="cursor:pointer;"><div class="task-title" style="font-size:13px;">${escapeHtml(task.title || "Untitled task")}</div><div class="task-due ${taskDueInfo(task).cls}" style="font-size:11px;">${taskDueInfo(task).text}${task.linkedNoteId ? noteChip(task.linkedNoteId) : ""}</div></div></div>`,
        )
        .join("");
    }
    html += `<div class="task-widget-quick"><input type="text" id="quickTaskInput" placeholder="Quick add a task…"></div>`;
    card.innerHTML = html;
    $$("[data-id2]", card).forEach((box) =>
      box.addEventListener("click", () => toggleTask(box.dataset.id2)),
    );
    $$("[data-open-task]", card).forEach((el) =>
      el.addEventListener("click", (e) => {
        if (e.target.closest("[data-open-note]")) return;
        openTaskDetail(el.dataset.openTask);
      }),
    );
    wireNoteChips(card);
    const qi = $("#quickTaskInput");
    if (qi)
      qi.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && qi.value.trim()) {
          addTaskFrom(qi.value, "", "medium", null);
          qi.value = "";
        }
      });
  }

  function renderTasksView() {
    const wrap = $("#tasksContainer");
    if (!wrap) return;
    const t = todayISO();
    const open = state.tasks.filter((x) => !x.done);
    const done = state.tasks.filter((x) => x.done);
    const overdue = open.filter((x) => x.due && x.due < t);
    const today = open.filter((x) => x.due === t);
    const upcoming = open.filter((x) => x.due && x.due > t);
    const noDate = open.filter((x) => !x.due);
    let html = "";
    const section = (title, list) => {
      if (list.length === 0) return "";
      return `<div class="task-section"><div class="task-section-title">${title} · ${list.length}</div>${list.map(taskRowHtml).join("")}</div>`;
    };
    html += section("Overdue", overdue);
    html += section("Today", today);
    html += section("Upcoming", upcoming);
    html += section("No date", noDate);
    if (open.length === 0 && done.length === 0) {
      html = `<div class="empty">No tasks yet — add one above, or create a full task page.</div>`;
    }
    if (done.length > 0) {
      html += `<div class="collapsible-toggle" id="toggleCompleted">Show completed (${done.length})</div><div class="task-section" id="completedSection" style="display:none; margin-top:10px;">${done.map(taskRowHtml).join("")}</div>`;
    }
    wrap.innerHTML = html;
    wireTaskRows(wrap);
    const ct = $("#toggleCompleted");
    if (ct)
      ct.addEventListener("click", () => {
        const sec = $("#completedSection");
        const showing = sec.style.display !== "none";
        sec.style.display = showing ? "none" : "";
        ct.textContent = showing
          ? `Show completed (${done.length})`
          : `Hide completed (${done.length})`;
      });
  }

  function initTasks() {
    $("#taskAddBtn").addEventListener("click", submitTaskForm);
    $("#taskTitleInput").addEventListener("keydown", (e) => {
      if (e.key === "Enter") submitTaskForm();
    });
    $("#newTaskPageBtn").addEventListener("click", () => {
      const task = {
        id: uid(),
        title: "",
        due: "",
        priority: "medium",
        done: false,
        updated: Date.now(),
        linkedNoteId: null,
        blocks: [{ id: uid(), type: "paragraph", text: "" }],
      };
      state.tasks.push(task);
      saveKey("tasks");
      renderTasksView();
      renderTaskWidget();
      openTaskDetail(task.id);
    });
    populateNoteSelect($("#taskLinkSelect"), "Link to note…");
    renderTasksView();
  }
  function submitTaskForm() {
    const title = $("#taskTitleInput").value;
    const due = $("#taskDueInput").value;
    const priority = $("#taskPriorityInput").value;
    const linkedNoteId = $("#taskLinkSelect").value || null;
    if (!title.trim()) return;
    addTaskFrom(title, due, priority, linkedNoteId);
    $("#taskTitleInput").value = "";
    $("#taskDueInput").value = "";
    $("#taskLinkSelect").value = "";
    $("#taskTitleInput").focus();
  }

  /* ============ TASK DETAIL PAGE ============ */
  function taskCtx(task) {
    return {
      blocks: task.blocks,
      touch: () => touchTask(task),
      containerId: "taskBlocks",
      slashMenuId: "taskSlashMenu",
      blockMenuId: "taskBlockMenu",
      rootSelector: "#taskDetailOverlay .modal",
      currentNote: () => null,
    };
  }
  function touchTask(task) {
    task.updated = Date.now();
    debounceSaveTasks();
  }
  let taskSaveTimer = null;
  function debounceSaveTasks() {
    clearTimeout(taskSaveTimer);
    taskSaveTimer = setTimeout(() => {
      saveKey("tasks");
      renderTaskWidget();
      renderTasksView();
      renderHome();
    }, 500);
  }

  function openTaskDetail(id) {
    activeTaskId = id;
    const task = state.tasks.find((t) => t.id === id);
    if (!task) return;
    $("#taskDetailTitle").value = task.title;
    $("#taskDetailDue").value = task.due || "";
    $("#taskDetailPriority").value = task.priority || "medium";
    renderTaskDetailStatus(task);
    populateNoteSelect($("#taskDetailLinkSelect"), "None");
    $("#taskDetailLinkSelect").value = task.linkedNoteId || "";
    renderBlocksX(taskCtx(task));
    $("#taskDetailOverlay").classList.add("open");
  }
  function renderTaskDetailStatus(task) {
    const pill = $("#taskDetailStatusPill");
    pill.innerHTML = `<div class="d" style="background:${task.done ? "#3E5A45" : "#7A7A72"}"></div>${task.done ? "Done" : "Not done"}`;
  }
  function closeTaskDetail() {
    $("#taskDetailOverlay").classList.remove("open");
    activeTaskId = null;
  }
  function initTaskDetailModal() {
    $("#taskDetailTitle").addEventListener("input", (e) => {
      const task = state.tasks.find((t) => t.id === activeTaskId);
      if (!task) return;
      task.title = e.target.value;
      touchTask(task);
    });
    $("#taskDetailDue").addEventListener("change", (e) => {
      const task = state.tasks.find((t) => t.id === activeTaskId);
      if (!task) return;
      task.due = e.target.value;
      touchTask(task);
    });
    $("#taskDetailPriority").addEventListener("change", (e) => {
      const task = state.tasks.find((t) => t.id === activeTaskId);
      if (!task) return;
      task.priority = e.target.value;
      touchTask(task);
    });
    $("#taskDetailStatusPill").addEventListener("click", () => {
      const task = state.tasks.find((t) => t.id === activeTaskId);
      if (!task) return;
      task.done = !task.done;
      touchTask(task);
      renderTaskDetailStatus(task);
    });
    $("#taskDetailLinkSelect").addEventListener("change", (e) => {
      const task = state.tasks.find((t) => t.id === activeTaskId);
      if (!task) return;
      task.linkedNoteId = e.target.value || null;
      touchTask(task);
    });
    $("#taskDetailClose").addEventListener("click", closeTaskDetail);
    $("#taskDetailOverlay").addEventListener("click", (e) => {
      if (e.target.id === "taskDetailOverlay") closeTaskDetail();
    });
    $("#taskDetailDelete").addEventListener("click", () => {
      if (!activeTaskId) return;
      deleteTask(activeTaskId);
      closeTaskDetail();
    });
  }

  /* ============ FOCUS TIMER ============ */
  function todaysFocusSessions() {
    return state.settings.focusDate === todayISO()
      ? state.settings.focusCount || 0
      : 0;
  }
  function incrementFocusCount() {
    if (state.settings.focusDate !== todayISO()) {
      state.settings.focusDate = todayISO();
      state.settings.focusCount = 0;
    }
    state.settings.focusCount = (state.settings.focusCount || 0) + 1;
    saveKey("settings");
  }
  function renderFocusWidget() {
    const card = $("#focusCard");
    if (!card) return;
    const total = FOCUS_DURATIONS[focusState.mode];
    const pct = Math.round(((total - focusState.secondsLeft) / total) * 100);
    const mm = Math.floor(focusState.secondsLeft / 60),
      ss = focusState.secondsLeft % 60;
    card.innerHTML = `
      <div class="focus-ring" style="--pct:${pct}%">
        <div class="focus-ring-inner"><div class="focus-time">${pad2(mm)}:${pad2(ss)}</div><div class="focus-mode">${focusState.mode}</div></div>
      </div>
      <div class="focus-mode-switch">
        <button data-m="focus" class="${focusState.mode === "focus" ? "active" : ""}">Focus</button>
        <button data-m="break" class="${focusState.mode === "break" ? "active" : ""}">Break</button>
      </div>
      <div class="focus-controls">
        <button class="btn primary" id="focusToggleBtn">${focusState.running ? "Pause" : "Start"}</button>
        <button class="btn ghost" id="focusResetBtn">Reset</button>
      </div>
      <div class="focus-stat">${todaysFocusSessions()} focus session${todaysFocusSessions() === 1 ? "" : "s"} today</div>
    `;
    $("#focusToggleBtn").addEventListener("click", toggleFocusTimer);
    $("#focusResetBtn").addEventListener("click", resetFocusTimer);
    $$(".focus-mode-switch button", card).forEach((b) =>
      b.addEventListener("click", () => {
        if (focusState.running) return;
        focusState.mode = b.dataset.m;
        focusState.secondsLeft = FOCUS_DURATIONS[focusState.mode];
        renderFocusWidget();
      }),
    );
  }
  function toggleFocusTimer() {
    focusState.running = !focusState.running;
    if (focusState.running) {
      focusState.timerId = setInterval(() => {
        focusState.secondsLeft--;
        if (focusState.secondsLeft <= 0) {
          if (focusState.mode === "focus") {
            incrementFocusCount();
            toast("Focus session complete — take a break");
            focusState.mode = "break";
          } else {
            toast("Break over — back to focus");
            focusState.mode = "focus";
          }
          focusState.secondsLeft = FOCUS_DURATIONS[focusState.mode];
        }
        renderFocusWidget();
      }, 1000);
    } else {
      clearInterval(focusState.timerId);
    }
    renderFocusWidget();
  }
  function resetFocusTimer() {
    clearInterval(focusState.timerId);
    focusState.running = false;
    focusState.secondsLeft = FOCUS_DURATIONS[focusState.mode];
    renderFocusWidget();
  }

  /* ============ SEARCH ============ */
  function openSearch() {
    $("#searchOverlay").classList.add("open");
    $("#searchInput").value = "";
    renderSearchResults("");
    setTimeout(() => $("#searchInput").focus(), 30);
  }
  function closeSearch() {
    $("#searchOverlay").classList.remove("open");
  }
  function renderSearchResults(query) {
    const q = query.trim().toLowerCase();
    const results = $("#searchResults");
    const notesMatch = state.notes
      .filter(
        (n) =>
          !q ||
          (n.title || "").toLowerCase().includes(q) ||
          snippetOf(n).toLowerCase().includes(q),
      )
      .slice(0, 6);
    const tasksMatch = state.tasks
      .filter((t) => !q || t.title.toLowerCase().includes(q))
      .slice(0, 6);
    if (notesMatch.length === 0 && tasksMatch.length === 0) {
      results.innerHTML = `<div class="search-empty">No matches yet — keep typing.</div>`;
      return;
    }
    let html = "";
    notesMatch.forEach(
      (n) =>
        (html += `<div class="search-item" data-type="note" data-id="${n.id}"><div class="sic">${escapeHtml(n.icon || "📄")}</div><div><div class="stt">${escapeHtml(n.title || "Untitled")}</div><div class="ssub">${escapeHtml(snippetOf(n))}</div></div></div>`),
    );
    tasksMatch.forEach(
      (t) =>
        (html += `<div class="search-item" data-type="task" data-id="${t.id}"><div class="sic">☑</div><div><div class="stt">${escapeHtml(t.title)}</div><div class="ssub">${taskDueInfo(t).text}${t.done ? " · done" : ""}</div></div></div>`),
    );
    results.innerHTML = html;
    $$(".search-item", results).forEach((item) =>
      item.addEventListener("click", () => {
        closeSearch();
        if (item.dataset.type === "note") {
          switchToView("notes");
          openNote(item.dataset.id);
        } else {
          switchToView("tasks");
        }
      }),
    );
  }
  function switchToView(view) {
    $$(".rail-btn").forEach((b) => b.classList.remove("active"));
    const btn = $(`.rail-btn[data-view="${view}"]`);
    if (btn) btn.classList.add("active");
    $$(".view").forEach((v) => v.classList.remove("active"));
    $("#view-" + view).classList.add("active");
    if (view === "calendar") renderCalendarView();
    if (view === "tasks")
      populateNoteSelect($("#taskLinkSelect"), "Link to note…");
  }
  function initSearch() {
    $("#searchNavBtn").addEventListener("click", openSearch);
    $("#searchOverlay").addEventListener("click", (e) => {
      if (e.target.id === "searchOverlay") closeSearch();
    });
    $("#searchInput").addEventListener("input", (e) =>
      renderSearchResults(e.target.value),
    );
    document.addEventListener("keydown", (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        openSearch();
      } else if (e.key === "Escape") {
        closeSearch();
      }
    });
  }

  /* ============ CONNECTIONS + OVERVIEW ============ */
  function renderConnectionsWidget() {
    const card = $("#connectionsCard");
    if (!card) return;
    const linkedNotes = state.notes
      .filter(
        (n) =>
          state.tasks.some((t) => t.linkedNoteId === n.id) ||
          state.events.some((e) => e.linkedNoteId === n.id),
      )
      .sort((a, b) => b.updated - a.updated)
      .slice(0, 5);
    if (linkedNotes.length === 0) {
      card.innerHTML = `<div class="empty">Nothing linked yet — open a note and use "+ link" to connect a task or event.</div>`;
      return;
    }
    card.innerHTML = linkedNotes
      .map((n) => {
        const lt = state.tasks.filter((t) => t.linkedNoteId === n.id);
        const le = state.events.filter((e) => e.linkedNoteId === n.id);
        const tags = [
          ...lt.map((t) => `☑ ${escapeHtml(t.title)}`),
          ...le.map((e) => `🗓 ${escapeHtml(e.title)}`),
        ].slice(0, 3);
        const extra = lt.length + le.length - tags.length;
        return `<div class="conn-item" data-id="${n.id}">
        <div class="cn-title">${escapeHtml(n.icon || "📄")} ${escapeHtml(n.title || "Untitled")}</div>
        <div class="conn-links">${tags.map((t) => `<span class="conn-tag">${t}</span>`).join("")}${extra > 0 ? `<span class="conn-tag">+${extra} more</span>` : ""}</div>
      </div>`;
      })
      .join("");
    $$(".conn-item", card).forEach((item) =>
      item.addEventListener("click", () => {
        switchToView("notes");
        openNote(item.dataset.id);
      }),
    );
  }
  function renderStatsWidget() {
    const card = $("#statsCard");
    if (!card) return;
    const t = todayISO();
    const openTasks = state.tasks.filter((x) => !x.done).length;
    const doneToday = state.tasks.filter(
      (x) => x.done && isoDate(new Date(x.updated)) === t,
    ).length;
    const weekEnd = new Date();
    weekEnd.setDate(weekEnd.getDate() + 7);
    const eventsThisWeek = state.events.filter(
      (e) => e.date >= t && e.date <= isoDate(weekEnd),
    ).length;
    const notesCount = state.notes.length;
    card.innerHTML = `<div class="stat-grid">
      <div class="stat-tile"><div class="stat-num">${openTasks}</div><div class="stat-lbl">Open tasks</div></div>
      <div class="stat-tile"><div class="stat-num">${doneToday}</div><div class="stat-lbl">Completed today</div></div>
      <div class="stat-tile"><div class="stat-num">${eventsThisWeek}</div><div class="stat-lbl">Events this week</div></div>
      <div class="stat-tile"><div class="stat-num">${notesCount}</div><div class="stat-lbl">Notes</div></div>
    </div>`;
  }

  /* ============ CUSTOMIZE MODAL ============ */
  function openCustomize() {
    pendingWidgetDraft = JSON.parse(JSON.stringify(state.settings));
    $("#nameInput").value = pendingWidgetDraft.name;
    renderAccentRow();
    renderWidgetList();
    $("#customizeOverlay").classList.add("open");
  }
  function renderAccentRow() {
    const row = $("#accentRow");
    row.innerHTML = "";
    ACCENTS.forEach((c) => {
      const dot = document.createElement("div");
      dot.className =
        "accent-dot" + (c === pendingWidgetDraft.accent ? " sel" : "");
      dot.style.background = c;
      dot.addEventListener("click", () => {
        pendingWidgetDraft.accent = c;
        renderAccentRow();
      });
      row.appendChild(dot);
    });
  }
  function renderWidgetList() {
    const list = $("#widgetList");
    list.innerHTML = "";
    pendingWidgetDraft.widgetOrder.forEach((id, idx) => {
      const row = document.createElement("div");
      row.className = "widget-row";
      const on = pendingWidgetDraft.widgetVisible[id];
      row.innerHTML = `
        <div class="switch${on ? " on" : ""}" data-id="${id}"><div class="k"></div></div>
        <div class="name">${WIDGET_LABELS[id]}</div>
        <div class="updn">
          <button class="icon-btn" data-move="up" data-idx="${idx}" ${idx === 0 ? 'disabled style="opacity:.3"' : ""}>↑</button>
          <button class="icon-btn" data-move="down" data-idx="${idx}" ${idx === pendingWidgetDraft.widgetOrder.length - 1 ? 'disabled style="opacity:.3"' : ""}>↓</button>
        </div>`;
      list.appendChild(row);
    });
    $$(".switch", list).forEach((sw) =>
      sw.addEventListener("click", () => {
        const id = sw.dataset.id;
        pendingWidgetDraft.widgetVisible[id] =
          !pendingWidgetDraft.widgetVisible[id];
        renderWidgetList();
      }),
    );
    $$("[data-move]", list).forEach((btn) =>
      btn.addEventListener("click", () => {
        const idx = Number(btn.dataset.idx);
        const dir = btn.dataset.move === "up" ? -1 : 1;
        const arr = pendingWidgetDraft.widgetOrder;
        const swapIdx = idx + dir;
        if (swapIdx < 0 || swapIdx >= arr.length) return;
        [arr[idx], arr[swapIdx]] = [arr[swapIdx], arr[idx]];
        renderWidgetList();
      }),
    );
  }
  function initCustomize() {
    $("#customizeBtn").addEventListener("click", openCustomize);
    $("#customizeCancel").addEventListener("click", () =>
      $("#customizeOverlay").classList.remove("open"),
    );
    $("#customizeOverlay").addEventListener("click", (e) => {
      if (e.target.id === "customizeOverlay")
        $("#customizeOverlay").classList.remove("open");
    });
    $("#customizeSave").addEventListener("click", () => {
      pendingWidgetDraft.name = $("#nameInput").value.trim();
      state.settings = pendingWidgetDraft;
      applyTheme();
      updateGreeting();
      renderHome();
      saveKey("settings");
      $("#customizeOverlay").classList.remove("open");
      toast("Home updated");
    });
  }

  /* ============================================================
     BLOCK EDITOR (Notion-style)
     ============================================================ */
  function renderBlocksX(ctx) {
    const wrap = document.getElementById(ctx.containerId);
    wrap.innerHTML = "";
    let numCounter = 0;
    ctx.blocks.forEach((block, idx) => {
      if (block.type === "numbered") numCounter++;
      else numCounter = 0;
      wrap.appendChild(buildBlockElX(ctx, block, idx, numCounter));
    });
  }

  const NON_TEXT_BLOCK_TYPES = [
    "divider",
    "image",
    "page-link",
    "subpage",
    "database",
  ];

  function buildBlockElX(ctx, block, idx, numIndex) {
    const row = document.createElement("div");
    row.className = `block-row block-${block.type}`;
    row.dataset.id = block.id;
    row.draggable = true;

    const controls = document.createElement("div");
    controls.className = "block-controls";
    controls.innerHTML = `<button class="block-ctrl-btn" data-act="add" title="Click to add a block below">+</button>
                          <button class="block-ctrl-btn" data-act="menu" title="Drag, delete, duplicate, turn into…">⋮⋮</button>`;
    row.appendChild(controls);

    if (block.type === "bulleted") {
      const m = document.createElement("div");
      m.className = "marker";
      m.textContent = "•";
      row.appendChild(m);
    } else if (block.type === "numbered") {
      const m = document.createElement("div");
      m.className = "marker";
      m.textContent = numIndex + ".";
      row.appendChild(m);
    } else if (block.type === "callout") {
      const m = document.createElement("div");
      m.className = "marker";
      m.textContent = "✦";
      row.appendChild(m);
    } else if (block.type === "toggle") {
      const car = document.createElement("div");
      car.className = "toggle-caret";
      car.textContent = block.open ? "▾" : "▸";
      car.addEventListener("click", () => {
        block.open = !block.open;
        ctx.touch();
        renderBlocksX(ctx);
      });
      row.appendChild(car);
    } else if (block.type === "checklist") {
      const c = document.createElement("div");
      c.className = "block-check";
      c.innerHTML = `<div class="box${block.checked ? " checked" : ""}">${block.checked ? "✓" : ""}</div>`;
      c.querySelector(".box").addEventListener("click", () => {
        block.checked = !block.checked;
        row.classList.toggle("done", block.checked);
        const box = c.querySelector(".box");
        box.classList.toggle("checked", block.checked);
        box.textContent = block.checked ? "✓" : "";
        ctx.touch();
      });
      row.appendChild(c);
      if (block.checked) row.classList.add("done");
    }

    if (block.type === "divider") {
      const content = document.createElement("div");
      content.className = "block-content";
      content.contentEditable = false;
      row.appendChild(content);
    } else if (block.type === "image") {
      const content = document.createElement("div");
      content.className = "block-content";
      if (!block.url) {
        content.innerHTML = `<div class="img-prompt"><input type="text" placeholder="Paste an image URL and press Enter"></div>`;
        const inp = content.querySelector("input");
        inp.addEventListener("keydown", (e) => {
          if (e.key === "Enter" && inp.value.trim()) {
            block.url = inp.value.trim();
            ctx.touch();
            renderBlocksX(ctx);
          }
        });
      } else {
        content.innerHTML = `<img src="${escapeHtml(block.url)}" alt=""><div class="tag-add-btn" style="margin-top:6px;">Replace image</div>`;
        content.querySelector(".tag-add-btn").addEventListener("click", () => {
          block.url = "";
          ctx.touch();
          renderBlocksX(ctx);
          focusBlockX(ctx, block.id);
        });
      }
      row.appendChild(content);
    } else if (block.type === "page-link") {
      const content = document.createElement("div");
      content.className = "block-content";
      if (!block.targetId) {
        const candidates = state.notes;
        content.innerHTML = `<div class="inline-picker">${candidates.length ? candidates.map((n) => `<div class="opt" data-t="${n.id}">${escapeHtml(n.icon || "📄")} ${escapeHtml(n.title || "Untitled")}</div>`).join("") : '<div class="opt" style="cursor:default;">No pages yet — create one first.</div>'}</div>`;
        $$(".opt[data-t]", content).forEach((opt) =>
          opt.addEventListener("click", () => {
            block.targetId = opt.dataset.t;
            ctx.touch();
            renderBlocksX(ctx);
          }),
        );
      } else {
        const target = state.notes.find((n) => n.id === block.targetId);
        content.innerHTML = target
          ? `<div class="page-link-chip" data-open="${target.id}">${escapeHtml(target.icon || "📄")} ${escapeHtml(target.title || "Untitled")}</div>`
          : `<div class="page-link-chip" style="opacity:.6;">Page not found</div>`;
        const chip = content.querySelector(".page-link-chip");
        if (target)
          chip.addEventListener("click", () => {
            switchToView("notes");
            openNote(target.id);
          });
      }
      row.appendChild(content);
    } else if (block.type === "subpage") {
      const content = document.createElement("div");
      content.className = "block-content";
      if (!block.targetId) {
        content.innerHTML = `<div class="subpage-card" style="border-style:dashed; opacity:.8;">📄 New subpage — click to create</div>`;
        content.querySelector(".subpage-card").addEventListener("click", () => {
          const parent = ctx.currentNote && ctx.currentNote();
          if (!parent) return;
          const child = createChildNote(parent, block);
          if (child) {
            block.targetId = child.id;
            ctx.touch();
            renderBlocksX(ctx);
          }
        });
      } else {
        const target = state.notes.find((n) => n.id === block.targetId);
        if (target) {
          content.innerHTML = `<div class="subpage-card"><span class="sp-ic">${escapeHtml(target.icon || "📄")}</span>${escapeHtml(target.title || "Untitled")}<span class="sp-open">Open →</span></div>`;
          content
            .querySelector(".subpage-card")
            .addEventListener("click", () => {
              switchToView("notes");
              openNote(target.id);
            });
        } else {
          content.innerHTML = `<div class="subpage-card" style="opacity:.6;">Subpage missing</div>`;
        }
      }
      row.appendChild(content);
    } else if (block.type === "database") {
      const content = document.createElement("div");
      content.className = "block-content";
      content.innerHTML = `<div class="inline-db" data-inline-db="${block.id}"></div>`;
      row.appendChild(content);
      setTimeout(
        () =>
          renderInlineDatabase(block, content.querySelector(".inline-db"), ctx),
        0,
      );
    } else {
      const content = document.createElement("div");
      content.className = "block-content";
      content.contentEditable = "true";
      content.setAttribute(
        "data-ph",
        idx === 0 ? "Start writing… type '/' for options" : "",
      );
      content.textContent = block.text || "";
      content.addEventListener("input", () =>
        onBlockInputX(ctx, block, row, content),
      );
      content.addEventListener("keydown", (e) =>
        onBlockKeydownX(ctx, e, block, row, content),
      );
      content.addEventListener("blur", () => closeSlashMenuX(ctx));
      row.appendChild(content);
    }

    controls
      .querySelector('[data-act="add"]')
      .addEventListener("click", (e) => {
        e.stopPropagation();
        const newBlock = { id: uid(), type: "paragraph", text: "" };
        ctx.blocks.splice(idx + 1, 0, newBlock);
        ctx.touch();
        renderBlocksX(ctx);
        focusBlockX(ctx, newBlock.id);
      });
    controls
      .querySelector('[data-act="menu"]')
      .addEventListener("click", (e) => {
        e.stopPropagation();
        openBlockMenuX(ctx, block, row, e.currentTarget);
      });

    row.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/plain", block.id);
      row.style.opacity = 0.4;
    });
    row.addEventListener("dragend", () => (row.style.opacity = 1));
    row.addEventListener("dragover", (e) => e.preventDefault());
    row.addEventListener("drop", (e) => {
      e.preventDefault();
      const draggedId = e.dataTransfer.getData("text/plain");
      if (draggedId === block.id) return;
      const from = ctx.blocks.findIndex((b) => b.id === draggedId);
      const to = ctx.blocks.findIndex((b) => b.id === block.id);
      if (from < 0 || to < 0) return;
      const [moved] = ctx.blocks.splice(from, 1);
      ctx.blocks.splice(to, 0, moved);
      ctx.touch();
      renderBlocksX(ctx);
    });

    if (block.type === "toggle") {
      const wrapper = document.createElement("div");
      wrapper.appendChild(row);
      if (block.open) {
        const ta = document.createElement("textarea");
        ta.className = "desc-textarea";
        ta.style.minHeight = "54px";
        ta.style.marginLeft = "26px";
        ta.style.marginTop = "2px";
        ta.placeholder = "Nested notes…";
        ta.value = block.childText || "";
        ta.addEventListener("input", () => {
          block.childText = ta.value;
          ctx.touch();
        });
        wrapper.appendChild(ta);
      }
      return wrapper;
    }
    return row;
  }

  function focusBlockX(ctx, id) {
    setTimeout(() => {
      const container = document.getElementById(ctx.containerId);
      if (!container) return;
      const row = container.querySelector(`.block-row[data-id="${id}"]`);
      if (row) {
        const c = row.querySelector(".block-content");
        if (c && c.isContentEditable) {
          c.focus();
        }
      }
    }, 20);
  }

  function onBlockInputX(ctx, block, row, content) {
    const text = content.textContent;
    if (text === "/") openSlashMenuX(ctx, row, block);
    else closeSlashMenuX(ctx);
    block.text = text;
    ctx.touch();
  }

  function onBlockKeydownX(ctx, e, block, row, content) {
    const slash = document.getElementById(ctx.slashMenuId);
    if (slash && slash.classList.contains("open")) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter") {
        e.preventDefault();
        navigateSlashMenuX(ctx, e.key, block, row, content);
        return;
      } else if (e.key === "Escape") {
        closeSlashMenuX(ctx);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const idx = ctx.blocks.findIndex((b) => b.id === block.id);
      let nextType = "paragraph";
      if (
        (block.type === "bulleted" ||
          block.type === "numbered" ||
          block.type === "checklist") &&
        content.textContent.trim() !== ""
      ) {
        nextType = block.type;
      }
      if (content.textContent.trim() === "" && block.type !== "paragraph") {
        block.type = "paragraph";
        ctx.touch();
        renderBlocksX(ctx);
        focusBlockX(ctx, block.id);
        return;
      }
      const newBlock = { id: uid(), type: nextType, text: "" };
      ctx.blocks.splice(idx + 1, 0, newBlock);
      ctx.touch();
      renderBlocksX(ctx);
      focusBlockX(ctx, newBlock.id);
    } else if (e.key === "Backspace" && content.textContent === "") {
      const idx = ctx.blocks.findIndex((b) => b.id === block.id);
      if (block.type !== "paragraph") {
        e.preventDefault();
        block.type = "paragraph";
        ctx.touch();
        renderBlocksX(ctx);
        focusBlockX(ctx, block.id);
        return;
      }
      if (idx > 0) {
        e.preventDefault();
        const prevBlock = ctx.blocks[idx - 1];
        ctx.blocks.splice(idx, 1);
        ctx.touch();
        renderBlocksX(ctx);
        focusBlockX(ctx, prevBlock.id);
        setTimeout(() => {
          const container = document.getElementById(ctx.containerId);
          const row2 =
            container &&
            container.querySelector(
              `.block-row[data-id="${prevBlock.id}"] .block-content`,
            );
          if (row2 && row2.isContentEditable) {
            const range = document.createRange();
            const sel = window.getSelection();
            range.selectNodeContents(row2);
            range.collapse(false);
            sel.removeAllRanges();
            sel.addRange(range);
          }
        }, 30);
      }
    }
  }

  let slashSelIdx = 0;
  function openSlashMenuX(ctx, row, block) {
    slashSelIdx = 0;
    const menu = document.getElementById(ctx.slashMenuId);
    if (!menu) return;
    const cats = {};
    BLOCK_TYPES.forEach((bt) => {
      (cats[bt.cat] = cats[bt.cat] || []).push(bt);
    });
    let html = "";
    let flatIndex = 0;
    Object.keys(cats).forEach((cat) => {
      html += `<div class="slash-cat">${cat}</div>`;
      cats[cat].forEach((bt) => {
        html += `<div class="slash-item${flatIndex === 0 ? " sel" : ""}" data-type="${bt.type}" data-idx="${flatIndex}"><div class="si">${bt.icon}</div>${bt.label}</div>`;
        flatIndex++;
      });
    });
    menu.innerHTML = html;
    const rect = row.getBoundingClientRect();
    const parentRect = document
      .querySelector(ctx.rootSelector)
      .getBoundingClientRect();
    menu.style.top = rect.bottom - parentRect.top + 4 + "px";
    menu.style.left = rect.left - parentRect.left + 40 + "px";
    menu.classList.add("open");
    menu.style.display = "block";
    Array.from(menu.querySelectorAll(".slash-item")).forEach((item) =>
      item.addEventListener("mousedown", (e) => {
        e.preventDefault();
        applySlashChoiceX(ctx, item.dataset.type, block);
      }),
    );
  }
  function closeSlashMenuX(ctx) {
    const m = document.getElementById(ctx.slashMenuId);
    if (m) {
      m.classList.remove("open");
      m.style.display = "none";
    }
  }
  function navigateSlashMenuX(ctx, key, block, row, content) {
    const menu = document.getElementById(ctx.slashMenuId);
    const items = Array.from(menu.querySelectorAll(".slash-item"));
    if (key === "ArrowDown") {
      slashSelIdx = Math.min(items.length - 1, slashSelIdx + 1);
    } else if (key === "ArrowUp") {
      slashSelIdx = Math.max(0, slashSelIdx - 1);
    } else if (key === "Enter") {
      applySlashChoiceX(ctx, items[slashSelIdx].dataset.type, block);
      return;
    }
    items.forEach((it, i) => it.classList.toggle("sel", i === slashSelIdx));
  }
  function applySlashChoiceX(ctx, type, block) {
    block.type = type;
    block.text = "";
    if (type === "toggle") {
      block.open = true;
      block.childText = "";
    }
    if (type === "image") {
      block.url = "";
    }
    if (type === "page-link" || type === "subpage") {
      block.targetId = null;
    }
    if (type === "database") {
      block.dbName = "Untitled database";
      block.schema = [
        {
          id: uid(),
          name: "Status",
          type: "select",
          options: ["Not started", "In progress", "Done"],
        },
      ];
      block.rows = [];
    }
    ctx.touch();
    closeSlashMenuX(ctx);
    renderBlocksX(ctx);
    if (!NON_TEXT_BLOCK_TYPES.includes(type)) focusBlockX(ctx, block.id);
  }

  function openBlockMenuX(ctx, block, row, anchor) {
    const menuId = ctx.blockMenuId || "blockMenu";
    const menu = document.getElementById(menuId);
    if (!menu) return;
    const rect = anchor.getBoundingClientRect();
    const root = document.querySelector(ctx.rootSelector || "#noteEditor");
    const pr = root.getBoundingClientRect();
    menu.style.top = rect.bottom - pr.top + 4 + "px";
    menu.style.left = rect.left - pr.left + "px";
    const turnInto = BLOCK_TYPES.filter(
      (t) => t.type !== "database" && t.type !== "subpage",
    );
    menu.innerHTML = `
      <div class="mi" data-act="duplicate"><span class="mi-ic">⧉</span>Duplicate</div>
      <div class="mi danger" data-act="delete"><span class="mi-ic">🗑</span>Delete</div>
      <div class="divider"></div>
      <div class="slash-cat">Turn into</div>
      ${turnInto.map((t) => `<div class="mi" data-turn="${t.type}"><span class="mi-ic">${t.icon}</span>${t.label}</div>`).join("")}
    `;
    menu.classList.add("open");
    $$(".mi", menu).forEach((item) =>
      item.addEventListener("click", () => {
        const act = item.dataset.act;
        if (act === "duplicate") {
          const idx = ctx.blocks.findIndex((b) => b.id === block.id);
          const copy = JSON.parse(JSON.stringify(block));
          copy.id = uid();
          ctx.blocks.splice(idx + 1, 0, copy);
          ctx.touch();
          renderBlocksX(ctx);
        } else if (act === "delete") {
          const idx = ctx.blocks.findIndex((b) => b.id === block.id);
          ctx.blocks.splice(idx, 1);
          if (ctx.blocks.length === 0)
            ctx.blocks.push({ id: uid(), type: "paragraph", text: "" });
          ctx.touch();
          renderBlocksX(ctx);
        } else if (item.dataset.turn) {
          const t = item.dataset.turn;
          block.type = t;
          if (t === "checklist") block.checked = block.checked || false;
          if (t === "toggle") {
            block.open = true;
            block.childText = block.childText || "";
          }
          if (t === "image") block.url = "";
          if (t === "page-link") block.targetId = null;
          if (t === "divider" || t === "image" || t === "page-link")
            delete block.text;
          ctx.touch();
          renderBlocksX(ctx);
        }
        menu.classList.remove("open");
      }),
    );
    setTimeout(() => {
      document.addEventListener("click", function closeOnce(e) {
        if (!e.target.closest(".block-menu")) {
          menu.classList.remove("open");
          document.removeEventListener("click", closeOnce);
        }
      });
    }, 10);
  }

  /* ============ INLINE DATABASE ============ */
  function renderInlineDatabase(block, container, ctx) {
    if (!block.schema)
      block.schema = [
        {
          id: uid(),
          name: "Status",
          type: "select",
          options: ["Not started", "In progress", "Done"],
        },
      ];
    if (!block.rows) block.rows = [];

    let tableHtml = `<div class="inline-db-toolbar">
      <span>🗄️</span>
      <input class="db-title-input" value="${escapeHtml(block.dbName || "Database")}" data-dbname>
      <span class="grow"></span>
      <button class="btn ghost" data-add-prop style="padding:4px 10px; font-size:11px;">+ Property</button>
      <button class="btn primary" data-add-row style="padding:4px 10px; font-size:11px;">+ New row</button>
    </div>`;

    const thead =
      `<tr><th style="min-width:140px;">Name</th>` +
      block.schema
        .map(
          (p) =>
            `<th>${escapeHtml(p.name)} <span class="th-x" data-prop="${p.id}" style="opacity:.5; cursor:pointer;">✕</span></th>`,
        )
        .join("") +
      `<th></th></tr>`;
    const tbody =
      block.rows
        .map((r) => {
          let cells = `<td><div class="row-title" data-open="${r.id}">${escapeHtml(r.icon || "📄")} ${escapeHtml(r.title || "Untitled")}</div></td>`;
          block.schema.forEach((p) => {
            const v = (r.props || {})[p.id];
            if (p.type === "text" || p.type === "number" || p.type === "date") {
              cells += `<td><input class="inline-db-cell-input" type="${p.type === "number" ? "number" : p.type === "date" ? "date" : "text"}" data-cell="${r.id}:${p.id}" value="${escapeHtml(v ?? "")}"></td>`;
            } else if (p.type === "checkbox") {
              cells += `<td><div class="task-box${v ? " checked" : ""}" data-check="${r.id}:${p.id}" style="width:16px;height:16px;">${v ? "✓" : ""}</div></td>`;
            } else if (p.type === "select") {
              cells += `<td><select class="db-cell-select" data-sel="${r.id}:${p.id}"><option value="">—</option>${(p.options || []).map((o) => `<option value="${escapeHtml(o)}"${o === v ? " selected" : ""}>${escapeHtml(o)}</option>`).join("")}</select></td>`;
            } else {
              cells += `<td></td>`;
            }
          });
          cells += `<td><button class="row-del" data-del="${r.id}">✕</button></td>`;
          return `<tr>${cells}</tr>`;
        })
        .join("") ||
      `<tr><td colspan="${block.schema.length + 2}" style="color:var(--ink-soft); font-size:12px;">No rows yet — use “+ New row”.</td></tr>`;

    container.innerHTML =
      tableHtml + `<table class="inline-db-table">${thead}${tbody}</table>`;

    const nameInput = container.querySelector("[data-dbname]");
    nameInput.addEventListener("change", () => {
      block.dbName = nameInput.value;
      ctx.touch();
    });

    container.querySelector("[data-add-row]").addEventListener("click", () => {
      const row = { id: uid(), title: "", icon: "📄", props: {} };
      block.rows.push(row);
      ctx.touch();
      renderInlineDatabase(block, container, ctx);
      openInlineRowModal(row, block, () => {
        ctx.touch();
        renderBlocksX(ctx);
      });
    });
    container.querySelector("[data-add-prop]").addEventListener("click", () => {
      openInlineDbPropModal(block, container, ctx);
    });

    $$("[data-open]", container).forEach((el) =>
      el.addEventListener("click", () => {
        const r = block.rows.find((x) => x.id === el.dataset.open);
        if (r)
          openInlineRowModal(r, block, () => {
            ctx.touch();
            renderBlocksX(ctx);
          });
      }),
    );
    $$("[data-del]", container).forEach((el) =>
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        block.rows = block.rows.filter((r) => r.id !== el.dataset.del);
        ctx.touch();
        renderInlineDatabase(block, container, ctx);
      }),
    );
    $$("[data-prop]", container).forEach((el) =>
      el.addEventListener("click", () => {
        block.schema = block.schema.filter((p) => p.id !== el.dataset.prop);
        ctx.touch();
        renderInlineDatabase(block, container, ctx);
      }),
    );
    block.rows.forEach((r) => {
      block.schema.forEach((p) => {
        const key = `${r.id}:${p.id}`;
        if (p.type === "text" || p.type === "number" || p.type === "date") {
          const el = container.querySelector(`[data-cell="${key}"]`);
          if (el)
            el.addEventListener("change", () => {
              r.props[p.id] = el.value;
              ctx.touch();
            });
        } else if (p.type === "checkbox") {
          const el = container.querySelector(`[data-check="${key}"]`);
          if (el)
            el.addEventListener("click", () => {
              r.props[p.id] = !r.props[p.id];
              el.classList.toggle("checked", r.props[p.id]);
              el.textContent = r.props[p.id] ? "✓" : "";
              ctx.touch();
            });
        } else if (p.type === "select") {
          const el = container.querySelector(`[data-sel="${key}"]`);
          if (el)
            el.addEventListener("change", () => {
              r.props[p.id] = el.value;
              ctx.touch();
            });
        }
      });
    });
  }

  /* Inline database row modal — full Notion-like row page */
  function openInlineRowModal(row, block, onSave) {
    const existing = document.getElementById("inlineRowOverlay");
    if (existing) existing.remove();
    const overlay = document.createElement("div");
    overlay.className = "overlay open";
    overlay.id = "inlineRowOverlay";
    overlay.innerHTML = `
      <div class="modal big-modal" style="max-width:640px;">
        <h3>Row details</h3>
        <input class="note-title-input" id="irTitle" placeholder="Untitled row" value="${escapeHtml(row.title || "")}" style="font-size:22px; margin-bottom:12px;">
        <div class="field"><label>Row properties</label><div id="irProps" style="display:flex; flex-direction:column; gap:8px;"></div></div>
        <div class="field">
          <label>Notes</label>
          <div class="task-detail-blocks" id="irBlocks"></div>
          <div class="slash-menu" id="irSlashMenu"></div>
          <div class="block-menu" id="irBlockMenu"></div>
        </div>
        <div class="modal-actions">
          <button class="btn ghost" id="irDelete" style="color:var(--danger); margin-right:auto;">Delete row</button>
          <button class="btn ghost" id="irClose">Close</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const titleEl = overlay.querySelector("#irTitle");
    titleEl.addEventListener("input", () => {
      row.title = titleEl.value;
      onSave && onSave();
    });

    // Properties
    const propsBox = overlay.querySelector("#irProps");
    block.schema.forEach((p) => {
      const rowEl = document.createElement("div");
      rowEl.className = "custom-prop-row";
      const nameEl = document.createElement("div");
      nameEl.className = "custom-prop-name";
      nameEl.textContent = p.name;
      const valEl = document.createElement("div");
      valEl.className = "custom-prop-val";
      const v = (row.props || {})[p.id];
      if (p.type === "checkbox") {
        const box = document.createElement("div");
        box.className = "task-box" + (v ? " checked" : "");
        box.style.cssText = "width:16px;height:16px;";
        box.textContent = v ? "✓" : "";
        box.addEventListener("click", () => {
          row.props[p.id] = !row.props[p.id];
          box.classList.toggle("checked", row.props[p.id]);
          box.textContent = row.props[p.id] ? "✓" : "";
          onSave && onSave();
        });
        valEl.appendChild(box);
      } else if (p.type === "select") {
        const sel = document.createElement("select");
        sel.innerHTML =
          `<option value="">—</option>` +
          (p.options || [])
            .map(
              (o) =>
                `<option value="${escapeHtml(o)}"${o === v ? " selected" : ""}>${escapeHtml(o)}</option>`,
            )
            .join("");
        sel.addEventListener("change", () => {
          row.props[p.id] = sel.value;
          onSave && onSave();
        });
        valEl.appendChild(sel);
      } else {
        const inp = document.createElement("input");
        inp.type =
          p.type === "number" ? "number" : p.type === "date" ? "date" : "text";
        inp.value = v ?? "";
        inp.addEventListener("change", () => {
          row.props[p.id] = inp.value;
          onSave && onSave();
        });
        valEl.appendChild(inp);
      }
      rowEl.appendChild(nameEl);
      rowEl.appendChild(valEl);
      propsBox.appendChild(rowEl);
    });
    if (block.schema.length === 0)
      propsBox.innerHTML = `<div class="empty" style="padding:0;">No properties yet.</div>`;

    // Blocks
    if (!row.blocks) row.blocks = [{ id: uid(), type: "paragraph", text: "" }];
    const ctx = {
      blocks: row.blocks,
      touch: () => {
        onSave && onSave();
      },
      containerId: "irBlocks",
      slashMenuId: "irSlashMenu",
      blockMenuId: "irBlockMenu",
      rootSelector: "#inlineRowOverlay .modal",
      currentNote: () => null,
    };
    renderBlocksX(ctx);

    overlay
      .querySelector("#irClose")
      .addEventListener("click", () => overlay.remove());
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) overlay.remove();
    });
    overlay.querySelector("#irDelete").addEventListener("click", () => {
      block.rows = block.rows.filter((r) => r.id !== row.id);
      onSave && onSave();
      overlay.remove();
    });
    setTimeout(() => titleEl.focus(), 30);
  }

  function openInlineDbPropModal(block, container, ctx) {
    openPropertyModal({
      kind: "inline-db",
      onSave: (prop) => {
        block.schema.push(prop);
        ctx.touch();
        renderInlineDatabase(block, container, ctx);
      },
    });
  }

  /* ============ ADD PROPERTY MODAL (shared) ============ */
  let propertyTarget = null;
  function openPropertyModal(target) {
    propertyTarget = target;
    $("#propNameInput").value = "";
    $("#propTypeInput").innerHTML = `
      <option value="text">Text</option>
      <option value="number">Number</option>
      <option value="date">Date</option>
      <option value="checkbox">Checkbox</option>
      <option value="select">Select</option>
    `;
    $("#propOptionsInput").value = "";
    $("#propOptionsField").style.display = "none";
    $("#propertyOverlay").classList.add("open");
    $("#propNameInput").focus();
  }
  function initPropertyModal() {
    $("#propTypeInput").addEventListener("change", () => {
      $("#propOptionsField").style.display =
        $("#propTypeInput").value === "select" ? "" : "none";
    });
    $("#propCancel").addEventListener("click", () =>
      $("#propertyOverlay").classList.remove("open"),
    );
    $("#propertyOverlay").addEventListener("click", (e) => {
      if (e.target.id === "propertyOverlay")
        $("#propertyOverlay").classList.remove("open");
    });
    $("#propSave").addEventListener("click", () => {
      const name = $("#propNameInput").value.trim();
      if (!name) {
        toast("Give the property a name");
        return;
      }
      const type = $("#propTypeInput").value;
      const prop = { id: uid(), name, type };
      if (type === "select")
        prop.options = $("#propOptionsInput")
          .value.split(",")
          .map((s) => s.trim())
          .filter(Boolean);
      if (propertyTarget && propertyTarget.onSave) {
        propertyTarget.onSave(prop);
      } else if (propertyTarget && propertyTarget.kind === "page") {
        const note = state.notes.find((n) => n.id === propertyTarget.id);
        const defaultVal = type === "checkbox" ? false : "";
        note.customProperties.push(
          Object.assign({}, prop, { value: defaultVal }),
        );
        touchNote(note);
        renderNoteProps(note);
      }
      $("#propertyOverlay").classList.remove("open");
      toast("Property added");
    });
  }

  /* ============ NOTES (tree + editor) ============ */
  function noteCtx(note) {
    return {
      blocks: note.blocks,
      touch: () => touchNote(note),
      containerId: "noteBlocks",
      slashMenuId: "slashMenu",
      blockMenuId: "blockMenu",
      rootSelector: "#noteEditor",
      currentNote: () => note,
    };
  }

  function renderNotesList() {
    const list = $("#notesList");
    list.innerHTML = `<div class="notes-list-head"><span>${state.notes.length} item${state.notes.length === 1 ? "" : "s"}</span></div>`;
    const roots = state.notes.filter((n) => !n.parentId);
    roots.forEach((n) => renderTreeNode(list, n, 0));
  }
  function renderTreeNode(container, note, depth) {
    const children = state.notes.filter((c) => c.parentId === note.id);
    const item = document.createElement("div");
    item.className = "tree-item" + (note.id === activeNoteId ? " active" : "");
    item.style.paddingLeft = 8 + depth * 16 + "px";
    const expanded = expandedTreeIds.has(note.id);
    item.innerHTML = `
      <div class="tree-caret${children.length ? "" : " hidden"}">${expanded ? "▾" : "▸"}</div>
      <div class="tree-ic">${escapeHtml(note.icon || "📄")}</div>
      <div class="tree-label">${escapeHtml(note.title || "Untitled")}</div>
    `;
    const caret = item.querySelector(".tree-caret");
    caret.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!children.length) return;
      if (expanded) expandedTreeIds.delete(note.id);
      else expandedTreeIds.add(note.id);
      renderNotesList();
    });
    item.addEventListener("click", () => openNote(note.id));
    container.appendChild(item);
    if (expanded) {
      children.forEach((c) => renderTreeNode(container, c, depth + 1));
    }
  }
  function openNote(id) {
    activeNoteId = id;
    expandedTreeIds.add(id);
    renderNotesList();
    renderEditor();
  }

  const EMOJI_SET = [
    "📄",
    "📝",
    "💡",
    "🎯",
    "📚",
    "🗓️",
    "✅",
    "💭",
    "🌱",
    "🔥",
    "⭐",
    "🏠",
    "💼",
    "🍎",
    "🎬",
    "🧠",
  ];

  function renderEditor() {
    const editor = $("#noteEditor");
    const note = state.notes.find((n) => n.id === activeNoteId);
    if (!note) {
      editor.innerHTML = `<div class="note-editor-empty">
        <div class="serif" style="font-size:20px; color:var(--ink);">No page selected</div>
        <div>Pick a page on the left, or create a new one.</div>
        <button class="btn primary" id="emptyNewNote">+ New page</button>
      </div>`;
      $("#emptyNewNote").addEventListener("click", () => createNote(null));
      return;
    }

    const chain = buildBreadcrumbs(note);
    editor.innerHTML = `
      <div class="breadcrumbs" id="breadcrumbs"></div>
      <div class="note-header">
        <button class="note-icon-btn" id="noteIconBtn">${escapeHtml(note.icon || "📄")}</button>
        <div class="emoji-pop" id="emojiPop"></div>
        <input class="note-title-input" id="noteTitleInput" placeholder="Untitled" value="${escapeHtml(note.title)}">
        <div class="note-props" id="noteProps"></div>
        <div class="link-picker" id="linkPicker"></div>
        <div class="note-meta">Edited ${relativeDate(note.updated)} · <span id="deletePageLink" style="cursor:pointer;color:var(--danger);">Delete page</span></div>
      </div>
      <div class="note-blocks" id="noteBlocks"></div>
      <div class="slash-menu" id="slashMenu"></div>
      <div class="block-menu" id="blockMenu"></div>
      <div class="sel-toolbar" id="selToolbar">
        <button data-cmd="bold"><b>B</b></button>
        <button data-cmd="italic"><i>I</i></button>
        <button data-cmd="strikeThrough"><s>S</s></button>
      </div>
    `;
    renderBreadcrumbsInto($("#breadcrumbs"), chain);
    $("#noteIconBtn").addEventListener("click", () => toggleEmojiPop(note));
    $("#noteTitleInput").addEventListener("input", (e) => {
      note.title = e.target.value;
      note.updated = Date.now();
      debounceSaveNotes();
      renderNotesList();
    });
    $("#deletePageLink").addEventListener("click", () => deleteNote(note.id));
    renderNoteProps(note);
    renderBlocksX(noteCtx(note));
  }

  function buildBreadcrumbs(note) {
    const chain = [];
    let cur = note;
    const seen = new Set();
    while (cur && !seen.has(cur.id)) {
      seen.add(cur.id);
      chain.unshift(cur);
      cur = cur.parentId
        ? state.notes.find((n) => n.id === cur.parentId)
        : null;
    }
    return chain;
  }
  function renderBreadcrumbsInto(el, chain) {
    el.innerHTML = chain
      .map((n, i) => {
        const isLast = i === chain.length - 1;
        return `${i > 0 ? '<span class="bc-sep">/</span>' : ""}
        <span class="bc-link" data-bc="${n.id}" style="${isLast ? "color:var(--ink);font-weight:600;" : ""}">${escapeHtml(n.icon || "📄")} ${escapeHtml(n.title || "Untitled")}</span>`;
      })
      .join("");
    $$(".bc-link", el).forEach((l) =>
      l.addEventListener("click", () => openNote(l.dataset.bc)),
    );
  }

  function renderNoteProps(note) {
    const box = $("#noteProps");
    if (!box) return;
    const sm =
      STATUS_META[note.properties.status] || STATUS_META["not-started"];
    const linkedTasks = state.tasks.filter((t) => t.linkedNoteId === note.id);
    const linkedEvents = state.events.filter((e) => e.linkedNoteId === note.id);
    box.innerHTML = `
      <div class="prop-row">
        <div class="prop-key">Status</div>
        <div class="status-pill" id="statusPill"><div class="d" style="background:${sm.color}"></div>${sm.label}</div>
        <button class="pin-btn${note.pinned ? " on" : ""}" id="pinBtn" title="Pin to homepage">${note.pinned ? "📌 Pinned" : "📌 Pin"}</button>
      </div>
      <div class="prop-row">
        <div class="prop-key">Tags</div>
        <div id="tagChips" style="display:flex; gap:6px; flex-wrap:wrap; align-items:center;"></div>
      </div>
      <div class="prop-row">
        <div class="prop-key">Linked</div>
        <div style="display:flex; gap:6px; flex-wrap:wrap; align-items:center;" id="linkChips"></div>
      </div>
      <div class="prop-row" style="align-items:flex-start;">
        <div class="prop-key">Custom</div>
        <div style="display:flex; flex-direction:column; gap:6px; flex:1;" id="customPropsBox"></div>
      </div>
    `;
    $("#statusPill").addEventListener("click", () => {
      const idx = STATUS_ORDER.indexOf(note.properties.status);
      note.properties.status = STATUS_ORDER[(idx + 1) % STATUS_ORDER.length];
      touchNote(note);
      renderNoteProps(note);
      renderRecentNotes();
    });
    $("#pinBtn").addEventListener("click", () => {
      note.pinned = !note.pinned;
      touchNote(note);
      renderNoteProps(note);
      renderHome();
    });

    const tagBox = $("#tagChips");
    (note.properties.tags || []).forEach((tag, i) => {
      const chip = document.createElement("div");
      chip.className = "tag-chip";
      chip.innerHTML = `${escapeHtml(tag)} <span class="x" data-i="${i}">✕</span>`;
      tagBox.appendChild(chip);
    });
    const addTagBtn = document.createElement("button");
    addTagBtn.className = "tag-add-btn";
    addTagBtn.textContent = "+ tag";
    addTagBtn.addEventListener("click", () => {
      addTagBtn.outerHTML = `<input class="tag-add-input" id="tagAddInput" placeholder="tag name">`;
      const inp = $("#tagAddInput");
      inp.focus();
      inp.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && inp.value.trim()) {
          note.properties.tags = note.properties.tags || [];
          note.properties.tags.push(inp.value.trim());
          touchNote(note);
          renderNoteProps(note);
        } else if (e.key === "Escape") {
          renderNoteProps(note);
        }
      });
      inp.addEventListener("blur", () => renderNoteProps(note));
    });
    tagBox.appendChild(addTagBtn);
    $$(".tag-chip .x", tagBox).forEach((x) =>
      x.addEventListener("click", () => {
        note.properties.tags.splice(Number(x.dataset.i), 1);
        touchNote(note);
        renderNoteProps(note);
      }),
    );

    const linkBox = $("#linkChips");
    linkedTasks.forEach((t) => {
      const chip = document.createElement("div");
      chip.className = "link-chip";
      chip.innerHTML = `☑ ${escapeHtml(t.title)} <span class="x" data-unlink-task="${t.id}">✕</span>`;
      chip.addEventListener("click", (e) => {
        if (e.target.closest("[data-unlink-task]")) return;
        openTaskDetail(t.id);
      });
      linkBox.appendChild(chip);
    });
    linkedEvents.forEach((ev) => {
      const chip = document.createElement("div");
      chip.className = "link-chip";
      chip.innerHTML = `🗓 ${escapeHtml(ev.title)} <span class="x" data-unlink-event="${ev.id}">✕</span>`;
      chip.addEventListener("click", (e) => {
        if (e.target.closest("[data-unlink-event]")) return;
        jumpToEvent(ev);
      });
      linkBox.appendChild(chip);
    });
    const addLinkBtn = document.createElement("button");
    addLinkBtn.className = "link-add-btn";
    addLinkBtn.textContent = "+ link";
    addLinkBtn.addEventListener("click", () =>
      openLinkPicker(note, addLinkBtn),
    );
    linkBox.appendChild(addLinkBtn);
    $$("[data-unlink-task]", linkBox).forEach((x) =>
      x.addEventListener("click", (e) => {
        e.stopPropagation();
        const t = state.tasks.find((tt) => tt.id === x.dataset.unlinkTask);
        if (t) {
          t.linkedNoteId = null;
          saveKey("tasks");
          renderNoteProps(note);
          renderHome();
        }
      }),
    );
    $$("[data-unlink-event]", linkBox).forEach((x) =>
      x.addEventListener("click", (e) => {
        e.stopPropagation();
        const ev = state.events.find((ee) => ee.id === x.dataset.unlinkEvent);
        if (ev) {
          ev.linkedNoteId = null;
          saveKey("events");
          renderNoteProps(note);
          renderHome();
        }
      }),
    );

    renderCustomProps(note, $("#customPropsBox"));
  }

  function renderCustomProps(note, box) {
    box.innerHTML = "";
    (note.customProperties || []).forEach((prop) => {
      const row = document.createElement("div");
      row.className = "custom-prop-row";
      const nameEl = document.createElement("div");
      nameEl.className = "custom-prop-name";
      nameEl.textContent = prop.name;
      const valEl = document.createElement("div");
      valEl.className = "custom-prop-val";
      valEl.appendChild(
        buildPropValueInput(prop, prop.value, (v) => {
          prop.value = v;
          touchNote(note);
        }),
      );
      const delEl = document.createElement("div");
      delEl.className = "custom-prop-del";
      delEl.textContent = "✕";
      delEl.addEventListener("click", () => {
        note.customProperties = note.customProperties.filter(
          (p) => p.id !== prop.id,
        );
        touchNote(note);
        renderNoteProps(note);
      });
      row.appendChild(nameEl);
      row.appendChild(valEl);
      row.appendChild(delEl);
      box.appendChild(row);
    });
    const addBtn = document.createElement("button");
    addBtn.className = "tag-add-btn";
    addBtn.textContent = "+ Add property";
    addBtn.addEventListener("click", () =>
      openPropertyModal({ kind: "page", id: note.id }),
    );
    box.appendChild(addBtn);
  }

  function buildPropValueInput(prop, value, onChange) {
    if (prop.type === "checkbox") {
      const box = document.createElement("div");
      box.className = "task-box" + (value ? " checked" : "");
      box.style.cssText = "width:16px;height:16px;";
      box.textContent = value ? "✓" : "";
      box.addEventListener("click", () => {
        const nv = !value;
        box.classList.toggle("checked", nv);
        box.textContent = nv ? "✓" : "";
        value = nv;
        onChange(nv);
      });
      return box;
    }
    if (prop.type === "select") {
      const sel = document.createElement("select");
      sel.innerHTML =
        `<option value="">—</option>` +
        (prop.options || [])
          .map(
            (o) =>
              `<option value="${escapeHtml(o)}" ${o === value ? "selected" : ""}>${escapeHtml(o)}</option>`,
          )
          .join("");
      sel.addEventListener("change", () => onChange(sel.value));
      return sel;
    }
    const input = document.createElement("input");
    input.type =
      prop.type === "number"
        ? "number"
        : prop.type === "date"
          ? "date"
          : "text";
    input.value = value ?? "";
    input.addEventListener("change", () => onChange(input.value));
    return input;
  }

  function jumpToEvent(ev) {
    const d = new Date(ev.date + "T00:00:00");
    calYear = d.getFullYear();
    calMonth = d.getMonth();
    weekAnchor = d;
    switchToView("calendar");
  }

  function openLinkPicker(note, anchorBtn) {
    const picker = $("#linkPicker");
    const rect = anchorBtn.getBoundingClientRect();
    const parentRect = $("#noteEditor").getBoundingClientRect();
    picker.style.top = rect.bottom - parentRect.top + 4 + "px";
    picker.style.left = rect.left - parentRect.left + "px";
    const openTasks = state.tasks.filter((t) => t.linkedNoteId !== note.id);
    const openEvents = state.events.filter((e) => e.linkedNoteId !== note.id);
    let html = "";
    if (openTasks.length) {
      html +=
        `<div class="grp">Tasks</div>` +
        openTasks
          .map(
            (t) =>
              `<div class="opt" data-task="${t.id}">☑ ${escapeHtml(t.title)}</div>`,
          )
          .join("");
    }
    if (openEvents.length) {
      html +=
        `<div class="grp">Events</div>` +
        openEvents
          .map(
            (e) =>
              `<div class="opt" data-event="${e.id}">🗓 ${escapeHtml(e.title)}</div>`,
          )
          .join("");
    }
    if (!openTasks.length && !openEvents.length) {
      html = `<div class="none">No tasks or events to link yet.</div>`;
    }
    picker.innerHTML = html;
    picker.classList.add("open");
    $$(".opt", picker).forEach((opt) =>
      opt.addEventListener("click", () => {
        if (opt.dataset.task) {
          const t = state.tasks.find((x) => x.id === opt.dataset.task);
          t.linkedNoteId = note.id;
          saveKey("tasks");
        } else if (opt.dataset.event) {
          const ev = state.events.find((x) => x.id === opt.dataset.event);
          ev.linkedNoteId = note.id;
          saveKey("events");
        }
        picker.classList.remove("open");
        renderNoteProps(note);
        renderHome();
      }),
    );
    setTimeout(() => {
      document.addEventListener("click", function closeOnce(e) {
        if (!e.target.closest("#linkPicker") && e.target !== anchorBtn) {
          picker.classList.remove("open");
          document.removeEventListener("click", closeOnce);
        }
      });
    }, 10);
  }

  function toggleEmojiPop(note) {
    const pop = $("#emojiPop");
    const open = pop.classList.contains("open");
    if (open) {
      pop.classList.remove("open");
      return;
    }
    const btnRect = $("#noteIconBtn").getBoundingClientRect();
    const parentRect = $("#noteEditor").getBoundingClientRect();
    pop.style.top = btnRect.bottom - parentRect.top + 4 + "px";
    pop.style.left = btnRect.left - parentRect.left + "px";
    pop.innerHTML = EMOJI_SET.map((e) => `<button>${e}</button>`).join("");
    pop.classList.add("open");
    $$("#emojiPop button").forEach((b, i) =>
      b.addEventListener("click", () => {
        note.icon = EMOJI_SET[i];
        note.updated = Date.now();
        $("#noteIconBtn").textContent = note.icon;
        pop.classList.remove("open");
        debounceSaveNotes();
        renderNotesList();
      }),
    );
  }

  function touchNote(note) {
    note.updated = Date.now();
    debounceSaveNotes();
  }
  let saveTimer = null;
  function debounceSaveNotes() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveKey("notes");
      renderRecentNotes();
      renderMiniCal();
    }, 500);
  }

  function createNote(parentId) {
    const note = {
      id: uid(),
      title: "",
      icon: "📄",
      updated: Date.now(),
      pinned: false,
      type: "page",
      parentId: parentId || null,
      properties: { status: "not-started", tags: [] },
      customProperties: [],
      propValues: {},
      blocks: [{ id: uid(), type: "paragraph", text: "" }],
    };
    state.notes.push(note);
    if (parentId) expandedTreeIds.add(parentId);
    saveKey("notes");
    openNote(note.id);
    renderRecentNotes();
    setTimeout(() => {
      const t = $("#noteTitleInput");
      if (t) t.focus();
    }, 30);
  }

  function createChildNote(parentNote, block) {
    const child = {
      id: uid(),
      title: "",
      icon: "📄",
      updated: Date.now(),
      pinned: false,
      type: "page",
      parentId: parentNote.id,
      properties: { status: "not-started", tags: [] },
      customProperties: [],
      propValues: {},
      blocks: [{ id: uid(), type: "paragraph", text: "" }],
    };
    state.notes.push(child);
    expandedTreeIds.add(parentNote.id);
    saveKey("notes");
    renderNotesList();
    return child;
  }

  /* Full-page database — just a page whose first block is a database block */
  function createDatabase(parentId) {
    const dbBlock = {
      id: uid(),
      type: "database",
      dbName: "Untitled database",
      schema: [
        {
          id: uid(),
          name: "Status",
          type: "select",
          options: ["Not started", "In progress", "Done"],
        },
      ],
      rows: [],
    };
    const note = {
      id: uid(),
      title: "Untitled database",
      icon: "🗄️",
      updated: Date.now(),
      pinned: false,
      type: "page",
      parentId: parentId || null,
      properties: { status: "not-started", tags: [] },
      customProperties: [],
      propValues: {},
      blocks: [dbBlock],
    };
    state.notes.push(note);
    if (parentId) expandedTreeIds.add(parentId);
    saveKey("notes");
    openNote(note.id);
    renderRecentNotes();
    setTimeout(() => {
      const t = $("#noteTitleInput");
      if (t) {
        t.focus();
        t.select();
      }
    }, 30);
  }

  function deleteNote(id) {
    const idsToRemove = new Set([id]);
    let grew = true;
    while (grew) {
      grew = false;
      state.notes.forEach((n) => {
        if (
          n.parentId &&
          idsToRemove.has(n.parentId) &&
          !idsToRemove.has(n.id)
        ) {
          idsToRemove.add(n.id);
          grew = true;
        }
      });
    }
    state.notes = state.notes.filter((n) => !idsToRemove.has(n.id));
    state.tasks.forEach((t) => {
      if (t.linkedNoteId && idsToRemove.has(t.linkedNoteId))
        t.linkedNoteId = null;
    });
    state.events.forEach((e) => {
      if (e.linkedNoteId && idsToRemove.has(e.linkedNoteId))
        e.linkedNoteId = null;
    });
    if (idsToRemove.has(activeNoteId)) activeNoteId = null;
    saveKey("notes");
    saveKey("tasks");
    saveKey("events");
    renderNotesList();
    renderEditor();
    renderRecentNotes();
    renderHome();
    toast("Deleted");
  }
  function initNotes() {
    $("#newNoteBtn").addEventListener("click", () => createNote(null));
    $("#newDatabaseBtn").addEventListener("click", () => createDatabase(null));
    renderNotesList();
    renderEditor();
  }

  /* ============ CALENDAR ============ */
  function renderCalendarView() {
    if (calView === "month") {
      $("#monthWrap").style.display = "";
      $("#weekWrap").style.display = "none";
      renderMonth();
    } else {
      $("#monthWrap").style.display = "none";
      $("#weekWrap").style.display = "";
      renderWeek();
    }
    renderLegend();
    renderUpcoming();
  }
  function renderMonth() {
    const first = new Date(calYear, calMonth, 1);
    const startDow = first.getDay();
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(calYear, calMonth, 0).getDate();
    $("#calPeriodLabel").textContent = first.toLocaleDateString(undefined, {
      month: "long",
      year: "numeric",
    });
    $("#calSubline").textContent = "Click a day to add something.";
    const body = $("#calBody");
    body.innerHTML = "";
    const todayStr = todayISO();
    const totalCells = Math.ceil((startDow + daysInMonth) / 7) * 7;
    for (let i = 0; i < totalCells; i++) {
      const cell = document.createElement("div");
      let dateStr,
        dayNum,
        isPad = false;
      if (i < startDow) {
        dayNum = daysInPrevMonth - startDow + i + 1;
        isPad = true;
      } else if (i >= startDow + daysInMonth) {
        dayNum = i - (startDow + daysInMonth) + 1;
        isPad = true;
      } else {
        dayNum = i - startDow + 1;
        dateStr = calYear + "-" + pad2(calMonth + 1) + "-" + pad2(dayNum);
      }
      cell.className =
        "cal-cell" +
        (isPad ? " pad" : "") +
        (dateStr === todayStr ? " today" : "");
      cell.innerHTML = `<div class="cal-daynum">${dayNum}</div>`;
      if (!isPad) {
        const dayEvents = visibleEvents()
          .filter((e) => e.date === dateStr)
          .sort((a, b) => (a.time || "99:99").localeCompare(b.time || "99:99"));
        dayEvents.slice(0, 3).forEach((ev) => {
          const tag = document.createElement("div");
          tag.className = "cal-evt";
          tag.style.background = labelOf(ev.label).color;
          tag.textContent = ev.title;
          tag.addEventListener("click", (e) => {
            e.stopPropagation();
            openEventModal(null, null, ev.id);
          });
          cell.appendChild(tag);
        });
        if (dayEvents.length > 3) {
          const more = document.createElement("div");
          more.className = "cal-more";
          more.textContent = `+${dayEvents.length - 3} more`;
          cell.appendChild(more);
        }
        cell.addEventListener("click", () => openEventModal(dateStr));
      }
      body.appendChild(cell);
    }
  }
  function startOfWeek(d) {
    const nd = new Date(d);
    nd.setDate(nd.getDate() - nd.getDay());
    nd.setHours(0, 0, 0, 0);
    return nd;
  }
  function renderWeek() {
    const start = startOfWeek(weekAnchor);
    const days = [...Array(7)].map((_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
    $("#calPeriodLabel").textContent =
      `${days[0].toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${days[6].toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
    $("#calSubline").textContent = "Click a time slot to add something.";
    const todayStr = todayISO();
    const head = $("#weekHead");
    head.innerHTML = "<div></div>";
    days.forEach((d) => {
      const c = document.createElement("div");
      c.className =
        "week-head-cell" + (isoDate(d) === todayStr ? " today" : "");
      c.innerHTML = `<div class="dname">${d.toLocaleDateString(undefined, { weekday: "short" })}</div><div class="dnum">${d.getDate()}</div>`;
      head.appendChild(c);
    });
    const allday = $("#weekAllday");
    allday.innerHTML = '<div class="week-allday-label">all-day</div>';
    days.forEach((d) => {
      const dateStr = isoDate(d);
      const c = document.createElement("div");
      c.className = "week-allday-cell";
      visibleEvents()
        .filter((e) => e.date === dateStr && !e.time)
        .forEach((e) => {
          const tag = document.createElement("div");
          tag.className = "cal-evt";
          tag.style.background = labelOf(e.label).color;
          tag.textContent = e.title;
          tag.style.cursor = "pointer";
          tag.addEventListener("click", (ev) => {
            ev.stopPropagation();
            openEventModal(null, null, e.id);
          });
          c.appendChild(tag);
        });
      allday.appendChild(c);
    });
    const hours = $("#weekHours");
    hours.innerHTML = "";
    for (let h = 0; h < 24; h++) {
      const hl = document.createElement("div");
      hl.className = "hour-label";
      hl.textContent =
        h === 0
          ? "12am"
          : h < 12
            ? h + "am"
            : h === 12
              ? "12pm"
              : h - 12 + "pm";
      hours.appendChild(hl);
    }
    const dayCols = $("#weekDays");
    dayCols.innerHTML = "";
    days.forEach((d) => {
      const dateStr = isoDate(d);
      const col = document.createElement("div");
      col.className = "week-day-col";
      for (let h = 0; h < 24; h++) {
        const hl = document.createElement("div");
        hl.className = "hour-line";
        hl.dataset.date = dateStr;
        hl.dataset.hour = h;
        col.appendChild(hl);
      }
      const timedEvents = visibleEvents().filter(
        (e) => e.date === dateStr && e.time,
      );
      timedEvents.forEach((e, i) => {
        const [h, m] = e.time.split(":").map(Number);
        const top = (h + m / 60) * 48;
        const evt = document.createElement("div");
        evt.className = "week-evt";
        evt.style.top = top + "px";
        evt.style.height = "34px";
        evt.style.background = labelOf(e.label).color;
        evt.style.marginLeft = (i % 2 === 0 ? 0 : 6) + "px";
        evt.style.cursor = "pointer";
        evt.textContent = `${formatTime(e.time)} ${e.title}`;
        evt.addEventListener("click", (ev) => {
          ev.stopPropagation();
          openEventModal(null, null, e.id);
        });
        col.appendChild(evt);
      });
      if (dateStr === todayStr) {
        const now = new Date();
        const top = (now.getHours() + now.getMinutes() / 60) * 48;
        const line = document.createElement("div");
        line.className = "now-line";
        line.style.top = top + "px";
        col.appendChild(line);
      }
      col.addEventListener("click", (e) => {
        const line = e.target.closest(".hour-line");
        if (!line) return;
        openEventModal(dateStr, pad2(Number(line.dataset.hour)) + ":00");
      });
      dayCols.appendChild(col);
    });
  }
  function renderLegend() {
    const box = $("#labelLegend");
    box.innerHTML = LABELS.map((l) => {
      const off = state.settings.hiddenLabels.includes(l.key);
      return `<div class="label-row${off ? " off" : ""}" data-key="${l.key}"><div class="ld" style="background:${l.color}"></div>${l.name}</div>`;
    }).join("");
    $$(".label-row", box).forEach((row) =>
      row.addEventListener("click", () => {
        const key = row.dataset.key;
        const idx = state.settings.hiddenLabels.indexOf(key);
        if (idx >= 0) state.settings.hiddenLabels.splice(idx, 1);
        else state.settings.hiddenLabels.push(key);
        saveKey("settings");
        renderCalendarView();
        renderAgenda();
        renderMiniCal();
      }),
    );
  }
  function renderUpcoming() {
    const card = $("#upcomingCard");
    const t = todayISO();
    const upcoming = visibleEvents()
      .filter((e) => e.date >= t)
      .sort((a, b) =>
        (a.date + (a.time || "99:99")).localeCompare(
          b.date + (b.time || "99:99"),
        ),
      )
      .slice(0, 12);
    if (upcoming.length === 0) {
      card.innerHTML = `<div class="empty">Nothing scheduled yet.</div>`;
      return;
    }
    card.innerHTML = upcoming
      .map((e) => {
        const d = new Date(e.date + "T00:00:00");
        return `<div class="upcoming-item" data-open-event="${e.id}" style="cursor:pointer;">
        <div class="upcoming-date"><div class="d">${d.getDate()}</div><div class="m">${d.toLocaleDateString(undefined, { month: "short" })}</div></div>
        <div><div class="upcoming-title">${escapeHtml(e.title)}${e.linkedNoteId ? noteChip(e.linkedNoteId) : ""}</div><div class="upcoming-time">${e.time ? formatTime(e.time) : "All day"}</div></div>
      </div>`;
      })
      .join("");
    $$("[data-open-event]", card).forEach((el) =>
      el.addEventListener("click", (e) => {
        if (e.target.closest("[data-open-note]")) return;
        openEventModal(null, null, el.dataset.openEvent);
      }),
    );
    wireNoteChips(card);
  }

  let editingDate = null,
    editingTime = "",
    editingEventTargetId = null;
  let pendingParticipants = [];
  let pendingEventLinks = [];
  function openEventModal(dateStr, time, eventId) {
    const existing = eventId
      ? state.events.find((e) => e.id === eventId)
      : null;
    editingEventId = existing ? existing.id : null;
    editingDate = dateStr;
    editingTime = time || "";
    $("#eventModalTitle").textContent = existing
      ? "Event details"
      : "Add event";
    $("#eventDeleteBtn").style.display = existing ? "" : "none";
    if (existing) {
      selectedEventLabel = existing.label;
      $("#eventTitleInput").value = existing.title;
      $("#eventDateInput").value = existing.date;
      $("#eventTimeInput").value = existing.time || "";
      $("#eventDescInput").value = existing.description || "";
      pendingParticipants = (existing.participants || []).slice();
      pendingEventLinks = (existing.links || []).slice();
      $("#eventReminderInput").value =
        existing.reminderMinutes === "" ||
        existing.reminderMinutes === undefined
          ? ""
          : String(existing.reminderMinutes);
    } else {
      selectedEventLabel = LABELS[0].key;
      $("#eventTitleInput").value = "";
      $("#eventDateInput").value = dateStr || todayISO();
      $("#eventTimeInput").value = editingTime;
      $("#eventDescInput").value = "";
      pendingParticipants = [];
      pendingEventLinks = [];
      $("#eventReminderInput").value = "";
    }
    renderEventLabelRow();
    renderParticipantChips();
    renderEventLinksList();
    populateNoteSelect($("#eventLinkSelect"), "None");
    $("#eventLinkSelect").value = existing ? existing.linkedNoteId || "" : "";
    $("#eventParticipantInput").value = "";
    $("#eventLinkNewInput").value = "";
    $("#eventOverlay").classList.add("open");
    $("#eventTitleInput").focus();
  }
  function renderEventLabelRow() {
    const row = $("#eventLabelRow");
    row.innerHTML = "";
    LABELS.forEach((l) => {
      const chip = document.createElement("div");
      chip.className =
        "label-chip" + (l.key === selectedEventLabel ? " sel" : "");
      chip.innerHTML = `<div class="d" style="background:${l.color}"></div>${l.name}`;
      chip.addEventListener("click", () => {
        selectedEventLabel = l.key;
        renderEventLabelRow();
      });
      row.appendChild(chip);
    });
  }
  function renderParticipantChips() {
    const row = $("#eventParticipantsRow");
    Array.from(row.querySelectorAll(".plain-chip")).forEach((c) => c.remove());
    const input = $("#eventParticipantInput");
    pendingParticipants.forEach((p, i) => {
      const chip = document.createElement("span");
      chip.className = "plain-chip";
      chip.innerHTML = `${escapeHtml(p)} <span class="x" data-i="${i}">✕</span>`;
      row.insertBefore(chip, input);
    });
    $$(".plain-chip .x", row).forEach((x) =>
      x.addEventListener("click", () => {
        pendingParticipants.splice(Number(x.dataset.i), 1);
        renderParticipantChips();
      }),
    );
  }
  function renderEventLinksList() {
    const box = $("#eventLinksList");
    box.innerHTML = pendingEventLinks
      .map(
        (url, i) =>
          `<div class="link-row-item"><a href="${escapeHtml(url)}" target="_blank" rel="noopener">${escapeHtml(url)}</a><span class="x" data-i="${i}" style="cursor:pointer; opacity:.6;">✕</span></div>`,
      )
      .join("");
    $$(".x", box).forEach((x) =>
      x.addEventListener("click", () => {
        pendingEventLinks.splice(Number(x.dataset.i), 1);
        renderEventLinksList();
      }),
    );
  }
  function initEventModal() {
    $("#addEventBtn").addEventListener("click", () =>
      openEventModal(todayISO()),
    );
    $("#eventCancel").addEventListener("click", () =>
      $("#eventOverlay").classList.remove("open"),
    );
    $("#eventOverlay").addEventListener("click", (e) => {
      if (e.target.id === "eventOverlay")
        $("#eventOverlay").classList.remove("open");
    });
    $("#eventParticipantInput").addEventListener("keydown", (e) => {
      if (e.key === "Enter" && e.target.value.trim()) {
        pendingParticipants.push(e.target.value.trim());
        e.target.value = "";
        renderParticipantChips();
      }
    });
    $("#eventLinkNewInput").addEventListener("keydown", (e) => {
      if (e.key === "Enter" && e.target.value.trim()) {
        let url = e.target.value.trim();
        if (!/^https?:\/\//i.test(url)) url = "https://" + url;
        pendingEventLinks.push(url);
        e.target.value = "";
        renderEventLinksList();
      }
    });
    $("#eventDeleteBtn").addEventListener("click", () => {
      if (!editingEventId) return;
      state.events = state.events.filter((e) => e.id !== editingEventId);
      saveKey("events");
      $("#eventOverlay").classList.remove("open");
      renderCalendarView();
      renderAgenda();
      renderMiniCal();
      renderHome();
      toast("Event deleted");
    });
    $("#eventSave").addEventListener("click", () => {
      const title = $("#eventTitleInput").value.trim();
      const date = $("#eventDateInput").value;
      const time = $("#eventTimeInput").value;
      const linkedNoteId = $("#eventLinkSelect").value || null;
      const description = $("#eventDescInput").value;
      const reminderVal = $("#eventReminderInput").value;
      const reminderMinutes = reminderVal === "" ? "" : Number(reminderVal);
      if (!title || !date) {
        toast("Add a title and date");
        return;
      }
      if (editingEventId) {
        const ev = state.events.find((e) => e.id === editingEventId);
        Object.assign(ev, {
          title,
          date,
          time,
          label: selectedEventLabel,
          linkedNoteId,
          description,
          participants: pendingParticipants.slice(),
          links: pendingEventLinks.slice(),
          reminderMinutes,
        });
        notifiedReminders.delete(ev.id);
      } else {
        state.events.push({
          id: uid(),
          title,
          date,
          time,
          label: selectedEventLabel,
          linkedNoteId,
          description,
          participants: pendingParticipants.slice(),
          links: pendingEventLinks.slice(),
          reminderMinutes,
        });
      }
      saveKey("events");
      $("#eventOverlay").classList.remove("open");
      renderCalendarView();
      renderAgenda();
      renderMiniCal();
      renderHome();
      toast(editingEventId ? "Event updated" : "Event added");
    });
  }

  /* ============ REMINDERS ============ */
  function checkReminders() {
    const now = new Date();
    state.events.forEach((ev) => {
      if (
        ev.reminderMinutes === "" ||
        ev.reminderMinutes === undefined ||
        !ev.time
      )
        return;
      if (notifiedReminders.has(ev.id)) return;
      const evTime = new Date(ev.date + "T" + ev.time + ":00");
      const fireAt = new Date(evTime.getTime() - ev.reminderMinutes * 60000);
      if (now >= fireAt && now <= evTime) {
        notifiedReminders.add(ev.id);
        const msg = `Reminder: ${ev.title} at ${formatTime(ev.time)}`;
        if (
          typeof Notification !== "undefined" &&
          Notification.permission === "granted"
        ) {
          try {
            new Notification(msg);
          } catch (e) {
            toast(msg);
          }
        } else {
          toast(msg);
        }
      }
    });
  }
  function initReminders() {
    if (
      typeof Notification !== "undefined" &&
      Notification.permission === "default"
    ) {
      try {
        Notification.requestPermission();
      } catch (e) {
        /* ignore */
      }
    }
    setInterval(checkReminders, 30000);
  }

  function initCalendarNav() {
    $("#prevPeriod").addEventListener("click", () => {
      if (calView === "month") {
        calMonth--;
        if (calMonth < 0) {
          calMonth = 11;
          calYear--;
        }
      } else {
        weekAnchor = new Date(weekAnchor);
        weekAnchor.setDate(weekAnchor.getDate() - 7);
      }
      renderCalendarView();
    });
    $("#nextPeriod").addEventListener("click", () => {
      if (calView === "month") {
        calMonth++;
        if (calMonth > 11) {
          calMonth = 0;
          calYear++;
        }
      } else {
        weekAnchor = new Date(weekAnchor);
        weekAnchor.setDate(weekAnchor.getDate() + 7);
      }
      renderCalendarView();
    });
    $("#todayBtn").addEventListener("click", () => {
      const now = new Date();
      calYear = now.getFullYear();
      calMonth = now.getMonth();
      weekAnchor = now;
      renderCalendarView();
    });
    $$("#viewSeg button").forEach((btn) =>
      btn.addEventListener("click", () => {
        calView = btn.dataset.v;
        $$("#viewSeg button").forEach((b) =>
          b.classList.toggle("active", b === btn),
        );
        renderCalendarView();
      }),
    );
  }

  /* ============ INIT ============ */
  async function init() {
    const now = new Date();
    calYear = now.getFullYear();
    calMonth = now.getMonth();
    miniYear = now.getFullYear();
    miniMonth = now.getMonth();
    weekAnchor = now;

    initNav();
    initHeader();
    initLinkModal();
    initEventModal();
    initCalendarNav();
    initCustomize();
    initThemeToggle();
    initSearch();
    initPropertyModal();
    initTaskDetailModal();

    await loadState();
    applyTheme();
    updateGreeting();
    renderHome();
    initNotes();
    initTasks();
    initReminders();
  }

  init();
})();
