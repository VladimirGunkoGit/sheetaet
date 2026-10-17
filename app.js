/* =================================================================
   Sheetaet — приложение (адреса, вход, данные, страницы).
   Дизайн и механики — из Gunco. Математика — core.js (SheetCore).
   Адреса: /<орг>/ · /<орг>/projects · /<орг>/projects/<id> · /<орг>/team · /<орг>/team/<id> · /<орг>/org   (+ ?m=YYYY-MM)
   ================================================================= */
(function () {
  "use strict";
  const CFG = window.SHEETAET_CONFIG || {};
  const C = window.SheetCore, CH = window.SheetCharts;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
  const fm = (m, o) => C.formatMoneyHTML(m, o), fmt = (m, o) => C.formatMoney(m, o);
  const BASE = location.pathname.startsWith("/sheetaet/") || location.pathname === "/sheetaet" ? "/sheetaet" : "";
  const DEMO = (/^(localhost|127\.0\.0\.1)$/.test(location.hostname) && new URLSearchParams(location.search).has("demo")) || !CFG.SUPABASE_URL;
  const sb = !DEMO && window.supabase ? window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true, storageKey: "sheetaet-auth" } }) : null;

  const PALETTE = ["150,153,163","231,200,106","126,196,232","199,138,74","232,155,184","134,217,152","178,150,232","110,206,197","232,120,120","245,166,110","124,146,236","210,128,196"];
  // цвета денег — везде одинаковые (ТЗ §8)
  const K = { income: "134,217,152", salary: "231,200,106", expense: "232,155,184", tax: "126,196,232", profit: "178,150,232", fixed: "232,120,120" };
  const KIND_LABEL = { income: "доход", salary: "зарплаты", expense: "расход", tax: "налоги", profit: "прибыль", fixed: "постоянные" };
  const EMOJIS = ["🎼","🎭","🎵","🎻","🎪","🏛️","💻","🎓","🕺","🪆","🏮","👁️","📁","📣","🎬","🎤","📷","🖥️","📱","🎨","✏️","📚","🌍","🧩","⚡","🔥","💡","📈","🛠️","🏢","🎯","🌱","🏠","☕","✈️","🚗","🎁","❤️","⭐","🎉"];
  const TRASH = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V5.5h6V7M6.5 7l.9 12.5h9.2L17.5 7"/></svg>`;
  const INCOME_DEFAULT = "Регулярный платеж", INCOME_NEW = "Поступление";
  const incTitle = (e) => (e.title || INCOME_DEFAULT).trim();
  const PLUS_TINY = `<svg viewBox="0 0 12 12" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M6 2v8M2 6h8"/></svg>`;
  const PLUS = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><path d="M12 6.5v11M6.5 12h11"/></svg>`;

  /* ================= СОСТОЯНИЕ ================= */
  const S = { slug: null, org: null, statuses: [], projects: [], employees: [], members: [], entries: [], people: [], month: C.monthKey(C.todayStr()), user: null, page: "", id: null, dashTab: localStorage.getItem("sheetaet_dash") || "nums", teamSort: "az", drafts: [] };
  const projById = (id) => S.projects.find((p) => p.id === id) || null;
  const empById = (id) => S.employees.find((e) => e.id === id) || null;
  const statusById = (id) => S.statuses.find((s) => s.id === id) || null;
  const membersOf = (pid) => S.members.filter((m) => m.project_id === pid).map((m) => m.employee_id);
  const projectsOf = (eid) => S.members.filter((m) => m.employee_id === eid).map((m) => m.project_id);

  /* ================= ДАННЫЕ ================= */
  async function q(p) { const { data, error } = await p; if (error) throw new Error(error.message || "ошибка сервера"); return data; }
  const DEMO_KEY = "sheetaet_demo_v1";
  const Demo = {
    read() { try { return JSON.parse(localStorage.getItem(DEMO_KEY)); } catch (e) { return null; } },
    write(d) { localStorage.setItem(DEMO_KEY, JSON.stringify(d)); },
    seed() {
      const org = { id: "demo-org", slug: S.slug || "demo", name: "Демо-студия", tax_rate: 7, profit_rate: 20, access_hash: null };
      const st = [{ id: "progress", name: "в работе", c: "126,196,232", ord: 1, done: false }, { id: "waiting", name: "ждёт начала", c: "231,200,106", ord: 2, done: false }, { id: "done", name: "готово", c: "134,217,152", ord: 999, done: true }];
      const P = [["🎼", "Фестиваль", "126,196,232", 18000000], ["🎭", "Театр", "232,155,184", 9000000], ["💻", "Сайт", "178,150,232", 30000000], ["🎪", "Цирк", "110,206,197", 15000000], ["📣", "Реклама", "245,166,110", 0]];
      const names = [["Анна", "Иванова"], ["Борис", "Петров"], ["Вера", "Сидорова"], ["Глеб", "Орлов"], ["Дина", "Козлова"], ["Егор", "Смирнов"]];
      const projects = P.map((p, i) => ({ id: "p" + i, org_id: org.id, emoji: p[0], name: p[1], color: p[2], status: p[3] ? "progress" : "waiting", sort: i, start_date: "2026-01-15", end_date: "2026-12-31", profit_rate: null, note: "" }));
      const employees = names.map((n, i) => ({ id: "e" + i, org_id: org.id, first_name: n[0], last_name: n[1], pay_day: [10, 10, 25, 5, 10, 15][i], note: "", active: true }));
      const members = [], entries = [];
      const cur = C.monthKey(C.todayStr()), prev = C.addMonths(cur, -1);
      [prev, cur].forEach((mk, mi) => P.forEach((p, i) => {
        if (!p[3]) return;
        entries.push({ id: uid(), org_id: org.id, project_id: "p" + i, kind: "income", date: C.dayInMonth(mk, 5), amount_minor: p[3] + mi * 1000000 * (i % 2 ? -1 : 1) });
        [i % 6, (i + 2) % 6].forEach((e, k) => { if (!members.some((m) => m.project_id === "p" + i && m.employee_id === "e" + e)) members.push({ project_id: "p" + i, employee_id: "e" + e, org_id: org.id }); entries.push({ id: uid(), org_id: org.id, project_id: "p" + i, kind: "salary", date: C.dayInMonth(mk, employees[e].pay_day), amount_minor: (k ? 2500000 : 4000000) + mi * 500000, employee_id: "e" + e, title: null }); });
        entries.push({ id: uid(), org_id: org.id, project_id: "p" + i, kind: "expense", date: C.dayInMonth(mk, 15), amount_minor: 800000 + i * 300000, title: ["распространение", "сервер", "реклама", "техника"][i % 4] });
      }));
      [["офис", 5200000], ["бухгалтер", 675000], ["банк", 550000]].forEach(([t, a]) => [prev, cur].forEach((mk) => entries.push({ id: uid(), org_id: org.id, project_id: null, kind: "org_expense", date: C.dayInMonth(mk, 1), amount_minor: a, title: t })));
      return { org, statuses: st, projects, employees, members, entries };
    },
    get() { let d = this.read(); if (!d) { d = this.seed(); this.write(d); } return d; },
  };
  const TBL = { projects: "projects", employees: "employees", entries: "entries", statuses: "statuses", project_members: "members" };
  const DB = {
    async load(slug) {
      if (DEMO) { const d = Demo.get(); d.org.slug = slug; return { ...d, people: [{ email: "demo@sheetaet", role: "owner" }] }; }
      const org = await q(sb.from("orgs").select("*").eq("slug", slug).maybeSingle());
      if (!org) return null;
      const [statuses, projects, employees, members, entries, people] = await Promise.all([
        q(sb.from("statuses").select("*").eq("org_id", org.id).order("ord")),
        q(sb.from("projects").select("*").eq("org_id", org.id)),
        q(sb.from("employees").select("*").eq("org_id", org.id)),
        q(sb.from("project_members").select("*").eq("org_id", org.id)),
        q(sb.from("entries").select("*").eq("org_id", org.id)),
        q(sb.rpc("org_people", { p_org: org.id })).catch(() => []),
      ]);
      return { org, statuses, projects, employees, members, entries, people };
    },
    async insert(table, row) {
      const full = { ...row, org_id: S.org.id };
      if (DEMO) { const d = Demo.get(); const r = { id: row.id || uid(), created_at: new Date().toISOString(), ...full }; d[TBL[table]].push(r); Demo.write(d); return r; }
      return await q(sb.from(table).insert(full).select().single());
    },
    async insertMany(table, rows) { const out = []; if (!DEMO) { if (!rows.length) return out; return await q(sb.from(table).insert(rows.map((r) => ({ ...r, org_id: S.org.id }))).select()); } for (const r of rows) out.push(await this.insert(table, r)); return out; },
    async update(table, id, patch) {
      if (DEMO) { const d = Demo.get(); const r = d[TBL[table]].find((x) => x.id === id); if (r) Object.assign(r, patch); Demo.write(d); return; }
      await q(sb.from(table).update(patch).eq("id", id));
    },
    async remove(table, id) {
      if (DEMO) { const d = Demo.get(); d[TBL[table]] = d[TBL[table]].filter((x) => x.id !== id); if (table === "projects") { d.entries = d.entries.filter((e) => e.project_id !== id); d.members = d.members.filter((m) => m.project_id !== id); } Demo.write(d); return; }
      await q(sb.from(table).delete().eq("id", id));
    },
    async addMember(pid, eid) {
      if (S.members.some((m) => m.project_id === pid && m.employee_id === eid)) return;
      const row = { project_id: pid, employee_id: eid, org_id: S.org.id }; S.members.push(row);
      if (DEMO) { const d = Demo.get(); d.members.push(row); Demo.write(d); return; }
      await q(sb.from("project_members").upsert(row));
    },
    async removeMember(pid, eid) {
      S.members = S.members.filter((m) => !(m.project_id === pid && m.employee_id === eid));
      if (DEMO) { const d = Demo.get(); d.members = d.members.filter((m) => !(m.project_id === pid && m.employee_id === eid)); Demo.write(d); return; }
      await q(sb.from("project_members").delete().eq("project_id", pid).eq("employee_id", eid));
    },
    async updateOrg(patch) { Object.assign(S.org, patch); if (DEMO) { const d = Demo.get(); Object.assign(d.org, patch); Demo.write(d); return; } await q(sb.from("orgs").update(patch).eq("id", S.org.id)); },
    async addStatus(row) { if (DEMO) { const d = Demo.get(); d.statuses.push(row); Demo.write(d); return row; } return await q(sb.from("statuses").insert({ ...row, org_id: S.org.id }).select().single()); },
    async removeStatus(id) {
      if (DEMO) { const d = Demo.get(); d.statuses = d.statuses.filter((s) => s.id !== id); d.projects.forEach((p) => { if (p.status === id) p.status = "progress"; }); Demo.write(d); return; }
      await q(sb.from("projects").update({ status: "progress" }).eq("org_id", S.org.id).eq("status", id));
      await q(sb.from("statuses").delete().eq("org_id", S.org.id).eq("id", id));
    },
  };
  // обёртка: ошибка → тост, данные не теряем молча
  async function safe(fn, msg) { try { return await fn(); } catch (e) { toast((msg || "не сохранилось") + ": " + e.message); throw e; } }

  /* ================= ТОСТ, ОТМЕНА, ПОДТВЕРЖДЕНИЕ ================= */
  function toast(t) { const el = $("#toast"); el.textContent = t; el.hidden = false; clearTimeout(el._t); el._t = setTimeout(() => (el.hidden = true), 1800); }
  const Undo = [];
  function pushUndo(label, fn) { Undo.push({ label, fn }); }
  async function undoLast() { const it = Undo.pop(); if (!it) return toast("нечего отменять"); try { await it.fn(); } catch (e) {} render(); toast("отменено: " + it.label); }
  document.addEventListener("keydown", (e) => { const z = e.code === "KeyZ"; if ((e.metaKey || e.ctrlKey) && z && !e.shiftKey) { const a = document.activeElement; if (a && (a.isContentEditable || /INPUT|TEXTAREA/.test(a.tagName))) return; e.preventDefault(); undoLast(); } });

  /* ================= МОДАЛКИ ================= */
  function modal(inner, cls) {
    const m = document.createElement("div"); m.className = "modal";
    m.innerHTML = `<div class="modal-card ${cls || ""}">${inner}</div>`;
    m.addEventListener("click", (e) => { if (e.target === m) close(m); });
    $("#modals").appendChild(m); return m;
  }
  function close(m) { if (!m || !m.isConnected) return; const f = m._onClose; m._onClose = null; m.remove(); if (f) f(); }
  const topModal = () => $$("#modals .modal").pop();
  function confirmBox(title, sub, yes) {
    return new Promise((res) => {
      const m = modal(`<div class="modal-title">${esc(title)}</div>${sub ? `<div class="confirm-sub">${esc(sub)}</div>` : ""}<div class="form-actions"><button class="btn btn--solid" data-y>${esc(yes || "Да")}</button><button class="btn" data-n>Отмена</button></div>`, "confirm-card");
      m._onClose = () => res(false);
      $("[data-y]", m).onclick = () => { m._onClose = null; m.remove(); res(true); };
      $("[data-n]", m).onclick = () => close(m);
    });
  }
  function inputBox({ title, sub, value, placeholder, type, okLabel, money }) {
    return new Promise((res) => {
      const m = modal(`<div class="modal-title">${esc(title)}</div>${sub ? `<div class="confirm-sub">${esc(sub)}</div>` : ""}
        <input class="field ${money ? "field--amount" : ""}" type="${type || "text"}" ${money ? 'inputmode="decimal"' : ""} placeholder="${esc(placeholder || "")}" value="${esc(value || "")}" />
        <div class="minput-err" hidden></div>
        <div class="form-actions"><button class="btn btn--solid" data-y>${esc(okLabel || "Готово")}</button><button class="btn" data-n>Отмена</button></div>`);
      m._onClose = () => res(null);
      const inp = $("input", m); setTimeout(() => inp.focus(), 40);
      const ok = () => { m._onClose = null; m.remove(); res(inp.value); };
      $("[data-y]", m).onclick = ok; inp.onkeydown = (e) => { if (e.key === "Enter") ok(); };
      $("[data-n]", m).onclick = () => close(m);
    });
  }
  // календарь (как в Gunco)
  function pickDate(value, opts) {
    opts = opts || {};
    return new Promise((res) => {
      const base = (value || C.todayStr()).split("-").map(Number); let y = base[0], mo = base[1] - 1;
      const m = modal(`<div class="cal-head"><button class="icon-btn" data-p>‹</button><div class="cal-title-wrap"><div class="cal-title"></div></div><button class="icon-btn" data-nx>›</button></div>
        <div class="cal-weekdays"><span>пн</span><span>вт</span><span>ср</span><span>чт</span><span>пт</span><span>сб</span><span>вс</span></div><div class="cal-grid"></div>
        ${opts.openEnded ? `<button class="cal-open-end ${opts.isOpen ? "is-on" : ""}" data-open-end>бессрочно</button>` : ""}
        <div class="cal-actions"><button class="btn" data-n>Отмена</button></div>`, "cal-card");
      m._onClose = () => res(null);
      const draw = () => {
        $(".cal-title", m).textContent = `${C.MONTHS[mo]} ${y}`;
        const off = (new Date(y, mo, 1).getDay() + 6) % 7, days = new Date(y, mo + 1, 0).getDate(), t = C.todayStr();
        let h = ""; for (let i = 0; i < off; i++) h += `<span class="cal-day empty"></span>`;
        for (let d = 1; d <= days; d++) { const ds = `${y}-${String(mo + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`; h += `<button class="cal-day ${ds === t ? "today" : ""} ${ds === value ? "sel" : ""}" data-d="${ds}">${d}</button>`; }
        // всегда 6 недель: высота окна одинаковая для любого месяца — стрелки не уезжают из-под курсора
        for (let i = off + days; i < 42; i++) h += `<span class="cal-day empty"></span>`;
        $(".cal-grid", m).innerHTML = h;
        $$("[data-d]", m).forEach((b) => (b.onclick = () => { m._onClose = null; m.remove(); res(b.dataset.d); }));
      };
      $("[data-p]", m).onclick = () => { mo--; if (mo < 0) { mo = 11; y--; } draw(); };
      $("[data-nx]", m).onclick = () => { mo++; if (mo > 11) { mo = 0; y++; } draw(); };
      $("[data-n]", m).onclick = () => close(m);
      const oe = $("[data-open-end]", m); if (oe) oe.onclick = () => { m._onClose = null; m.remove(); res("open"); };
      draw();
    });
  }
  function pickDay(value, title, note) {
    return new Promise((res) => {
      const m = modal(`<div class="modal-title">${esc(title || "день выплаты")}</div><div class="day-grid">${Array.from({ length: 31 }, (_, i) => `<button class="cal-day ${i + 1 === value ? "sel" : ""}" data-d="${i + 1}">${i + 1}</button>`).join("")}</div><div class="money-note">${esc(note || "если в месяце меньше дней — в последний день месяца")}</div>`, "cal-card");
      m._onClose = () => res(null);
      $$("[data-d]", m).forEach((b) => (b.onclick = () => { m._onClose = null; m.remove(); res(+b.dataset.d); }));
    });
  }
  function pickEmoji(cur) {
    return new Promise((res) => {
      const m = modal(`<div class="modal-title">эмодзи</div><input class="field" maxlength="8" placeholder="свой эмодзи (клавиатура)" /><div class="emoji-grid scroll">${EMOJIS.map((e) => `<button class="emoji-cell ${e === cur ? "is-cur" : ""}" data-e="${e}">${e}</button>`).join("")}</div>`, "emoji-card");
      m._onClose = () => res(null);
      $$("[data-e]", m).forEach((b) => (b.onclick = () => { m._onClose = null; m.remove(); res(b.dataset.e); }));
      $("input", m).oninput = (e) => { const v = [...e.target.value.trim()]; if (v.length) { m._onClose = null; m.remove(); res(v[v.length - 1]); } };
    });
  }
  function pickColor(cur) {
    return new Promise((res) => {
      const m = modal(`<div class="modal-title">цвет проекта</div><div class="statusform-swatches">${PALETTE.map((c) => `<button class="swatch ${c === cur ? "is-cur" : ""}" data-c="${c}" style="--c:${c}"><span class="status-dot"></span></button>`).join("")}</div><div class="money-note">цвет нужен для диаграммы доходов</div>`);
      m._onClose = () => res(null);
      $$("[data-c]", m).forEach((b) => (b.onclick = () => { m._onClose = null; m.remove(); res(b.dataset.c); }));
    });
  }
  const statusDot = (s) => `<span class="status-dot" style="--c:${s ? s.c : "150,153,163"}"></span>`;
  const statusPill = (id) => { const s = statusById(id); return `<span class="status-pill" style="--c:${s ? s.c : "150,153,163"}"><span>${esc(s ? s.name : "без статуса")}</span>${statusDot(s)}</span>`; };
  // новый статус: название + цвет огонька (палитра как у проектов), сверху — живой предпросмотр плашки
  function statusForm(c0) {
    return new Promise((res) => {
      let c = c0;
      const m = modal(`<div class="modal-title">новый статус</div>
        <div class="statusform-preview"><span class="status-pill" style="--c:${c}"><span data-pv>название</span><span class="status-dot" style="--c:${c}"></span></span></div>
        <input class="field" maxlength="40" placeholder="название" />
        <div class="statusform-swatches">${PALETTE.map((x) => `<button class="swatch ${x === c ? "is-cur" : ""}" data-c="${x}" style="--c:${x}" aria-label="цвет"><span class="status-dot"></span></button>`).join("")}</div>
        <div class="form-actions"><button class="btn btn--solid" data-y>Создать</button><button class="btn" data-n>Отмена</button></div>`);
      m._onClose = () => res(null);
      const inp = $("input", m), pill = $(".statusform-preview .status-pill", m);
      setTimeout(() => inp.focus(), 40);
      inp.oninput = () => { $("[data-pv]", m).textContent = inp.value.trim() || "название"; };
      $$("[data-c]", m).forEach((b) => (b.onclick = () => { c = b.dataset.c; $$("[data-c]", m).forEach((x) => x.classList.toggle("is-cur", x === b)); pill.style.setProperty("--c", c); $(".status-dot", pill).style.setProperty("--c", c); inp.focus(); }));
      const ok = () => { if (!inp.value.trim()) { inp.focus(); return; } m._onClose = null; m.remove(); res({ name: inp.value.trim(), c }); };
      $("[data-y]", m).onclick = ok; inp.onkeydown = (e) => { if (e.key === "Enter") ok(); };
      $("[data-n]", m).onclick = () => close(m);
    });
  }
  function pickStatus(cur) {
    return new Promise((res) => {
      const draw = () => {
        const old = topModal(); if (old && old._status) old.remove();
        const m = modal(`<div class="modal-title">статус</div><div class="status-list"><button class="status-add" data-add aria-label="Новый статус">${PLUS}</button>${S.statuses.map((s) => `<button class="status-pill ${s.id === cur ? "is-cur" : ""}" data-k="${s.id}" style="--c:${s.c}"><span>${esc(s.name)}</span>${statusDot(s)}${["progress", "waiting", "done"].includes(s.id) ? "" : `<span class="status-del" data-del="${s.id}">×</span>`}</button>`).join("")}</div>`);
        m._status = true; m._onClose = () => res(null);
        $$("[data-k]", m).forEach((b) => (b.onclick = async (e) => {
          if (e.target.closest("[data-del]")) { if (await confirmBox("Удалить статус?", "проекты с ним перейдут в «в работе»")) { await DB.removeStatus(b.dataset.k); S.statuses = S.statuses.filter((s) => s.id !== b.dataset.k); S.projects.forEach((p) => { if (p.status === b.dataset.k) p.status = "progress"; }); m.remove(); draw(); } return; }
          m._onClose = null; m.remove(); res(b.dataset.k);
        }));
        $("[data-add]", m).onclick = async () => {
          const f = await statusForm(PALETTE[(S.statuses.length * 5) % PALETTE.length]); if (!f) return;
          const { name, c } = f;
          const row = await DB.addStatus({ id: uid().slice(0, 8), name: name.trim(), c, ord: S.statuses.filter((s) => !s.done).length + 1, done: false });
          S.statuses.push(row); S.statuses.sort((a, b) => a.ord - b.ord); m._onClose = null; m.remove(); res(row.id);
        };
      };
      draw();
    });
  }
  // проекты: мультивыбор (возвращает массив id) — как пикер проектов Gunco
  function pickProjects(ids, title) {
    return new Promise((res) => {
      const sel = new Set(ids || []);
      const m = modal(`<div class="modal-title">${esc(title || "проекты")}</div><div class="search-wrap"><input class="field field--search" placeholder=" " /><svg class="search-ico" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/></svg></div><div class="proj-list scroll"></div><button class="modal-clear" data-ok>готово</button>`, "pick-modal");
      m._onClose = () => res([...sel]);
      const draw = () => {
        const qv = $("input", m).value.trim().toLowerCase();
        const list = orderedProjects().filter((p) => !qv || (p.name || "").toLowerCase().includes(qv));
        $(".proj-list", m).innerHTML = `<button class="proj-add-row" data-new>${PLUS}</button>` + list.map((p) => `<button class="proj-pill ${sel.has(p.id) ? "is-on" : ""}" data-id="${p.id}"><span class="proj-emoji">${esc(p.emoji || "📁")}</span><span class="proj-name">${esc(p.name)}</span></button>`).join("");
        $$("[data-id]", m).forEach((b) => (b.onclick = () => { sel.has(b.dataset.id) ? sel.delete(b.dataset.id) : sel.add(b.dataset.id); draw(); }));
        $("[data-new]", m).onclick = async () => { const n = await inputBox({ title: "новый проект", placeholder: "название" }); if (!n || !n.trim()) return; const p = await createProject(n.trim()); sel.add(p.id); draw(); };
      };
      $("input", m).oninput = draw; $("[data-ok]", m).onclick = () => close(m);
      draw();
    });
  }
  // сотрудник (одиночный выбор): сначала занятые в проекте
  function pickEmployee(cur, projectId) {
    return new Promise((res) => {
      const m = modal(`<div class="modal-title">кому</div><div class="search-wrap"><input class="field field--search" placeholder=" " /><svg class="search-ico" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/></svg></div><div class="proj-list scroll"></div>`, "pick-modal");
      m._onClose = () => res(null);
      const mem = new Set(projectId ? membersOf(projectId) : []);
      const draw = () => {
        const qv = $("input", m).value.trim().toLowerCase();
        const list = S.employees.filter((e) => e.active !== false && (!qv || C.fullName(e).toLowerCase().includes(qv))).sort((a, b) => (mem.has(b.id) - mem.has(a.id)) || byName(a, b));
        let h = `<button class="proj-add-row" data-new>${PLUS}${qv ? `<span class="proj-name">&nbsp;создать «${esc(qv)}»</span>` : ""}</button>`;
        let sep = false;
        list.forEach((e) => { if (!sep && mem.size && !mem.has(e.id)) { h += `<div class="pick-sep">остальные</div>`; sep = true; } h += `<button class="proj-pill ${e.id === cur ? "is-cur" : ""}" data-id="${e.id}"><span class="proj-name">${esc(C.fullName(e) || "без имени")}</span></button>`; });
        $(".proj-list", m).innerHTML = h;
        $$("[data-id]", m).forEach((b) => (b.onclick = () => { m._onClose = null; m.remove(); res(b.dataset.id); }));
        $("[data-new]", m).onclick = async () => { const n = qv ? $("input", m).value.trim() : await inputBox({ title: "новый сотрудник", placeholder: "Имя Фамилия" }); if (!n || !n.trim()) return; const e = await createEmployee(n.trim()); m._onClose = null; m.remove(); res(e.id); };
      };
      $("input", m).oninput = draw; draw(); setTimeout(() => $("input", m).focus(), 40);
    });
  }

  /* ================= СВАЙП (из Gunco) ================= */
  let justSwiped = false;
  function attachSwipe(el, onDelete) {
    const fg = el.querySelector(".swipe-row"); let sx = 0, sy = 0, dx = 0, drag = false;
    el.addEventListener("touchstart", (e) => { if (e.target.closest("input,[contenteditable]")) { drag = false; return; } const t = e.touches[0]; sx = t.clientX; sy = t.clientY; dx = 0; drag = true; fg.style.transition = "none"; }, { passive: true });
    el.addEventListener("touchmove", (e) => { if (!drag) return; const t = e.touches[0]; const mx = t.clientX - sx, my = t.clientY - sy; if (Math.abs(my) > Math.abs(mx) && Math.abs(my) > 8) { drag = false; fg.style.transform = ""; el.classList.remove("swiping"); return; } dx = Math.min(0, mx); fg.style.transform = `translateX(${dx}px)`; el.classList.toggle("swiping", dx < 0); }, { passive: true });
    el.addEventListener("touchend", async () => { if (!drag) return; drag = false; fg.style.transition = "transform .2s"; if (dx < -70) { justSwiped = true; setTimeout(() => (justSwiped = false), 400); fg.style.transform = "translateX(-100%)"; if (await confirmBox("Удалить?")) await onDelete(); else { fg.style.transform = "translateX(0)"; setTimeout(() => el.classList.remove("swiping"), 200); } } else { fg.style.transform = "translateX(0)"; setTimeout(() => el.classList.remove("swiping"), 200); } });
  }

  /* ================= АДРЕСА ================= */
  function parsePath() {
    let p = location.pathname.slice(BASE.length).replace(/^\/+|\/+$/g, "");
    const seg = p ? p.split("/") : [];
    const m = new URLSearchParams(location.search).get("m");
    return { slug: seg[0] || null, page: seg[1] || "", id: seg[2] || null, month: /^\d{4}-\d{2}$/.test(m || "") ? m : null };
  }
  function urlFor(page, id, month) {
    const qs = new URLSearchParams(); if (DEMO) qs.set("demo", "1"); const mm = month || S.month; if (mm && mm !== C.monthKey(C.todayStr())) qs.set("m", mm);
    return `${BASE}/${S.slug}/${page ? page + "/" : ""}${id ? id : ""}`.replace(/\/$/, page || id ? "" : "/") + (qs.toString() ? "?" + qs : "");
  }
  function go(page, id, opts) {
    opts = opts || {};
    const u = urlFor(page, id, opts.month);
    // переход внутри приложения помечаем — тогда «назад» вернёт ровно на предыдущую страницу
    if (opts.replace) history.replaceState(history.state, "", u); else history.pushState({ app: 1 }, "", u);
    route();
  }
  window.addEventListener("popstate", route);
  function setMonth(key) {
    S.month = key; history.replaceState(history.state, "", urlFor(S.page, S.id));
    const sc = $("#main .scroll, #main .sh-pane"), top = sc ? sc.scrollTop : 0;
    render();
    const sc2 = $("#main .scroll, #main .sh-pane"); if (sc2) sc2.scrollTop = top;
  }
  // телефон: таблица по году, видна одна колонка месяца; компьютер: весь год
  const isMobile = () => window.matchMedia("(max-width: 767px)").matches;
  let wasMobile = isMobile();
  window.addEventListener("resize", () => { if (isMobile() !== wasMobile) { wasMobile = isMobile(); render(); } });
  // «назад» из карточки: туда, откуда пришли (главная, проект, сотрудник, архив…); если карточку открыли по ссылке — в список
  function goBack(fallback) { if (history.state && history.state.app) history.back(); else go(fallback != null ? fallback : S.page, null, { replace: true }); }

  /* ================= ВХОД ================= */
  function authMsg(t, err) { const el = $("#auth-msg"); el.textContent = t || ""; el.classList.toggle("is-error", !!err); }
  async function boot() {
    const r = parsePath();
    if (!r.slug) { S.slug = "sut-media"; history.replaceState(null, "", `${BASE}/sut-media/${DEMO ? "?demo=1" : ""}`); return boot(); }
    S.slug = r.slug;
    if (DEMO) return enterApp();
    const { data } = await sb.auth.getSession();
    if (data.session) { S.user = data.session.user; return enterApp(); }
    showGate();
  }
  async function showGate() {
    $("#app").hidden = true; $("#auth").hidden = false; authMsg("");
    let info = null; try { const rows = await q(sb.rpc("org_public", { p_slug: S.slug })); info = rows && rows[0]; } catch (e) {}
    $("#auth-org-name").textContent = info ? info.name : "";
    const passed = localStorage.getItem("sheetaet_gate_" + S.slug) === "1";
    if (info && info.has_password && !passed) { $("#gate-form").hidden = false; $("#login-form").hidden = true; $("#gate-slug").value = S.slug; setTimeout(() => $("#gate-pass").focus(), 50); }
    else { $("#gate-form").hidden = true; $("#login-form").hidden = false; if (!info) authMsg("организация «" + S.slug + "» не найдена", true); }
  }
  $("#gate-form").addEventListener("submit", async (e) => {
    e.preventDefault(); authMsg("…");
    const slug = $("#gate-slug").value.trim().toLowerCase();
    try {
      const ok = await q(sb.rpc("org_check", { p_slug: slug, p_password: $("#gate-pass").value }));
      if (!ok) return authMsg("неверная организация или пароль", true);
      localStorage.setItem("sheetaet_gate_" + slug, "1"); $("#gate-pass").value = "";
      if (slug !== S.slug) { S.slug = slug; history.replaceState(null, "", `${BASE}/${slug}/`); }
      showGate();
    } catch (err) { authMsg(err.message, true); }
  });
  $("#login-form").addEventListener("submit", async (e) => {
    e.preventDefault(); authMsg("…");
    const { data, error } = await sb.auth.signInWithPassword({ email: $("#login-email").value.trim(), password: $("#login-pass").value });
    if (error) return authMsg(/Invalid login/i.test(error.message) ? "неверный e-mail или пароль" : error.message, true);
    $("#login-pass").value = ""; S.user = data.user; enterApp();
  });
  $("#login-forgot").addEventListener("click", async () => {
    const email = $("#login-email").value.trim(); if (!email) return authMsg("введите e-mail", true);
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + BASE + "/" + S.slug + "/" });
    authMsg(error ? error.message : "письмо для сброса пароля отправлено", !!error);
  });
  async function logout() { if (sb) await sb.auth.signOut(); localStorage.removeItem("sheetaet_gate_" + S.slug); location.href = `${BASE}/${S.slug}/`; }
  async function enterApp() {
    let d = null;
    try { d = await DB.load(S.slug); } catch (e) { authMsg(e.message, true); }
    if (!d) { $("#app").hidden = true; $("#auth").hidden = false; $("#gate-form").hidden = true; $("#login-form").hidden = true; authMsg("у этого аккаунта нет доступа к организации «" + S.slug + "»", true); $("#auth-msg").insertAdjacentHTML("afterend", `<button class="btn" id="auth-out">выйти</button>`); $("#auth-out").onclick = logout; return; }
    Object.assign(S, d); S.statuses.sort((a, b) => a.ord - b.ord);
    $("#auth").hidden = true; $("#app").hidden = false;
    route();
    startRealtime();
    notifyDue(); setInterval(notifyDue, 60 * 60 * 1000);
  }

  /* ================= РЕАЛЬНОЕ ВРЕМЯ =================
     Изменения других участников приходят сразу (Supabase Realtime, с учётом RLS) и применяются к данным в памяти.
     Перерисовка — не во время ввода и не при открытом окне: ждём, пока пользователь закончит. Прокрутка сохраняется.
     После долгого перерыва (вкладка была скрыта > 1 мин) данные перечитываются целиком. */
  const RT_ARR = { entries: "entries", projects: "projects", employees: "employees", project_members: "members", statuses: "statuses" };
  let rtTimer = null;
  function rtApply(table, ev) {
    const n = ev.new && Object.keys(ev.new).length ? ev.new : null, o = ev.old || {}, del = ev.eventType === "DELETE";
    if (table === "orgs") { if (n && S.org && n.id === S.org.id) Object.assign(S.org, n); }
    else if (table === "project_members") {
      if (del) S.members = S.members.filter((m) => !(m.project_id === o.project_id && m.employee_id === o.employee_id));
      else if (n && n.org_id === S.org.id && !S.members.some((m) => m.project_id === n.project_id && m.employee_id === n.employee_id)) S.members.push(n);
    } else {
      const key = RT_ARR[table]; if (!key) return;
      if (del) { if (o.id == null || !S[key].some((x) => x.id === o.id)) return; S[key] = S[key].filter((x) => x.id !== o.id); }
      else if (n && n.org_id === S.org.id) { const ex = S[key].find((x) => x.id === n.id); if (ex) Object.assign(ex, n); else S[key].push(n); if (key === "statuses") S.statuses.sort((a, b) => a.ord - b.ord); }
      else return;
    }
    scheduleRender();
  }
  function busy() { const a = document.activeElement; return !!$("#modals .modal") || !!(a && (a.isContentEditable || /INPUT|TEXTAREA|SELECT/.test(a.tagName))); }
  function scheduleRender() {
    clearTimeout(rtTimer);
    rtTimer = setTimeout(() => {
      if (busy()) { scheduleRender(); return; }
      const sc = $("#main .scroll, #main .sh-pane"), top = sc ? sc.scrollTop : 0, w = $("#main .yt-wrap"), left = w ? w.scrollLeft : 0;
      render();
      const sc2 = $("#main .scroll, #main .sh-pane"); if (sc2) sc2.scrollTop = top;
      const w2 = $("#main .yt-wrap"), h2 = $("#main .yt-head"); if (w2) { w2.scrollLeft = left; if (h2) h2.scrollLeft = left; }
    }, 500);
  }
  function startRealtime() {
    if (DEMO || !sb || !S.org) return;
    const ch = sb.channel("org-" + S.org.id);
    Object.keys(RT_ARR).forEach((t) => {
      ch.on("postgres_changes", { event: "*", schema: "public", table: t, filter: `org_id=eq.${S.org.id}` }, (ev) => rtApply(t, ev));
      ch.on("postgres_changes", { event: "DELETE", schema: "public", table: t }, (ev) => rtApply(t, ev));   // удаления по org не фильтруются
    });
    ch.on("postgres_changes", { event: "UPDATE", schema: "public", table: "orgs", filter: `id=eq.${S.org.id}` }, (ev) => rtApply("orgs", ev));
    ch.subscribe();
    let hiddenAt = 0;
    document.addEventListener("visibilitychange", async () => {
      if (document.hidden) { hiddenAt = Date.now(); return; }
      if (hiddenAt && Date.now() - hiddenAt > 60000) { try { const d = await DB.load(S.slug); if (d) { Object.assign(S, d); S.statuses.sort((a, b) => a.ord - b.ord); scheduleRender(); } } catch (e) {} }
    });
  }
  if (DEMO) window.__sheetaetRT = rtApply;   // только в демо: проверка применения событий

  /* ================= КАРКАС ================= */
  const TITLES = { "": "главная", projects: "проекты", team: "сотрудники", org: "организация" };
  function route() {
    const r = parsePath();
    if (r.slug && r.slug !== S.slug) { location.reload(); return; }
    S.page = r.page; S.id = r.id; if (r.month) S.month = r.month;
    render();
  }
  function render() {
    if (!S.org) return;
    const page = S.page, isCard = !!S.id;
    $("#page-title").textContent = isCard ? "" : TITLES[page] || "";
    $("#page-title").hidden = isCard;
    $("#back-btn").hidden = !isCard;
    $("#page-nav").hidden = isCard;
    $("#fab").hidden = isCard || !(page === "projects" || page === "team");
    $$("#page-nav .nav-item").forEach((b) => b.classList.toggle("active", b.dataset.go === page));
    $("#account-pop").hidden = true;
    $("#page-tools").innerHTML = "";
    const main = $("#main");
    if (page === "" ) renderDashboard(main);
    else if (page === "projects" && S.id) renderProject(main);
    else if (page === "projects") renderProjects(main);
    else if (page === "team" && S.id) renderEmployee(main);
    else if (page === "team") renderTeam(main);
    else if (page === "org") renderOrg(main);
    else go("", null, { replace: true });
    const st = $("#main .sh-month.is-sticky"); if (st) { const sc = st.closest(".sh-pane, .taskcard"); if (sc) st.style.top = -parseFloat(getComputedStyle(sc).paddingTop || 0) + "px"; }
  }
  $$("#page-nav .nav-item").forEach((b) => b.addEventListener("click", () => go(b.dataset.go)));
  $("#brand-home").addEventListener("click", () => go(""));
  $("#back-btn").addEventListener("click", () => goBack());
  // личный кабинет — как в Gunco: кнопка-человечек справа вверху, всплывающее окно с почтой и «Выйти»
  $("#account-btn").addEventListener("click", () => {
    const pop = $("#account-pop"); if (!pop.hidden) { pop.hidden = true; return; }
    $("#account-email").textContent = DEMO ? "демо-режим" : (S.user && S.user.email) || "аккаунт";
    $("#account-signout").textContent = DEMO ? "Сбросить демо-данные" : "Выйти";
    pop.hidden = false;
  });
  $("#account-signout").addEventListener("click", async () => {
    $("#account-pop").hidden = true;
    if (DEMO) { localStorage.removeItem(DEMO_KEY); toast("демо-данные сброшены"); location.reload(); return; }
    if (await confirmBox("Выйти из аккаунта?")) logout();
  });
  document.addEventListener("click", (e) => { const pop = $("#account-pop"); if (!pop.hidden && !e.target.closest("#account-pop") && !e.target.closest("#account-btn")) pop.hidden = true; });
  $("#theme-btn").addEventListener("click", () => { const t = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark"; document.documentElement.setAttribute("data-theme", t); try { localStorage.setItem("sheetaet_theme", t); } catch (e) {} });
  $("#fab").addEventListener("click", async () => {
    if (S.page === "projects") { const p = await createProject(""); go("projects", p.id); }
    else if (S.page === "team") { const e = await createEmployee(""); go("team", e.id); }
  });
  /* ================= ОБЩИЕ ПРАВИЛА СТРАНИЦ =================
     • Строки таблиц не пропадают: показываются все проекты и люди (кроме архива),
       архивные — только если у них есть суммы в показанном периоде.
     • Пустое значение — пустое место (никаких «—» и «0 ₽» в обычных строках).
     • Архив вместо удаления (проекты и люди), хранится бессрочно; вернуть — в карточке организации. */
  const yearOf = () => S.month.slice(0, 4);
  const periodOf = (mode) => (mode === "year" ? { from: `${yearOf()}-01-01`, to: `${+yearOf() + 1}-01-01` } : { from: S.month + "-01", to: C.addMonths(S.month, 1) + "-01" });
  const inPeriod = (d, per) => d >= per.from && d < per.to;
  function listProjects(per) {
    const withData = new Set(S.entries.filter((e) => e.project_id && inPeriod(e.date, per)).map((e) => e.project_id));
    return orderedProjects(true).filter((p) => !p.archived || withData.has(p.id));
  }
  function listPeople(per) {
    const withData = new Set(S.entries.filter((e) => e.kind === "salary" && e.employee_id && inPeriod(e.date, per)).map((e) => e.employee_id));
    return S.employees.filter((e) => e.active !== false || withData.has(e.id)).sort(byName);
  }
  const fixedTitles = () => [...new Set(S.entries.filter((e) => e.kind === "org_expense").map((e) => (e.title || "расход").trim()))].sort((a, b) => a.localeCompare(b, "ru"));
  const fmz = (v) => (v ? fm(v) : "");
  const sumBy = (list) => list.reduce((s, e) => s + e.amount_minor, 0);
  const yRow = (label, values, o) => ({ label, values, total: values.reduce((s, v) => s + (v || 0), 0), ...(o || {}) });
  const pl = (p) => `<span class="proj-emoji">${esc(p.emoji || "📁")}</span> ${esc(p.name || "без названия")}`;

  /* ---------- шапка месяца/года: ‹ октябрь 2026 [14 ОКТ] › ---------- */
  function monthBar(mode, mnav) {
    const today = C.todayStr(), curKey = C.monthKey(today), isYear = mode === "year";
    const isCur = isYear ? yearOf() === curKey.slice(0, 4) : S.month === curKey;
    const step = isYear ? 12 : 1;
    // стрелки — вплотную по бокам от названия; «сегодня» — справа от правой стрелки, название остаётся строго по центру
    return `<div class="cal-nav-row money-monthbar" data-step="${step}"${mnav ? " data-mnav" : ""}><div class="mbar-center mbar-group">
      <button class="cal-nav" data-mon="-${step}" aria-label="${isYear ? "Предыдущий год" : "Предыдущий месяц"}">‹</button>
      <span class="money-month-title">${isYear ? yearOf() : C.monthLabel(S.month)}${(isYear ? yearOf() > curKey.slice(0, 4) : S.month > curKey) ? `<span class="plan-tag">план</span>` : ""}</span>
      <button class="cal-nav" data-mon="${step}" aria-label="${isYear ? "Следующий год" : "Следующий месяц"}">›</button>
      <button class="mbar-today ${isCur ? "is-dim" : ""}" data-mon="0" title="перейти к сегодняшнему дню">${C.dayLabel(today)}</button></div></div>`;
  }
  function wireMonthBar(root) {
    $$("[data-mon]", root).forEach((b) => (b.onclick = () => setMonth(+b.dataset.mon === 0 ? C.monthKey(C.todayStr()) : C.addMonths(S.month, +b.dataset.mon))));
    const bar = $(".money-monthbar", root); if (!bar || bar.dataset.mnav !== undefined) return;
    const step = +bar.dataset.step || 1;
    let sx = 0, sy = 0, on = false;
    bar.addEventListener("touchstart", (e) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; on = true; }, { passive: true });
    bar.addEventListener("touchend", (e) => { if (!on) return; on = false; const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy; if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) setMonth(C.addMonths(S.month, dx < 0 ? step : -step)); }, { passive: true });
  }
  document.addEventListener("keydown", (e) => {
    if ($("#modals .modal")) { if (e.key === "Escape") close(topModal()); return; }
    const a = document.activeElement; if (a && (a.isContentEditable || /INPUT|TEXTAREA/.test(a.tagName))) return;
    const bar = $(".money-monthbar"); if (!bar) return; const step = +bar.dataset.step || 1;
    if (e.key === "ArrowLeft") setMonth(C.addMonths(S.month, -step)); else if (e.key === "ArrowRight") setMonth(C.addMonths(S.month, step));
  });
  // переключатель «месяц / год» — выбор помнится для каждого места
  // по умолчанию — год; кнопки одинаковые везде: «год» слева, «месяц» справа, под названием периода
  // вид — только год (переключателя «год / месяц» больше нет). На телефоне год листается по месяцам стрелками
  const viewOf = () => "year";
  // шапка периода. kind: "grid" — страница с годовой таблицей (телефон: ‹ месяц › листает колонки, без перерисовки),
  // "summary" — сводка (телефон: месяц, компьютер: год), "list" — список за месяц. На телефоне шапка закреплена сверху
  const periodHead = (kind) => {
    const m = isMobile();
    const mode = kind === "list" || (m && kind !== "grid-year") ? "month" : "year";
    return `<div class="sh-month${m ? " is-sticky" : ""}">${monthBar(mode, m && kind === "grid")}</div>`;
  };
  // телефон: стрелки и свайп двигают колонки годовой таблицы; страница не перерисовывается и не прыгает
  function wireMonthNav(root) {
    const bar = $("#main .money-monthbar[data-mnav]"), wrap = $(".yt-wrap", root); if (!bar || !wrap || !isMobile()) return;
    const table = $("table", wrap), labelW = 150;
    const colW = Math.max(120, wrap.clientWidth - labelW);
    $$("col.yt-c-l", table).forEach((c) => (c.style.width = labelW + "px"));
    $$("col.yt-c-m", table).forEach((c) => (c.style.width = colW + "px"));
    table.style.width = labelW + 12 * colW + "px";
    wrap.classList.add("is-mnav"); wrap.style.scrollPaddingLeft = labelW + "px";
    const idx = () => +S.month.slice(5) - 1;
    const title = () => { const t = $(".money-month-title", bar), cur = C.monthKey(C.todayStr()); t.innerHTML = esc(C.monthLabel(S.month)) + (S.month > cur ? `<span class="plan-tag">план</span>` : ""); $(".mbar-today", bar).classList.toggle("is-dim", S.month === cur); };
    const show = (smooth) => wrap.scrollTo({ left: idx() * colW, behavior: smooth ? "smooth" : "auto" });
    let lock = 0;
    const goTo = (key) => {
      if (key.slice(0, 4) !== yearOf()) return setMonth(key);   // другой год — перерисовка, вертикаль сохраняется
      S.month = key; history.replaceState(history.state, "", urlFor(S.page, S.id)); title(); lock = Date.now(); show(true);
    };
    $$("[data-mon]", bar).forEach((b) => (b.onclick = () => goTo(+b.dataset.mon === 0 ? C.monthKey(C.todayStr()) : C.addMonths(S.month, +b.dataset.mon))));
    let t = null;
    wrap.addEventListener("scroll", () => { clearTimeout(t); t = setTimeout(() => { if (Date.now() - lock < 600) return; const i = Math.min(11, Math.max(0, Math.round(wrap.scrollLeft / colW))); if (i !== idx()) { S.month = yearOf() + "-" + String(i + 1).padStart(2, "0"); history.replaceState(history.state, "", urlFor(S.page, S.id)); title(); } }, 120); }, { passive: true });
    show(false);
  }
  function wireViewToggle(root, rerender) { return; $$(".view-toggle [data-view]", root).forEach((b) => (b.onclick = () => { localStorage.setItem("sheetaet_view_" + b.parentElement.dataset.place, b.dataset.view); rerender(); })); }

  /* ---------- сворачивание разделов: крохотная стрелка у плашки; раздел складывается до заголовка ---------- */
  const FOLD_KEY = "sheetaet_fold";
  const folded = () => { try { return new Set(JSON.parse(localStorage.getItem(FOLD_KEY) || "[]")); } catch (e) { return new Set(); } };
  const foldId = (sec) => (S.page || "dash") + ":" + sec;
  const foldBtn = (sec) => `<button class="sec-fold" data-fold="${sec}" aria-label="Свернуть или развернуть раздел"><svg viewBox="0 0 10 10" width="9" height="9" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3.5l3 3 3-3"/></svg></button>`;
  function wireFold(root) {
    $$("[data-fold]", root).forEach((b) => (b.onclick = (e) => {
      e.stopPropagation();
      const sec = b.dataset.fold, f = folded(), id = foldId(sec), on = !f.has(id);
      on ? f.add(id) : f.delete(id); try { localStorage.setItem(FOLD_KEY, JSON.stringify([...f])); } catch (er) {}
      $$(`[data-in="${sec}"]`, root).forEach((r) => r.classList.toggle("is-folded-row", on));
      $$(`[data-fold="${sec}"]`, root).forEach((x) => x.closest(".yt-sec, .dt-sec").classList.toggle("is-folded", on));
    }));
  }

  /* ---------- годовая таблица: 12 одинаковых колонок (без суммы за год) ---------- */
  // rows: {label, values[12], total, cls, open, page, pct} | {sec: kindKey, label}
  function yearGrid(rows) {
    const keys = C.monthsOfYear(yearOf()), curKey = C.monthKey(C.todayStr());
    const cur = (i) => (keys[i] === curKey ? " is-cur" : keys[i] > curKey ? " is-plan" : "");
    // только 12 месяцев — сумма за год не показывается
    const cols = `<colgroup><col class="yt-c-l" />${keys.map(() => `<col class="yt-c-m" />`).join("")}</colgroup>`;
    // строка месяцев — отдельной тонкой таблицей: закреплена сверху при прокрутке страницы и едет вбок вместе с таблицей
    const head = `<thead><tr><th class="yt-l"></th>${C.MONTHS_COL.map((m, i) => `<th class="yt-m${cur(i)}" data-month="${keys[i]}" title="открыть месяц">${m}</th>`).join("")}</tr></thead>`;
    const cell = (r, v) => (r.pct ? (v == null ? "" : String(v).replace(".", ",") + "%") : v ? C.formatCell(v) : "");
    const neg = (r, v) => (!r.pct && v < 0 ? " is-neg" : "");
    const fs = folded(); let inSec = null;
    const body = rows.map((r) => {
      if (r.sec) inSec = r.sec; else if (r.cls === "yt-total") inSec = null;
      const fold = !r.sec && inSec ? ` data-in="${inSec}"` + (fs.has(foldId(inSec)) ? ` data-folded="1"` : "") : "";
      // раздел — широкая цветная полоса во всю строку (как в карточке проекта), по ячейке на месяц, чтобы текущий месяц не терялся
      if (r.sec) return `<tr class="yt-sec${fs.has(foldId(r.sec)) ? " is-folded" : ""}" style="--c:${K[r.sec]}"><td class="yt-l">${foldBtn(r.sec)}<span class="k-pill" style="--c:${K[r.sec]}">${esc(r.label)}</span>${r.add ? `<button class="sec-add" data-secadd="${esc(JSON.stringify(r.add))}" aria-label="Добавить строку" title="добавить">${PLUS_TINY}</button>` : ""}</td>${keys.map((_, i) => `<td class="${cur(i).trim()}"></td>`).join("")}</tr>`;
      const ed = r.edit ? ` data-edit="${esc(JSON.stringify(r.edit))}"` : "";
      return `<tr class="${r.cls || ""}${r.edit ? " is-edit" : ""}${fold.includes("data-folded") ? " is-folded-row" : ""}"${fold} ${r.open ? `data-open="${r.open}" data-page="${r.page}"` : ""}${ed}><td class="yt-l" title="${esc(String(r.label).replace(/<[^>]+>/g, "").trim())}">${r.label}</td>${r.values.map((v, i) => `<td class="${neg(r, v).trim()}${cur(i)}"${r.edit ? ` data-mk="${keys[i]}"` : ""}${r.cellIds && r.cellIds[i] ? ` data-eid="${r.cellIds[i]}"` : ""}>${cell(r, v)}</td>`).join("")}</tr>`;
    }).join("");
    return `<div class="yt-block"><div class="yt-head"><table class="yt yt--head">${cols}${head}</table></div><div class="yt-wrap"><table class="yt">${cols}<tbody>${body}</tbody></table></div></div>`;
  }
  function wireYearGrid(root, place, rerender) {
    $$(".yt [data-month]", root).forEach((th) => (th.onclick = () => { localStorage.setItem("sheetaet_view_" + place, "month"); setMonth(th.dataset.month); }));
    // строка со значениями, которые можно править: нажатие на сумму меняет сумму, на название — открывает карточку
    $$(".yt tr[data-open]", root).forEach((tr) => (tr.onclick = (e) => { if (tr.dataset.edit && !e.target.closest(".yt-l")) return; go(tr.dataset.page, tr.dataset.open); }));
    // после правки таблица перерисовывается — прокрутку вбок сохраняем, чтобы не прыгать к январю
    const redraw = () => { const w = $(".yt-wrap", root), sl = w ? w.scrollLeft : 0; (rerender || (() => render()))(); const w2 = $(".yt-wrap", root), h2 = $(".yt-head", root); if (w2) w2.scrollLeft = sl; if (h2 && w2) h2.scrollLeft = w2.scrollLeft; };
    $$(".yt tr[data-edit] td[data-mk]", root).forEach((td) => (td.onclick = () => editYearCell(JSON.parse(td.parentElement.dataset.edit), td.dataset.mk, redraw, td)));
    wireFold(root);
    wireMonthNav(root);
    $$(".yt tr[data-edit] td.yt-l", root).forEach((td) => {
      const spec = JSON.parse(td.parentElement.dataset.edit);
      if (!spec.title) return;
      td.classList.add("is-rename"); td.title = "нажмите, чтобы переименовать";
      const ids = spec.slot != null ? $$("td[data-eid]", td.parentElement).map((x) => x.dataset.eid) : null;
      td.onclick = (e) => {
        e.stopPropagation(); if (td.querySelector("input")) return;
        // переименование прямо в строке: курсор в поле, Enter или клик мимо — сохранить, Esc — отмена
        td.classList.add("is-editing");
        td.innerHTML = `<input class="yt-input yt-input--name" value="${esc(spec.title)}" maxlength="120" />`;
        const inp = $("input", td); inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length);
        let done = false;
        const fin = (save) => { if (done) return; done = true; if (save && inp.value.trim() && inp.value.trim() !== spec.title) renameLine(spec, redraw, ids, inp.value.trim()); else redraw(); };
        inp.onkeydown = (ev) => { if (ev.key === "Enter") { ev.preventDefault(); fin(true); } else if (ev.key === "Escape") { ev.preventDefault(); ev.stopPropagation(); fin(false); } };
        inp.onblur = () => fin(true); inp.onclick = (ev) => ev.stopPropagation();
      };
    });
    $$("[data-secadd]", root).forEach((b) => (b.onclick = (e) => { e.stopPropagation(); yearAdd(JSON.parse(b.dataset.secadd), root, redraw); }));
    $$(".yt-block", root).forEach((b) => {
      const head = $(".yt-head", b), wrap = $(".yt-wrap", b);
      // закрепить вплотную к верху области прокрутки (минус её внутренний отступ), чтобы над строкой месяцев ничего не просвечивало
      const sc = b.closest(".sh-pane, .taskcard"); if (sc) head.style.top = -parseFloat(getComputedStyle(sc).paddingTop || 0) + "px";
      wrap.addEventListener("scroll", () => { head.scrollLeft = wrap.scrollLeft; }, { passive: true });
      head.addEventListener("wheel", (e) => { if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) { wrap.scrollLeft += e.deltaX; e.preventDefault(); } }, { passive: false });
    });
  }

  // «+» у раздела годовой таблицы: новая строка (расход по названию, человек, проект) — и сразу поле суммы в выбранном месяце
  S.extra = S.extra || {};
  const extraTitles = (key) => S.extra[key] || [];
  async function yearAdd(a, root, redraw) {
    let spec = null;
    if (a.kind === "expense" || a.kind === "org_expense" || a.kind === "income") {
      const t = await inputBox({ title: a.kind === "income" ? "новое поступление" : a.kind === "expense" ? "новый расход" : "новый постоянный расход", value: a.kind === "income" ? INCOME_NEW : "", placeholder: a.kind === "income" ? "название" : a.kind === "expense" ? "сервер, реклама, техника…" : "офис, бухгалтер, банк…" });
      if (!t || !t.trim()) return; const title = t.trim();
      const key = a.kind === "income" ? "inc:" + a.pid : a.kind === "expense" ? "exp:" + a.pid : "fix"; S.extra[key] = [...new Set([...extraTitles(key), title])];
      spec = { kind: a.kind, project_id: a.kind === "org_expense" ? null : a.pid, title };
    } else if (a.kind === "salary" && a.pid) {
      const eid = await pickEmployee(null, a.pid); if (!eid) return; await DB.addMember(a.pid, eid);
      spec = { kind: "salary", project_id: a.pid, employee_id: eid };
    } else if (a.kind === "salary" && a.eid) {
      const pid = await pickProject(projectsOf(a.eid), "добавить в проект"); if (!pid) return; await DB.addMember(pid, a.eid);
      spec = { kind: "salary", project_id: pid, employee_id: a.eid };
    }
    if (!spec) return;
    redraw();
    // открыть ячейку выбранного месяца (или января, если смотрим другой год) у новой строки
    const mk = S.month.slice(0, 4) === yearOf() ? S.month : yearOf() + "-01";
    const tr = $$("tr[data-edit]", root).find((r) => { const x = JSON.parse(r.dataset.edit); return x.kind === spec.kind && (x.project_id || null) === (spec.project_id || null) && (x.employee_id || null) === (spec.employee_id || null) && (x.title || null) === (spec.title || null); });
    const td = tr && $(`td[data-mk="${mk}"]`, tr); if (td) { td.scrollIntoView({ block: "nearest", inline: "center" }); td.click(); }
  }
  // переименовать строку (поступление, расход, постоянный расход): меняется название у всех её сумм
  async function renameLine(spec, redraw, ids, newTitle) {
    const title = (newTitle || "").trim(); if (!title || title === spec.title) return redraw();
    const same = (e) => e.kind === spec.kind && (e.project_id || null) === (spec.project_id || null) && (spec.kind === "income" ? incTitle(e) : (e.title || "расход").trim()) === spec.title;
    const list = ids ? S.entries.filter((e) => ids.includes(e.id)) : S.entries.filter(same);
    for (const e of list) { e.title = title; await safe(() => DB.update("entries", e.id, { title })); }
    const key = spec.kind === "income" ? "inc:" + spec.project_id : spec.kind === "expense" ? "exp:" + spec.project_id : "fix";
    S.extra[key] = extraTitles(key).map((t) => (t === spec.title ? title : t));
    redraw();
  }
  // правка одной ячейки годовой таблицы (проект, сотрудник, организация): прямо в ячейке, без окна —
  // Enter или клик мимо сохраняет, Esc отменяет; пусто — сумма убирается
  function editYearCell(spec, key, after, td) {
    const match = (e) => e.kind === spec.kind && (e.project_id || null) === (spec.project_id || null) && C.inMonth(e.date, key)
      && (spec.kind === "salary" ? e.employee_id === spec.employee_id : spec.kind === "income" ? incTitle(e) === spec.title : (e.title || "расход").trim() === spec.title);
    // строка-слот (поступления в году): ячейка — ровно одна запись или пусто
    const list = spec.slot != null ? (td && td.dataset.eid ? S.entries.filter((e) => e.id === td.dataset.eid) : []) : S.entries.filter(match);
    // несколько записей в ячейке (месячного вида больше нет): правим сумму целиком — записи сливаются в одну
    const extra = list.length > 1 ? list.slice(1) : [];
    if (!td || td.querySelector("input")) return;
    const cur = list[0], p = projById(spec.project_id), emp = spec.employee_id ? empById(spec.employee_id) : null;
    td.classList.add("is-editing");
    td.innerHTML = `<input class="yt-input" inputmode="decimal" value="${list.length ? esc(C.amountToInput(sumBy(list))) : ""}" />`;
    const inp = $("input", td); inp.focus(); inp.select();
    let done = false;
    const finish = async (save) => {
      if (done) return; done = true;
      if (!save) return after();
      const v = inp.value.trim(), a = v === "" ? 0 : C.parseAmount(v);
      if (a == null || a < 0) { toast("не похоже на сумму"); return after(); }
      if (cur && a === cur.amount_minor && !extra.length) return after();
      if (extra.length) { for (const x of extra) await safe(() => DB.remove("entries", x.id)); S.entries = S.entries.filter((x) => !extra.includes(x)); toast(`${extra.length + 1} записи объединены в одну`); }
      if (cur && !a) {
        await safe(() => DB.remove("entries", cur.id)); S.entries = S.entries.filter((x) => x !== cur);
        pushUndo("удаление суммы", async () => { const { id, created_at, updated_at, ...rest } = cur; const r = await DB.insert("entries", rest); S.entries.push(r); });
      } else if (cur) {
        const prev = cur.amount_minor; cur.amount_minor = a; await safe(() => DB.update("entries", cur.id, { amount_minor: a }));
        pushUndo("изменение суммы", () => DB.update("entries", cur.id, { amount_minor: (cur.amount_minor = prev) }));
      } else if (a) {
        const day = spec.kind === "income" ? (p && p.income_day) || 10 : spec.kind === "salary" ? (emp && emp.pay_day) || 10 : spec.kind === "org_expense" ? 1 : 15;
        const r = await safe(() => DB.insert("entries", { kind: spec.kind, project_id: spec.project_id, employee_id: spec.employee_id || null, title: spec.kind === "salary" ? null : spec.title, amount_minor: a, date: C.dayInMonth(key, day) }));
        S.entries.push(r);
        if (spec.kind === "salary" && spec.project_id && spec.employee_id) await DB.addMember(spec.project_id, spec.employee_id);
        pushUndo("добавление суммы", async () => { await DB.remove("entries", r.id); S.entries = S.entries.filter((x) => x !== r); });
      }
      after();
    };
    inp.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); finish(true); } else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); finish(false); } });
    inp.addEventListener("blur", () => finish(true));
    inp.addEventListener("click", (e) => e.stopPropagation());
  }
  const kindPill = (k, extra) => `<span class="k-pill ${extra || ""}" style="--c:${K[k]}">${KIND_LABEL[k]}</span>`;
  const byName = (a, b) => (a.last_name || a.first_name || "").localeCompare(b.last_name || b.first_name || "", "ru") || (a.first_name || "").localeCompare(b.first_name || "", "ru");
  const projSort = (a, b) => (a.sort ?? 1e9) - (b.sort ?? 1e9) || String(a.created_at || "").localeCompare(String(b.created_at || ""));
  function orderedProjects(withArchived) {
    const pool = S.projects.filter((p) => withArchived || !p.archived);
    const out = []; S.statuses.forEach((s) => out.push(...pool.filter((p) => p.status === s.id).sort(projSort))); out.push(...pool.filter((p) => !statusById(p.status))); return out;
  }
  const pm = (p) => C.projectMonth(p, S.entries, S.month, S.org);
  const taxPct = () => String(C.taxRateOf(S.org)).replace(".", ",") + "%";

  /* ================= ЗАРПЛАТЫ И РАСХОДЫ: общая механика =================
     Новая выплата (человек в проекте) или новый расход (название в проекте) сами проставляются
     во все следующие месяцы до окончания договора проекта (или до конца года) — с той же суммой и тем же днём, только там, где их ещё нет. */
  const sameLine = (a, b) => (a.project_id || null) === (b.project_id || null) && a.kind === b.kind && (a.kind === "salary" ? a.employee_id === b.employee_id : (a.title || "").trim().toLowerCase() === (b.title || "").trim().toLowerCase());
  // до какого месяца проставлять: до месяца окончания договора проекта (если дата указана и договор не бессрочный,
  // в том числе на следующий год, но не дальше 3 лет), иначе — до декабря этого года
  function fillUntil(src) {
    const key = C.monthKey(src.date), p = src.project_id ? projById(src.project_id) : null;
    if (p && p.end_date && !p.open_ended) { const end = C.monthKey(p.end_date), max = C.addMonths(key, 36); return end < max ? end : max; }
    return key.slice(0, 4) + "-12";
  }
  async function fillToYearEnd(src) {
    // зарплаты и расходы проекта, а также постоянные расходы организации
    if (!(src.kind === "salary" || src.kind === "expense" || src.kind === "org_expense")) return [];
    if (src.kind !== "org_expense" && !src.project_id && !(src.kind === "salary" && src.employee_id)) return [];
    const key = C.monthKey(src.date), day = +src.date.slice(8), rows = [];
    const until = fillUntil(src);
    for (let k = C.addMonths(key, 1); k <= until; k = C.addMonths(k, 1)) {
      if (S.entries.some((e) => sameLine(e, src) && C.inMonth(e.date, k))) continue;
      rows.push({ kind: src.kind, project_id: src.project_id, employee_id: src.employee_id || null, title: src.title || null, amount_minor: src.amount_minor, date: C.dayInMonth(k, day) });
    }
    if (!rows.length) return [];
    const ins = await safe(() => DB.insertMany("entries", rows));
    S.entries.push(...ins);
    return ins;
  }
  // создать запись (+ участие в проекте + проставить до конца года); возвращает [основная, ...проставленные]
  async function createEntry(row) {
    const ins = await safe(() => DB.insert("entries", row));
    S.entries.push(ins);
    if (ins.kind === "salary" && ins.employee_id && ins.project_id) await DB.addMember(ins.project_id, ins.employee_id);
    const filled = await fillToYearEnd(ins);
    const all = [ins, ...filled];
    const lastKey = filled.length ? C.monthKey(filled.map((r) => r.date).sort().pop()) : null;
    const untilLabel = lastKey ? C.MONTHS_GEN[+lastKey.slice(5) - 1] + (lastKey.slice(0, 4) === C.monthKey(ins.date).slice(0, 4) ? "" : " " + lastKey.slice(0, 4)) : "";
    pushUndo(filled.length ? "добавление и проставление вперёд" : "добавление", async () => { for (const r of all) await DB.remove("entries", r.id); S.entries = S.entries.filter((e) => !all.includes(e)); });
    if (filled.length) toast(`проставлено до ${untilLabel}: ещё ${filled.length} ${C.plural(filled.length, "месяц", "месяца", "месяцев")}`);
    return all;
  }
  // убрать человека из проекта: участие + его выплаты в проекте начиная с месяца fromKey
  async function removeFromProject(pid, eid, fromKey) {
    const gone = S.entries.filter((e) => e.kind === "salary" && e.project_id === pid && e.employee_id === eid && e.date >= fromKey + "-01");
    for (const e of gone) await safe(() => DB.remove("entries", e.id));
    S.entries = S.entries.filter((e) => !gone.includes(e));
    await DB.removeMember(pid, eid);
    pushUndo("убрать из проекта", async () => { await DB.addMember(pid, eid); for (const e of gone) { const { id, created_at, updated_at, ...rest } = e; const r = await DB.insert("entries", rest); S.entries.push(r); } });
  }

  /* ================= ГЛАВНАЯ ================= */
  const ICON_NUMS = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 19.5V12M10.5 19.5V5M16 19.5v-5M20.5 19.5h-17"/></svg>`;
  const ICON_TABLE = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><path d="M3.5 9.5h17M3.5 14.5h17M9.5 9.5v10"/></svg>`;
  const ICON_DL = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4.5v10M7.5 10.5l4.5 4.5 4.5-4.5M5 19.5h14"/></svg>`;

  /* ---------- выгрузка таблицы главной в Excel (ExcelJS): те же строки и разделы, что на экране ----------
     фон цветной только у разделов; итоги и результаты — полужирные, остальное — обычное; тонкие линии между строками */
  function dashMonthRows() {
    const per = periodOf("month"), o = C.orgMonth(S.projects, S.entries, S.month, S.org), byId = {};
    o.per.forEach((x) => (byId[x.project.id] = x));
    const projs = listProjects(per), fx = S.entries.filter((e) => e.kind === "org_expense" && C.inMonth(e.date, S.month));
    const r = (label, v, cls) => ({ label, values: [v], total: v, cls });
    const rows = [];
    rows.push({ sec: "income", label: "поступления" }); projs.forEach((p) => rows.push(r(pl(p), (byId[p.id] || {}).income || 0))); rows.push(r("выручка до налогов", o.income, "is-sum"));
    rows.push({ sec: "tax", label: "налоги" }); rows.push(r(`налоги · ${taxPct()} от выручки`, o.tax, "is-sum"));
    rows.push({ sec: "salary", label: "зарплаты" }); listPeople(per).forEach((e) => rows.push(r(esc(C.fullName(e) || "без имени"), C.employeeMonth(e.id, S.entries, S.month).total))); rows.push(r("зарплаты всего", o.salaries, "is-sum"));
    rows.push({ sec: "expense", label: "прочие расходы проектов" }); projs.forEach((p) => rows.push(r(pl(p), (byId[p.id] || {}).other || 0))); rows.push(r("итого", o.projOther, "is-sum"));
    rows.push({ sec: "profit", label: "прибыль по проектам" }); projs.forEach((p) => rows.push(r(pl(p), (byId[p.id] || {}).profit || 0))); rows.push(r("итого по проектам", o.projectsProfit, "is-sum"));
    rows.push({ sec: "fixed", label: "постоянные расходы" }); fixedTitles().forEach((t) => rows.push(r(esc(t), sumBy(fx.filter((e) => (e.title || "расход").trim() === t))))); rows.push(r("итого", o.fixed, "is-sum"));
    rows.push(r("чистая прибыль", o.profit, "yt-total"));
    return rows;
  }
  const loadScript = (src) => new Promise((res, rej) => { if ([...document.scripts].some((x) => x.src === src)) return res(); const sc = document.createElement("script"); sc.src = src; sc.onload = res; sc.onerror = () => rej(new Error("не загрузилась библиотека Excel")); document.head.appendChild(sc); });
  const plain = (html) => { const t = document.createElement("div"); t.innerHTML = String(html); return t.textContent.replace(/\s+/g, " ").trim(); };
  async function exportDashXlsx(btn) {
    btn.disabled = true;
    try {
      await loadScript("https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js");
      const year = viewOf("dash") === "year";
      const rows = year ? dashYearRows() : dashMonthRows();
      const heads = year ? [...C.MONTHS_COL] : [C.monthLabel(S.month)];
      const FONT = "Arial", LINE = "FFE6E6E6", SEC = "FFC4C4C4", MUTED = "FF8A8A8E", NEG = "FFD64545";
      const tint = (rgb, a) => "FF" + rgb.split(",").map((c) => Math.round(+c * a + 255 * (1 - a)).toString(16).padStart(2, "0")).join("").toUpperCase();
      const hasKop = !year && rows.some((r) => r.values && r.values.some((v) => v % 100));
      // разделитель разрядов — по языку Excel (в русском — пробел); ноль — пустая ячейка, как на экране
      const fmt = year ? '#,##0;-#,##0;""' : hasKop ? '#,##0.00 "₽";-#,##0.00 "₽";""' : '#,##0 "₽";-#,##0 "₽";""';
      const wb = new window.ExcelJS.Workbook(); wb.creator = "sheetaet"; wb.created = new Date();
      const ws = wb.addWorksheet(year ? yearOf() : C.monthLabel(S.month), { views: [{ state: "frozen", xSplit: 1, ySplit: 3, showGridLines: false }] });
      const n = heads.length + 1;
      ws.columns = [{ width: 36 }, ...heads.map(() => ({ width: year ? 12 : 18 }))];
      const t = ws.getCell("A1"); t.value = `${S.org.name || "организация"} — ${year ? "таблица за " + yearOf() + " год" : "таблица за " + C.monthLabel(S.month)}`; t.font = { name: FONT, size: 14, bold: true };
      const h = ws.getRow(3);
      h.getCell(1).value = year ? "₽" : ""; heads.forEach((m, i) => (h.getCell(i + 2).value = m));
      for (let c = 1; c <= n; c++) { const cell = h.getCell(c); cell.font = { name: FONT, size: 9, color: { argb: MUTED } }; cell.alignment = { horizontal: c === 1 ? "left" : "right", vertical: "middle" }; cell.border = { bottom: { style: "thin", color: { argb: LINE } } }; }
      h.height = 20;
      let ri = 4;
      rows.forEach((r, k) => {
        const row = ws.getRow(ri++);
        if (r.sec) {
          // раздел: единственное место с цветным фоном, сверху — линия заметнее
          row.getCell(1).value = r.label;
          for (let c = 1; c <= n; c++) { const cell = row.getCell(c); cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: tint(K[r.sec], 0.26) } }; cell.font = { name: FONT, size: 10 }; if (k) cell.border = { top: { style: "thin", color: { argb: SEC } } }; cell.alignment = { vertical: "middle" }; }
          row.height = 20; return;
        }
        const bold = /is-sum|yt-total|yt-profit/.test(r.cls || "");
        row.getCell(1).value = plain(r.label);
        r.values.forEach((v, i) => (row.getCell(i + 2).value = r.pct ? (v == null ? null : v / 100) : v ? Math.round(v) / 100 : null));
        for (let c = 1; c <= n; c++) {
          const cell = row.getCell(c);
          cell.font = { name: FONT, size: 11, bold };
          cell.border = { bottom: { style: "thin", color: { argb: LINE } } };
          cell.alignment = { horizontal: c === 1 ? "left" : "right", vertical: "middle" };
          const plan = year && c > 1 && C.monthsOfYear(yearOf())[c - 2] > C.monthKey(C.todayStr());
          if (c > 1) { cell.numFmt = r.pct ? '0.0%;-0.0%;""' : fmt; if (typeof cell.value === "number" && cell.value < 0) cell.font = { name: FONT, size: 11, bold, color: { argb: plan ? "FFE8A0A0" : NEG } }; else if (plan) cell.font = { name: FONT, size: 11, bold, color: { argb: MUTED } }; }
        }
        row.height = 18;
      });
      const buf = await wb.xlsx.writeBuffer();
      const url = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
      const a = document.createElement("a"); a.href = url; a.download = `sheetaet-${S.slug}-${year ? yearOf() : S.month}.xlsx`; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      toast("таблица скачана");
    } catch (e) { toast("не получилось: " + e.message); }
    btn.disabled = false;
  }

  // итоги организации за год — та же форма, что у месяца (orgMonth), для «Сводки» по году
  function orgYearTotal(year, upto) {
    const keys0 = C.monthsOfYear(year);
    const ms = C.orgYear(S.projects, S.entries, year, S.org).filter((_, i) => !upto || keys0[i] <= upto);
    const keys = ["income", "salaries", "tax", "projOther", "fixed", "other", "expense", "profit", "projectsProfit"];
    const out = {}; keys.forEach((k) => (out[k] = ms.reduce((s, m) => s + m[k], 0)));
    out.per = S.projects.map((p) => { const x = { project: p, income: 0, profit: 0, other: 0, salaries: 0, tax: 0, total: 0 }; ms.forEach((m) => { const y = m.per.find((z) => z.project.id === p.id); if (y) ["income", "profit", "other", "salaries", "tax", "total"].forEach((k) => (x[k] += y[k])); }); return x; });
    return out;
  }
  function renderDashboard(main) {
    // переключатель «главные цифры / таблица» — иконки справа от заголовка страницы
    // «Сводка / Таблица» — сразу справа от заголовка; на телефоне только иконки, на компьютере иконка + название
    $("#page-tools").innerHTML = `<button class="view-btn ${S.dashTab === "nums" ? "is-on" : ""}" data-tab="nums" title="Сводка" aria-label="Сводка">${ICON_NUMS}<span class="vb-label">Сводка</span></button><button class="view-btn ${S.dashTab === "table" ? "is-on" : ""}" data-tab="table" title="Таблица" aria-label="Таблица">${ICON_TABLE}<span class="vb-label">Таблица</span></button>${S.dashTab === "table" ? `<button class="view-btn vb-xlsx" data-xlsx title="Скачать в Excel" aria-label="Скачать в Excel">${ICON_DL}</button>` : ""}`;
    const xb = $("#page-tools [data-xlsx]"); if (xb) xb.onclick = () => exportDashXlsx(xb);
    $$("#page-tools [data-tab]").forEach((b) => (b.onclick = () => { S.dashTab = b.dataset.tab; localStorage.setItem("sheetaet_dash", S.dashTab); renderDashboard(main); }));
    // компьютер — всегда год; телефон: «Сводка» — за месяц, «Таблица» — год по месяцам (стрелки листают колонки)
    const mob = isMobile(), yearMode = !mob;
    const prevKey = C.addMonths(S.month, -1);
    // факт и план: будущие месяцы — план. В текущем году сводка показывает факт (по текущий месяц) и прогноз на весь год,
    // сравнение — с тем же периодом прошлого года
    const todayKey = C.monthKey(C.todayStr()), y = yearOf(), py = String(+y - 1);
    const midYear = yearMode && y === todayKey.slice(0, 4);
    const cur = yearMode ? orgYearTotal(y, midYear ? todayKey : null) : C.orgMonth(S.projects, S.entries, S.month, S.org);
    const forecast = midYear ? orgYearTotal(y) : null;
    const prev = yearMode ? orgYearTotal(py, midYear ? py + todayKey.slice(4) : null) : C.orgMonth(S.projects, S.entries, prevKey, S.org);
    const isPlan = yearMode ? y > todayKey.slice(0, 4) : S.month > todayKey;
    // компьютер: ‹ 2026 › — в шапке страницы, на одном уровне с «главная» и кнопками; телефон — закреплённая полоска сверху
    if (!mob) { $("#page-tools").insertAdjacentHTML("beforeend", `<div class="pt-period">${monthBar("year")}</div>`); wireMonthBar($("#page-tools .pt-period")); }
    main.innerHTML = `<div class="pane pane--money scroll sh-pane">${mob ? periodHead(S.dashTab === "table" ? "grid" : "summary") : ""}<div id="dash-body"></div></div>`;
    wireMonthBar(main);
    const body = $("#dash-body", main);
    const rb = remindBanner(); if (rb) { body.insertAdjacentHTML("beforebegin", rb); wireRemindBanner(main, () => renderDashboard(main)); }
    if (S.dashTab === "table") { body.innerHTML = yearGrid(dashYearRows()); wireYearGrid(body, "dash"); return; }
    if (S.dashTab === "table") { body.innerHTML = dashTable(cur); $$("[data-open]", body).forEach((r) => (r.onclick = () => go(r.dataset.page, r.dataset.open))); wireFold(body); return; }
    const prevName = yearMode ? py + (midYear ? " (янв–" + C.MONTHS_SHORT[+todayKey.slice(5) - 1] + ")" : " году") : C.monthPrep(prevKey);
    const tiles = [
      ["прибыль всего", cur.profit, prev.profit, "up-good", "profit", "profit"], ["доход всего", cur.income, prev.income, "up-good", "income", "income"],
      ["расход всего", cur.expense, prev.expense, "up-bad", "expense", "expense"], ["зарплаты", cur.salaries, prev.salaries, "up-bad", "salary", "salaries"],
      ["налоги", cur.tax, prev.tax, "up-bad", "tax", "tax"], ["прочие расходы", cur.other, prev.other, "up-bad", "expense", "other"],
    ];
    const per = periodOf(yearMode ? "year" : "month"), shown = new Set(listProjects(per).map((p) => p.id));
    const empty = !cur.income && !cur.expense;
    body.innerHTML = `${empty ? `<p class="empty">${yearMode ? "в " + yearOf() + " году" : "в " + C.monthPrep(S.month)} пока нет записей</p>` : ""}
      ${midYear ? `<p class="plan-note">факт — январь–${C.MONTHS[+todayKey.slice(5) - 1]}; прогноз — с учётом проставленных сумм до конца года</p>` : isPlan ? `<p class="plan-note">это план: ${yearMode ? y + " год ещё" : C.monthLabel(S.month) + " ещё"} не наступил</p>` : ""}
      <div class="kpi-grid${isPlan ? " is-plan-month" : ""}">${tiles.map(([label, v, pv, kind, k, fk]) => { const cmp = C.compare(v, pv, kind); const tri = cmp.dir === "up" ? "▲" : cmp.dir === "down" ? "▼" : "▶"; return `<button class="kpi" data-tab-go="table">
        <span class="kpi-num ${v < 0 ? "is-neg" : ""}">${fm(v)}</span>
        <span class="kpi-label"><span class="k-dot" style="--c:${K[k]}"></span>${label}${midYear ? " · факт" : isPlan ? " · план" : ""}</span>
        ${forecast ? `<span class="kpi-forecast">прогноз на год ${fmt(forecast[fk])}</span>` : ""}
        <span class="kpi-prev"><span><span class="kpi-tri kpi-tri--${cmp.tone}">${tri}</span>${cmp.isNew ? "новое" : cmp.change != null ? (cmp.change > 0 ? "+" : "") + cmp.change + "%" : ""}</span><span>в ${prevName} ${fmt(pv)}</span></span></button>`; }).join("")}</div>
      <div class="ch-block"><div class="ch-title">чистая прибыль по проектам</div>${CH.bars(cur.per.filter((x) => shown.has(x.project.id) && (x.project.status !== "done" || x.income || x.total)).sort((a, b) => b.profit - a.profit).map((x) => ({ label: x.project.name, emoji: x.project.emoji, value: x.profit, c: K.profit })))}</div>
      <div class="ch-stack">
        <div class="ch-block"><div class="ch-title">структура расходов</div>${CH.donut([{ label: "зарплаты", value: cur.salaries, c: K.salary }, { label: "налоги", value: cur.tax, c: K.tax }, { label: "прочие расходы проектов", value: cur.projOther, c: K.expense }, { label: "постоянные расходы", value: cur.fixed, c: K.fixed }], { label: "расход всего", value: cur.expense })}</div>
        <div class="ch-block"><div class="ch-title">доход по проектам</div>${CH.donut(cur.per.map((x) => ({ label: x.project.name, emoji: x.project.emoji, value: x.income, c: x.project.color || PALETTE[2] })), { label: "доход всего", value: cur.income })}</div>
      </div>`;
    $$("[data-tab-go]", body).forEach((b) => (b.onclick = () => { S.dashTab = "table"; localStorage.setItem("sheetaet_dash", "table"); renderDashboard(main); }));
  }
  // Месячная таблица: все проекты и люди на месте; пустые значения — пусто
  function dashTable(o) {
    const per = periodOf("month");
    const fs = folded(); let inSec = null;
    const row = (label, v, opts) => { opts = opts || {}; const sum = /is-sum/.test(opts.cls || ""); const f = inSec && fs.has(foldId(inSec)); return `<div class="dt-row ${opts.cls || ""}${f ? " is-folded-row" : ""}"${inSec ? ` data-in="${inSec}"` : ""} ${opts.open ? `data-open="${opts.open}" data-page="${opts.page}"` : ""}><span class="dt-l">${label}</span><span class="dt-v ${v < 0 ? "is-neg" : ""}">${sum ? fm(v) : fmz(v)}</span></div>`; };
    const sec = (k, title) => { inSec = k; return `<div class="ent-head dt-sec${fs.has(foldId(k)) ? " is-folded" : ""}" style="--c:${K[k]}">${foldBtn(k)}<span class="k-pill" style="--c:${K[k]}">${title}</span></div>`; };
    const byId = {}; o.per.forEach((x) => (byId[x.project.id] = x));
    const projs = listProjects(per);
    const people = listPeople(per);
    const fx = S.entries.filter((e) => e.kind === "org_expense" && C.inMonth(e.date, S.month));
    const open = (p) => ({ open: p.id, page: "projects" });
    let h = `<div class="dash-table${S.month > C.monthKey(C.todayStr()) ? " is-plan-month" : ""}">`;
    h += sec("income", "поступления") + projs.map((p) => row(pl(p), (byId[p.id] || {}).income || 0, open(p))).join("") + row("выручка до налогов", o.income, { cls: "is-sum" });
    h += sec("tax", "налоги") + row(`налоги · ${taxPct()} от выручки`, o.tax, { cls: "is-sum" });
    h += sec("salary", "зарплаты") + people.map((e) => row(esc(C.fullName(e) || "без имени"), C.employeeMonth(e.id, S.entries, S.month).total, { open: e.id, page: "team" })).join("") + row("зарплаты всего", o.salaries, { cls: "is-sum" });
    h += sec("expense", "прочие расходы проектов") + projs.map((p) => row(pl(p), (byId[p.id] || {}).other || 0, open(p))).join("") + row("итого", o.projOther, { cls: "is-sum" });
    h += sec("profit", "прибыль по проектам") + projs.map((p) => row(pl(p), (byId[p.id] || {}).profit || 0, open(p))).join("") + row("итого по проектам", o.projectsProfit, { cls: "is-sum" });
    h += sec("fixed", "постоянные расходы") + fixedTitles().map((t) => row(esc(t), sumBy(fx.filter((e) => (e.title || "расход").trim() === t)))).join("") + row("итого", o.fixed, { cls: "is-sum" });
    inSec = null;
    h += `<div class="dt-row dt-total"><span class="dt-l">чистая прибыль</span><span class="dt-v ${o.profit < 0 ? "is-neg" : ""}">${fm(o.profit)}</span></div>`;
    return h + `</div>`;
  }
  function dashYearRows() {
    const year = yearOf(), ms = C.monthsOfYear(year), per = periodOf("year");
    const org = C.orgYear(S.projects, S.entries, year, S.org);
    const pv = (p, key) => org.map((m) => { const x = m.per.find((y) => y.project.id === p.id); return x ? x[key] : 0; });
    const projs = listProjects(per), open = (p) => ({ open: p.id, page: "projects" }), sumOrg = (k) => org.map((m) => m[k]);
    const fx = S.entries.filter((e) => e.kind === "org_expense" && e.date.startsWith(year));
    const rows = [];
    rows.push({ sec: "income", label: "поступления" }); projs.forEach((p) => rows.push(yRow(pl(p), pv(p, "income"), open(p))));
    rows.push(yRow("выручка до налогов", sumOrg("income"), { cls: "is-sum" }));
    rows.push({ sec: "tax", label: "налоги" }); rows.push(yRow(`налоги · ${taxPct()} от выручки`, sumOrg("tax"), { cls: "is-sum" }));
    rows.push({ sec: "salary", label: "зарплаты" });
    listPeople(per).forEach((e) => rows.push(yRow(esc(C.fullName(e) || "без имени"), ms.map((k) => C.employeeMonth(e.id, S.entries, k).total), { open: e.id, page: "team" })));
    rows.push(yRow("зарплаты всего", sumOrg("salaries"), { cls: "is-sum" }));
    rows.push({ sec: "expense", label: "прочие расходы проектов" }); projs.forEach((p) => rows.push(yRow(pl(p), pv(p, "other"), open(p))));
    rows.push(yRow("итого", sumOrg("projOther"), { cls: "is-sum" }));
    rows.push({ sec: "profit", label: "прибыль по проектам" }); projs.forEach((p) => rows.push(yRow(pl(p), pv(p, "profit"), open(p))));
    rows.push(yRow("итого по проектам", sumOrg("projectsProfit"), { cls: "is-sum" }));
    rows.push({ sec: "fixed", label: "постоянные расходы" });
    fixedTitles().forEach((t) => rows.push(yRow(esc(t), ms.map((k) => sumBy(fx.filter((e) => (e.title || "расход").trim() === t && C.inMonth(e.date, k)))))));
    rows.push(yRow("итого", sumOrg("fixed"), { cls: "is-sum" }));
    rows.push(yRow("чистая прибыль", sumOrg("profit"), { cls: "yt-total" }));
    return rows;
  }

  /* ================= ПРОЕКТЫ (канбан) ================= */
  async function createProject(name) {
    const minSort = S.projects.filter((p) => p.status === "progress").reduce((m, p) => Math.min(m, p.sort ?? 0), 0) - 1;
    const p = await safe(() => DB.insert("projects", { name, emoji: "📁", color: PALETTE[(S.projects.length * 5 + 2) % PALETTE.length], status: "progress", sort: minSort, profit_rate: null, note: "", income_day: 10, archived: false }));
    S.projects.push(p); return p;
  }
  function renderProjects(main) {
    const live = S.projects.filter((p) => !p.archived);
    if (!live.length) { main.innerHTML = `<div class="pane"><p class="empty">нет проектов — создай первый по +</p></div>`; return; }
    const cur = C.monthLabel(S.month);
    let h = "";
    S.statuses.forEach((s) => {
      const arr = live.filter((p) => p.status === s.id).sort(projSort);
      h += `<div class="kb-col${arr.length ? "" : " kb-col--empty"}" data-status="${s.id}"><div class="kb-col-head">${statusDot(s)}<span>${esc(s.name)}</span></div><div class="kb-cards scroll">${arr.map((p) => { const m = pm(p); return `<div class="kb-card" data-id="${p.id}"><div class="kb-card-title"><span class="proj-emoji">${esc(p.emoji || "📁")}</span><span class="kb-name">${esc(p.name || "Без названия")}</span></div>${m.income || m.total ? `<span class="kb-profit ${m.profit < 0 ? "is-neg" : ""}" title="прибыль, ${cur}">${fm(m.profit)}</span>` : ""}</div>`; }).join("")}</div></div>`;
    });
    main.innerHTML = `<div class="kanban" id="kanban">${h}</div>`;
    const kb = $("#kanban");
    kb.addEventListener("click", (e) => { const c = e.target.closest(".kb-card"); if (c) go("projects", c.dataset.id); });
    window.makeSortable(kb, { itemSelector: ".kb-card", containerSelector: ".kb-cards", columnSelector: ".kb-col", axis: "y", onDrop: async (d) => {
      const toStatus = d.toContainer.closest(".kb-col").dataset.status; const updates = [];
      [d.toContainer, d.fromContainer].forEach((cont) => [...cont.querySelectorAll(".kb-card")].forEach((c, i) => { const p = projById(c.dataset.id); if (!p) return; const patch = {}; if (p.sort !== i) patch.sort = i; if (p.id === d.itemId && p.status !== toStatus) patch.status = toStatus; if (Object.keys(patch).length) { const prev = { sort: p.sort, status: p.status }; Object.assign(p, patch); updates.push({ p, patch, prev }); } }));
      $$("#kanban .kb-col").forEach((c) => c.classList.toggle("kb-col--empty", !c.querySelector(".kb-card")));
      for (const u of updates) await safe(() => DB.update("projects", u.p.id, u.patch));
      if (updates.length) pushUndo("перемещение", async () => { for (const u of updates) { Object.assign(u.p, u.prev); await DB.update("projects", u.p.id, u.prev); } });
    } });
  }

  /* ================= НАПОМИНАНИЯ ПО ПРОЕКТАМ =================
     Каждый месяц перед поступлением: «выставить акт / счёт / акт + счёт».
     Дата — за 10 дней до дня поступления (income_day) или свой день месяца (remind_day).
     «Готово» отмечается за месяц поступления (remind_done = 'YYYY-MM'). */
  const REMIND = { act: "выставить акт", invoice: "выставить счёт", both: "выставить акт + счёт" };
  const SVGI = (inner, w) => `<svg viewBox="0 0 16 16" width="${w || 15}" height="${w || 15}" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
  const SHEET = (x, y) => `<path d="M${x} ${y}h5l3 3v8h-8z"/><path d="M${x + 5} ${y}v3h3"/>`;
  const R_ICON = {
    bell: SVGI(`<path d="M4 7a4 4 0 0 1 8 0c0 2.9 1.1 3.8 1.5 4.1H2.5C2.9 10.8 4 9.9 4 7z"/><path d="M6.6 13.2a1.5 1.5 0 0 0 2.8 0"/>`),
    bellOff: SVGI(`<path d="M4 7a4 4 0 0 1 8 0c0 2.9 1.1 3.8 1.5 4.1H2.5C2.9 10.8 4 9.9 4 7z"/><path d="M6.6 13.2a1.5 1.5 0 0 0 2.8 0"/><path d="M2.2 2.2l11.6 11.6"/>`),
    act: SVGI(SHEET(4, 2)),                                                     // пустой листик — акт
    invoice: SVGI(SHEET(4, 2) + `<circle cx="8" cy="9.5" r="2"/>`),             // листик с монеткой — счёт
    both: SVGI(`<path d="M3 5v9h7"/>` + SHEET(5.5, 1) + `<circle cx="9.5" cy="8.5" r="1.8"/>`), // листик с монеткой, под ним второй — акт + счёт
  };
  const addDays = (d, n) => { const t = new Date(d + "T00:00:00Z"); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
  function remindFor(p, mk) {
    const pay = C.dayInMonth(mk, p.income_day || 10);
    let at = addDays(pay, -10);
    if (p.remind_day) { at = C.dayInMonth(mk, p.remind_day); if (at > pay) at = C.dayInMonth(C.addMonths(mk, -1), p.remind_day); }
    return { mk, pay, at };
  }
  // ближайшее ещё не отмеченное напоминание (для подписи в карточке)
  function nextRemind(p) {
    const cur = C.monthKey(C.todayStr()), t = C.todayStr();
    for (let i = -1; i <= 2; i++) { const r = remindFor(p, C.addMonths(cur, i)); if (r.pay >= t && !(p.remind_done && p.remind_done >= r.mk)) return r; }
    return remindFor(p, C.addMonths(cur, 1));
  }
  // что пора сделать сегодня: по ближайшему предстоящему поступлению дата напоминания уже наступила, а «готово» не отмечено
  function dueReminders() {
    const t = C.todayStr(), out = [];
    S.projects.filter((p) => p.remind_kind && !p.archived).forEach((p) => { const r = nextRemind(p); if (r.at <= t) out.push({ p, ...r }); });
    return out.sort((a, b) => a.pay.localeCompare(b.pay));
  }
  // уведомление браузера (пока приложение открыто) — не чаще раза в день на проект
  function notifyDue() {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    dueReminders().forEach((r) => {
      const key = `sheetaet_ntf_${r.p.id}_${r.mk}_${C.todayStr()}`;
      try { if (localStorage.getItem(key)) return; localStorage.setItem(key, "1"); } catch (e) {}
      try { new Notification(`${r.p.emoji || "📁"} ${r.p.name || "проект"}: ${REMIND[r.p.remind_kind]}`, { body: `поступление ~${C.dayLong(r.pay)}`, tag: "sheetaet-" + r.p.id }); } catch (e) {}
    });
  }
  async function markRemindDone(p, mk) {
    const prev = p.remind_done; p.remind_done = mk;
    await safe(() => DB.update("projects", p.id, { remind_done: mk }));
    pushUndo("напоминание", () => DB.update("projects", p.id, { remind_done: (p.remind_done = prev) }));
  }
  function remindBanner() {
    const list = dueReminders(); if (!list.length) return "";
    return `<div class="remind-box">${list.map((r) => `<div class="remind-row"><span class="remind-bell">🔔</span>
      <button class="remind-proj" data-ropen="${r.p.id}">${pl(r.p)}</button><span class="remind-what">${REMIND[r.p.remind_kind]}</span>
      <span class="remind-when">поступление ~${C.dayLong(r.pay)}</span><button class="chip remind-done" data-rdone="${r.p.id}" data-mk="${r.mk}">готово</button></div>`).join("")}</div>`;
  }
  function wireRemindBanner(root, rerender) {
    $$("[data-ropen]", root).forEach((b) => (b.onclick = () => go("projects", b.dataset.ropen)));
    $$("[data-rdone]", root).forEach((b) => (b.onclick = async () => { await markRemindDone(projById(b.dataset.rdone), b.dataset.mk); toast("отмечено — следующее напоминание через месяц"); rerender(); }));
  }
  // окно напоминания: что выставить (нет / акт / счёт / акт + счёт) и когда (за 10 дней до поступления или свой день)
  function remindBox(p, onChange) {
    return new Promise((res) => {
      const m = modal(`<div class="modal-title">напоминание</div><div class="remind-opts"></div><div class="remind-when-box"></div><div class="cal-actions"><button class="btn" data-ok>Готово</button></div>`, "cal-card remind-card");
      m._onClose = () => res();
      const save = async (patch) => { Object.assign(p, patch); await safe(() => DB.update("projects", p.id, patch)); onChange(); draw(); };
      const draw = () => {
        $(".remind-opts", m).innerHTML = [["", "нет", R_ICON.bellOff], ...Object.entries(REMIND).map(([k, v]) => [k, v, R_ICON[k]])]
          .map(([k, v, ic]) => `<button class="remind-opt ${(p.remind_kind || "") === k ? "is-on" : ""}" data-k="${k}">${ic}<span>${v}</span></button>`).join("");
        $(".remind-when-box", m).innerHTML = p.remind_kind ? `<div class="money-note">когда — ближайшее ${C.dayLong(nextRemind(p).at)}</div>
          <button class="remind-auto ${p.remind_day ? "" : "is-on"}" data-auto>за 10 дней до поступления</button>
          <div class="day-grid">${Array.from({ length: 31 }, (_, i) => `<button class="cal-day ${i + 1 === p.remind_day ? "sel" : ""}" data-d="${i + 1}">${i + 1}</button>`).join("")}</div>` : "";
        $$("[data-k]", m).forEach((b) => (b.onclick = async () => {
          const v = b.dataset.k || null; await save({ remind_kind: v });
          if (v && "Notification" in window && Notification.permission === "default") { try { await Notification.requestPermission(); } catch (e) {} }
        }));
        const au = $("[data-auto]", m); if (au) au.onclick = () => save({ remind_day: null });
        $$("[data-d]", m).forEach((b) => (b.onclick = () => save({ remind_day: +b.dataset.d })));
      };
      $("[data-ok]", m).onclick = () => close(m);
      draw();
    });
  }

  /* ================= КАРТОЧКА ПРОЕКТА ================= */
  const dbg = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  const fmtD = (d) => { const [y, m, dd] = d.split("-"); return `${dd}.${m}.${y}`; };
  const noteText = (n) => { if (!n) return ""; const t = document.createElement("div"); t.innerHTML = String(n).replace(/<\/p>\s*<p>/g, "\n").replace(/<br\s*\/?>/g, "\n"); return t.textContent.replace(/\[пример-сентябрь\]\s*/g, "").trim(); };
  // строка таблицы: настоящая запись или «виртуальная» (человек в проекте без выплаты в этом месяце / пустое поступление)
  function entryRow(e) {
    const emp = empById(e.employee_id);
    const left = e.kind === "salary" ? `<button class="ent-who ${emp ? "" : "is-empty"}" data-who>${esc(emp ? C.fullName(emp) || "без имени" : "кому")}</button>`
      : e.kind === "income" ? `<input class="ent-title ent-in" data-title placeholder="${INCOME_NEW}" value="${esc(e.title || INCOME_DEFAULT)}" maxlength="120" />`
      : `<input class="ent-title" data-title placeholder="${e.kind === "org_expense" ? "офис, бухгалтер…" : "сервер, реклама, техника…"}" value="${esc(e.title || "")}" maxlength="120" />`;
    return `<div class="swipeable ent ${e._virtual ? "is-virtual" : ""}" data-eid="${e.id}" ${e._draft ? 'data-draft="1"' : ""}><div class="swipe-del">${TRASH}</div><div class="swipe-row ent-row">
      ${left}<input class="ent-amt" data-amt inputmode="decimal" placeholder="" value="${e.amount_minor ? esc(C.amountToInput(e.amount_minor)) : ""}" /><button class="ent-date" data-date>${e.date ? C.dayLabel(e.date) : ""}</button>
      <button class="ent-del" data-del aria-label="${e._virtual && e.kind === "salary" ? "Убрать из проекта" : "Удалить строку"}">${TRASH}</button></div></div>`;
  }
  function entrySection(kind, list, addLabel) {
    return `<div class="ent-sec" data-kind="${kind}"><div class="ent-head" style="--c:${K[kind === "org_expense" ? "fixed" : kind]}">${kindPill(kind === "org_expense" ? "fixed" : kind)}<button class="sec-add" data-add="${kind}" aria-label="Добавить строку" title="добавить">${PLUS_TINY}</button><span class="ent-sum">${fm(list.reduce((s, e) => s + (e.amount_minor || 0), 0))}</span></div>
      ${list.map((e) => entryRow(e)).join("")}<button class="proj-add-task ent-add" data-add="${kind}">+ ${addLabel}</button></div>`;
  }
  const entriesFor = (pid, kind) => S.entries.filter((e) => e.project_id === pid && e.kind === kind && C.inMonth(e.date, S.month)).sort((a, b) => a.date.localeCompare(b.date) || String(a.created_at || "").localeCompare(String(b.created_at || "")));
  const draftsFor = (pid, kind) => S.drafts.filter((d) => d.project_id === pid && d.kind === kind && C.inMonth(d.date, S.month));
  // строки месяца: записи + черновики + виртуальные строки, чтобы таблица выглядела одинаково каждый месяц
  function projectMonthRows(p, kind) {
    const real = entriesFor(p.id, kind), drafts = draftsFor(p.id, kind);
    S.drafts = S.drafts.filter((d) => !(d._virtual && d.project_id === p.id && d.kind === kind && C.inMonth(d.date, S.month)));
    const out = real.concat(drafts.filter((d) => !d._virtual));
    if (kind === "income" && !out.length) out.push(virtualDraft(p, "income", null));
    if (kind === "salary") {
      const have = new Set(out.map((e) => e.employee_id));
      membersOf(p.id).map(empById).filter((e) => e && e.active !== false && !have.has(e.id)).sort(byName).forEach((e) => out.push(virtualDraft(p, "salary", e)));
      out.sort((a, b) => byName(empById(a.employee_id) || { first_name: "я" }, empById(b.employee_id) || { first_name: "я" }) || a.date.localeCompare(b.date));
    }
    return out;
  }
  function virtualDraft(p, kind, emp) {
    const d = { id: "virt-" + uid(), _draft: true, _virtual: true, kind, project_id: p.id, employee_id: emp ? emp.id : null, title: kind === "income" ? INCOME_DEFAULT : null, amount_minor: null, date: C.dayInMonth(S.month, kind === "income" ? p.income_day || 10 : emp ? emp.pay_day : 10) };
    S.drafts.push(d); return d;
  }
  function renderProject(main) {
    const p = projById(S.id); if (!p) { go("projects", null, { replace: true }); return; }
    main.innerHTML = `<div class="taskcard scroll sh-card" id="pcard">
      <div class="proj-head sh-head"><button class="proj-emoji-btn" data-emoji>${esc(p.emoji || "📁")}</button><div class="taskcard-title sh-big-title" contenteditable="true" data-placeholder="Новый проект" id="p-name">${esc(p.name || "")}</div></div>
      <div class="sh-fullname" contenteditable="true" data-placeholder="Полное название организации" id="p-full">${esc(p.full_name || "")}</div>
      <div class="taskcard-meta sh-meta"><button class="status-slot" data-status>${statusPill(p.status)}</button>
        <button class="meta-pill ${p.start_date ? "" : "is-empty"}" data-d="start_date"><span class="meta-cap">договор с</span>${p.start_date ? fmtD(p.start_date) : ""}</button>
        <button class="meta-pill ${p.end_date || p.open_ended ? "" : "is-empty"}" data-d="end_date"><span class="meta-cap">до</span>${p.open_ended ? "бессрочно" : p.end_date ? fmtD(p.end_date) : ""}</button>
        <button class="meta-pill" data-incday title="ориентировочный день поступления денег каждый месяц"><span class="meta-cap">поступление ~</span>${p.income_day || 10}-го</button>
        <button class="meta-pill meta-remind ${p.remind_kind ? "" : "is-off"}" data-remind title="${p.remind_kind ? REMIND[p.remind_kind] : "напоминание не стоит"}">${p.remind_kind ? R_ICON.bell + `<span class="remind-date">${C.dayLabel(nextRemind(p).at)}</span>` + R_ICON[p.remind_kind] : R_ICON.bellOff}</button>
        ${p.archived ? `<span class="meta-pill is-empty">в архиве</span>` : ""}
        <button class="meta-pill meta-color" data-color title="цвет проекта"><span class="status-dot" style="--c:${p.color || PALETTE[0]}"></span></button></div>
      ${periodHead("grid")}
      <div id="p-tables" class="${S.month > C.monthKey(C.todayStr()) && viewOf("project") === "month" ? "is-plan-month" : ""}"></div>
      <div id="p-note" class="taskcard-desc" contenteditable="true" data-placeholder="заметки по проекту…"></div>
    </div>
    <div class="form-foot"><div class="form-actions"><button class="btn btn--solid" data-done>Готово</button><button class="btn" data-arch>${p.archived ? "Вернуть" : "В архив"}</button></div></div>`;
    $("#p-note").innerText = noteText(p.note);
    wireMonthBar(main); wireViewToggle(main, () => renderProject(main)); renderProjectTables(p);
    const card = $("#pcard");
    const saveName = dbg(async () => { p.name = $("#p-name").innerText.trim(); await safe(() => DB.update("projects", p.id, { name: p.name })); }, 500);
    const saveNote = dbg(async () => { p.note = $("#p-note").innerText; await safe(() => DB.update("projects", p.id, { note: p.note })); }, 600);
    $("#p-name").oninput = saveName; $("#p-note").oninput = saveNote;
    // полное название организации — только для себя, необязательное, ни на что не влияет
    const full = $("#p-full");
    full.oninput = dbg(async () => { const v = full.innerText.replace(/\s+/g, " ").trim(); if (!v) full.innerHTML = ""; p.full_name = v || null; await safe(() => DB.update("projects", p.id, { full_name: p.full_name })); }, 500);
    full.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); full.blur(); } };
    full.onpaste = (e) => { e.preventDefault(); document.execCommand("insertText", false, (e.clipboardData || window.clipboardData).getData("text").replace(/\s+/g, " ")); };
    $("[data-emoji]", card).onclick = async () => { const em = await pickEmoji(p.emoji); if (!em) return; p.emoji = em; await safe(() => DB.update("projects", p.id, { emoji: em })); renderProject(main); };
    $("[data-status]", card).onclick = async () => { const k = await pickStatus(p.status); if (!k) return; const prev = p.status; p.status = k; await safe(() => DB.update("projects", p.id, { status: k })); pushUndo("статус", () => DB.update("projects", p.id, { status: (p.status = prev) })); renderProject(main); };
    $("[data-color]", card).onclick = async () => { const c = await pickColor(p.color); if (!c) return; p.color = c; await safe(() => DB.update("projects", p.id, { color: c })); renderProject(main); };
    $("[data-remind]", card).onclick = async () => { await remindBox(p, () => {}); renderProject(main); };
    $("[data-incday]", card).onclick = async () => { const d = await pickDay(p.income_day || 10, "поступление денег", "ориентировочный день, когда заказчик платит каждый месяц. подставляется в дату новых поступлений"); if (!d) return; p.income_day = d; await safe(() => DB.update("projects", p.id, { income_day: d })); renderProject(main); };
    // дата окончания: под календарём «бессрочно» — второй даты нет, только пометка
    $$("[data-d]", card).forEach((b) => (b.onclick = async () => {
      const f = b.dataset.d, isEnd = f === "end_date";
      const v = await pickDate(p[f], { openEnded: isEnd, isOpen: !!p.open_ended }); if (!v) return;
      const patch = v === "open" ? { end_date: null, open_ended: true } : isEnd ? { end_date: v, open_ended: false } : { [f]: v };
      Object.assign(p, patch); await safe(() => DB.update("projects", p.id, patch)); renderProject(main);
    }));
    $("[data-done]", main).onclick = async () => { if (!p.name) { p.name = "Без названия"; await DB.update("projects", p.id, { name: p.name }); } goBack("projects"); };
    $("[data-arch]", main).onclick = async () => {
      const to = !p.archived;
      if (to && !(await confirmBox("Убрать проект в архив?", "он пропадёт из списков, но все суммы сохранятся. вернуть можно в карточке организации (кнопка «портфель»)", "В архив"))) return;
      p.archived = to; await safe(() => DB.update("projects", p.id, { archived: to }));
      pushUndo(to ? "архив" : "возврат из архива", () => DB.update("projects", p.id, { archived: (p.archived = !to) }));
      toast(to ? "проект в архиве" : "проект возвращён"); go(to ? "projects" : "projects", to ? null : p.id);
    };
  }
  function projectYearRows(p) {
    const year = yearOf(), ms = C.monthsOfYear(year);
    const ym = C.projectYear(p, S.entries, year, S.org);
    const rows = [];
    const ent = S.entries.filter((e) => e.project_id === p.id && e.date.startsWith(year));
    rows.push({ sec: "income", label: "доход", add: { kind: "income", pid: p.id } });
    // поступления не складываются: у каждого названия своя строка, а если в месяце несколько поступлений
    // с одним названием — для них отдельные строки (как в месяце). Под ними — итог
    const inc = ent.filter((e) => e.kind === "income").sort((a, b) => a.date.localeCompare(b.date) || String(a.created_at || "").localeCompare(String(b.created_at || "")));
    const titles = [...new Set([...inc.map(incTitle), ...extraTitles("inc:" + p.id)])];
    if (!titles.length) titles.push(INCOME_DEFAULT);
    titles.forEach((t) => {
      const byMonth = ms.map((k) => inc.filter((e) => incTitle(e) === t && C.inMonth(e.date, k)));
      const n = Math.max(1, ...byMonth.map((l) => l.length));
      for (let i = 0; i < n; i++) rows.push(yRow(esc(t), byMonth.map((l) => (l[i] ? l[i].amount_minor : 0)), { edit: { kind: "income", project_id: p.id, title: t, slot: i }, cellIds: byMonth.map((l) => (l[i] ? l[i].id : "")) }));
    });
    rows.push(yRow("итого доход", ym.map((m) => m.income), { cls: "is-sum" }));
    rows.push({ sec: "salary", label: "зарплаты", add: { kind: "salary", pid: p.id } });
    const sal = ent.filter((e) => e.kind === "salary");
    const people = new Set([...membersOf(p.id), ...sal.map((e) => e.employee_id).filter(Boolean)]);
    [...people].map(empById).filter((e) => e && (e.active !== false || sal.some((x) => x.employee_id === e.id))).sort(byName)
      .forEach((e) => rows.push(yRow(esc(C.fullName(e) || "без имени"), ms.map((k) => sumBy(sal.filter((x) => x.employee_id === e.id && C.inMonth(x.date, k)))), { open: e.id, page: "team", edit: { kind: "salary", project_id: p.id, employee_id: e.id } })));
    rows.push(yRow("итого зарплаты", ym.map((m) => m.salaries), { cls: "is-sum" }));
    rows.push({ sec: "expense", label: "расход", add: { kind: "expense", pid: p.id } });
    const exp = ent.filter((e) => e.kind === "expense");
    [...new Set([...exp.map((e) => (e.title || "расход").trim()), ...extraTitles("exp:" + p.id)])].sort((a, b) => a.localeCompare(b, "ru"))
      .forEach((t) => rows.push(yRow(esc(t), ms.map((k) => sumBy(exp.filter((e) => (e.title || "расход").trim() === t && C.inMonth(e.date, k)))), { edit: { kind: "expense", project_id: p.id, title: t } })));
    rows.push(yRow("итого расходы", ym.map((m) => m.other), { cls: "is-sum" }));
    rows.push({ sec: "tax", label: "налоги" });
    rows.push(yRow(`налоги · ${taxPct()} от дохода`, ym.map((m) => m.tax)));
    rows.push(yRow("итого расходов", ym.map((m) => m.total), { cls: "is-sum" }));
    rows.push({ sec: "profit", label: "прибыль" });
    const pr = yRow("прибыль", ym.map((m) => m.profit), { cls: "yt-profit" }); rows.push(pr);
    const incT = ym.reduce((s, m) => s + m.income, 0);
    rows.push({ label: "маржа", values: ym.map((m) => (m.income ? m.margin : null)), total: incT ? C.pct(pr.total, incT) : null, pct: true, cls: "yt-pct" });
    return rows;
  }
  function renderProjectTables(p) {
    const box = $("#p-tables"); if (!box) return;
    if (viewOf("project") === "year") { box.innerHTML = yearGrid(projectYearRows(p)); wireYearGrid(box, "project", () => renderProjectTables(p)); return; }
    const m = pm(p);
    const src = S.entries.filter((e) => e.project_id === p.id && C.inMonth(e.date, C.addMonths(S.month, -1)));
    box.innerHTML = `
      ${entrySection("income", projectMonthRows(p, "income"), "поступление")}
      <div class="ent-gap"></div>
      ${entrySection("salary", projectMonthRows(p, "salary"), "выплата")}
      ${entrySection("expense", projectMonthRows(p, "expense"), "расход")}
      <div class="ent-sec ent-sec--auto"><div class="ent-head" style="--c:${K.tax}">${kindPill("tax")}<span class="ent-sum">${fm(m.tax)}</span></div><div class="ent-auto"><span>${taxPct()} от дохода ${fmt(m.income)}</span></div></div>
      <div class="ent-total"><span>итого расходов</span><span>${fm(m.total)}</span></div>
      <div class="ent-profit"><div class="ent-profit-top">${kindPill("profit")}<span class="ent-profit-num ${m.profit < 0 ? "is-neg" : ""}">${fm(m.profit)}</span></div>
        <div class="ent-profit-sub">маржа ${String(m.margin).replace(".", ",")}% · цель <button class="ent-rate" data-rate>${String(m.rate).replace(".", ",")}%</button>: ${fmt(m.target)} · <span class="${m.vsTarget >= 0 ? "is-good" : "is-neg"}">${m.vsTarget >= 0 ? "выше цели на " + fmt(m.vsTarget) : "ниже на " + fmt(-m.vsTarget)}</span></div></div>
      ${src.length ? `<div class="pane-head-tools ent-copy"><button class="chip" data-copy>скопировать из ${C.MONTHS_GEN[+C.addMonths(S.month, -1).slice(5) - 1]}</button></div>` : ""}`;
    wireEntries(box, p.id, () => renderProjectTables(p));
    const r = $("[data-rate]", box); if (r) r.onclick = async () => { const v = await inputBox({ title: "цель по прибыли, %", sub: "от дохода после налогов. пусто — как в организации (" + (S.org.profit_rate ?? 20) + "%)", value: p.profit_rate != null ? String(p.profit_rate) : "" }); if (v === null) return; const n = v.trim() === "" ? null : Number(v.replace(",", ".")); if (n != null && (!Number.isFinite(n) || n < 0 || n > 100)) return toast("от 0 до 100"); p.profit_rate = n; await safe(() => DB.update("projects", p.id, { profit_rate: n })); renderProjectTables(p); };
    const cp = $("[data-copy]", box); if (cp) cp.onclick = () => copyFromPrev(src, () => renderProjectTables(p));
  }
  // общая механика строк (проект и постоянные расходы организации)
  function wireEntries(box, projectId, rerender) {
    $$(".ent", box).forEach((row) => {
      const id = row.dataset.eid, isDraft = !!row.dataset.draft;
      const get = () => (isDraft ? S.drafts : S.entries).find((x) => x.id === id);
      const commit = async (patch) => {
        const e = get(); if (!e) return;
        Object.assign(e, patch);
        if (isDraft) {
          if (!(e.amount_minor > 0)) return;          // пустую строку не сохраняем
          if (e.kind === "salary" && !e.employee_id) { toast("выберите, кому выплата"); return; }
          const { id: _x, _draft, _virtual, _dateSet, ...row0 } = e;
          S.drafts = S.drafts.filter((d) => d.id !== id);
          await createEntry(row0);
          rerender(); return;
        }
        await safe(() => DB.update("entries", e.id, patch));
        if (patch.employee_id && e.project_id) await DB.addMember(e.project_id, patch.employee_id);
        rerender();
      };
      const amt = $("[data-amt]", row);
      amt.addEventListener("change", () => { const v = C.parseAmount(amt.value); if (v == null || v <= 0) { if (!isDraft) { toast("сумма должна быть больше нуля"); amt.value = C.amountToInput(get().amount_minor); } return; } commit({ amount_minor: v }); });
      amt.addEventListener("keydown", (e) => { if (e.key === "Enter") amt.blur(); });
      const ti = $("[data-title]", row); if (ti) { ti.addEventListener("change", () => { const e = get(); if (isDraft && e && !(e.amount_minor > 0)) { e.title = ti.value.trim() || null; delete e._virtual; return; } commit({ title: ti.value.trim() || null }); }); ti.addEventListener("keydown", (e) => { if (e.key === "Enter") ti.blur(); }); }
      const who = $("[data-who]", row); if (who) who.onclick = async () => { const eid = await pickEmployee(get().employee_id, projectId); if (!eid) return; const emp = empById(eid); const patch = { employee_id: eid }; if (isDraft && emp && !get()._dateSet) patch.date = C.dayInMonth(S.month, emp.pay_day); commit(patch); if (isDraft && projectId) { await DB.addMember(projectId, eid); } };
      $("[data-date]", row).onclick = async () => {
        const v = await pickDate(get().date); if (!v) return;
        const e = get(); e._dateSet = true;
        // пустая строка: запоминаем дату в черновике (он больше не «виртуальный» и не пересоздаётся), сохранится вместе с суммой
        if (isDraft && !(e.amount_minor > 0)) { e.date = v; delete e._virtual; rerender(); return; }
        commit({ date: v });
      };
      const del = async () => {
        const e = get(); if (!e) return;
        if (isDraft) {
          // виртуальная строка человека = «убрать из проекта» (его выплаты с этого месяца тоже)
          if (e._virtual && e.kind === "salary" && e.employee_id) { if (!(await confirmBox("Убрать из проекта?", `${C.fullName(empById(e.employee_id))} больше не будет в этом проекте; выплаты с ${C.MONTHS_GEN[+S.month.slice(5) - 1]} удалятся`, "Убрать"))) return rerender(); await removeFromProject(projectId, e.employee_id, S.month); toast("убран из проекта"); }
          S.drafts = S.drafts.filter((d) => d.id !== id); rerender(); return;
        }
        await safe(() => DB.remove("entries", id)); S.entries = S.entries.filter((x) => x.id !== id);
        pushUndo("удаление строки", async () => { const { id: _i, created_at, updated_at, ...rest } = e; const r = await DB.insert("entries", rest); S.entries.push(r); });
        rerender(); toast("строка удалена · ⌘Z — вернуть");
      };
      $("[data-del]", row).onclick = async () => { const e = get(); if ((isDraft && !(e && e._virtual && e.kind === "salary")) || (await confirmBox("Удалить строку?"))) del(); };
      attachSwipe(row, del);
    });
    $$("[data-add]", box).forEach((b) => (b.onclick = () => {
      const kind = b.dataset.add; const proj = projById(projectId);
      const d = { id: "draft-" + uid(), _draft: true, kind, project_id: projectId, employee_id: null, title: kind === "income" ? INCOME_NEW : null, amount_minor: null, date: C.dayInMonth(S.month, kind === "income" ? (proj && proj.income_day) || 10 : kind === "expense" ? 15 : kind === "org_expense" ? 1 : 10) };
      S.drafts.push(d); rerender();
      setTimeout(async () => {
        if (kind === "salary") { const eid = await pickEmployee(null, projectId); if (eid) { d.employee_id = eid; const emp = empById(eid); if (emp) d.date = C.dayInMonth(S.month, emp.pay_day); await DB.addMember(projectId, eid); rerender(); } }
        const r2 = $(`[data-eid="${d.id}"]`, document); if (r2) { const f = $(kind === "salary" ? "[data-amt]" : "[data-title]", r2); f.focus(); if (kind === "income") f.select(); }
      }, 30);
    }));
  }
  async function copyFromPrev(src, rerender) {
    const existing = S.entries.filter((e) => C.inMonth(e.date, S.month));
    const plan = C.copyPlan(src, existing, S.month);
    if (!plan.length) return toast("всё уже скопировано");
    const total = plan.reduce((s, r) => s + r.amount_minor, 0);
    if (!(await confirmBox(`будет добавлено ${plan.length} ${C.plural(plan.length, "строка", "строки", "строк")} на ${fmt(total)}`, "суммы и дни как в прошлом месяце", "Скопировать"))) return;
    const ins = await safe(() => DB.insertMany("entries", plan));
    S.entries.push(...ins);
    pushUndo("копирование", async () => { for (const r of ins) await DB.remove("entries", r.id); S.entries = S.entries.filter((e) => !ins.includes(e)); });
    toast(`скопировано: ${ins.length}`); rerender();
  }

  /* ================= СОТРУДНИКИ ================= */
  async function createEmployee(name) {
    const e = await safe(() => DB.insert("employees", { ...C.splitName(name), pay_day: 10, note: "", active: true, employment: "other" }));
    S.employees.push(e); return e;
  }
  // список: по алфавиту, без фильтров и шапки; на телефоне без проектов; пусто вместо «—»
  function renderTeam(main) {
    const rows = S.employees.filter((e) => e.active !== false).sort(byName).map((e) => ({ e, t: C.employeeMonth(e.id, S.entries, S.month).total, day: C.dayInMonth(S.month, e.pay_day) }));
    const total = rows.reduce((s, r) => s + r.t, 0);
    const row = (r) => { const pr = projectsOf(r.e.id).map(projById).filter((p) => p && !p.archived); return `<div class="swipeable emp" data-id="${r.e.id}"><div class="swipe-del">${TRASH}</div><div class="swipe-row emp-row">
      <span class="emp-name">${esc(C.fullName(r.e) || "без имени")}</span>
      <span class="emp-projs">${pr.slice(0, 3).map((p) => `<span class="proj-pill task-proj" title="${esc(p.name)}"><span class="proj-emoji">${esc(p.emoji || "📁")}</span><span class="proj-name">${esc(p.name)}</span></span>`).join("")}${pr.length > 3 ? `<span class="proj-pill task-proj emp-more" title="${esc(pr.slice(3).map((p) => p.name).join(", "))}">ещё ${pr.length - 3}</span>` : ""}</span>
      <span class="meta-pill emp-day">${C.dayLabel(r.day)}</span>
      <span class="emp-sum">${fmz(r.t)}</span></div></div>`; };
    main.innerHTML = `<div class="pane pane--money scroll sh-pane">${periodHead("list")}
      <div class="emp-list">${rows.length ? rows.map(row).join("") : `<p class="empty">пока никого — добавьте по +</p>`}</div>
      <div class="fin-total emp-total"><span>зарплаты за ${C.MONTHS[+S.month.slice(5) - 1]}</span><span class="fin-sum">${fm(total)}</span></div></div>`;
    wireMonthBar(main);
    $$(".emp", main).forEach((el) => { el.onclick = () => { if (!justSwiped) go("team", el.dataset.id); }; attachSwipe(el, () => archiveEmployee(empById(el.dataset.id), () => renderTeam(main))); });
  }
  async function archiveEmployee(e, after) {
    const was = e.active !== false; e.active = !was;
    await safe(() => DB.update("employees", e.id, { active: e.active }));
    pushUndo("архив", () => DB.update("employees", e.id, { active: (e.active = was) }));
    toast(was ? "в архиве — выплаты сохранены. вернуть: «портфель» → архив" : "возвращён"); if (after) after();
  }
  // тип занятости — только для карточки сотрудника, ни на что не влияет
  const EMPLOYMENT = { staff: { name: "в штате", c: "134,217,152" }, self: { name: "самозанятый", c: "231,200,106" }, contract: { name: "по договору", c: "126,196,232" }, other: { name: "другое", c: "150,153,163" } };
  function pickEmployment(cur) {
    return new Promise((res) => {
      const m = modal(`<div class="modal-title">тип занятости</div><div class="status-list">${Object.entries(EMPLOYMENT).map(([k, v]) => `<button class="status-pill ${k === cur ? "is-cur" : ""}" data-k="${k}" style="--c:${v.c}"><span>${v.name}</span><span class="status-dot" style="--c:${v.c}"></span></button>`).join("")}</div><div class="money-note">для понимания менеджера — на расчёты и диаграммы не влияет</div>`);
      m._onClose = () => res(null);
      $$("[data-k]", m).forEach((b) => (b.onclick = () => { m._onClose = null; m.remove(); res(b.dataset.k); }));
    });
  }
  // один проект (для «+ проект» в карточке сотрудника): кроме уже выбранных
  function pickProject(exclude, title) {
    return new Promise((res) => {
      const ex = new Set(exclude || []);
      const m = modal(`<div class="modal-title">${esc(title || "проект")}</div><div class="search-wrap"><input class="field field--search" placeholder=" " /><svg class="search-ico" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/></svg></div><div class="proj-list scroll"></div>`, "pick-modal");
      m._onClose = () => res(null);
      const draw = () => {
        const qv = $("input", m).value.trim().toLowerCase();
        const list = orderedProjects().filter((p) => !ex.has(p.id) && (!qv || (p.name || "").toLowerCase().includes(qv)));
        $(".proj-list", m).innerHTML = `<button class="proj-add-row" data-new>${PLUS}</button>` + (list.length ? list.map((p) => `<button class="proj-pill" data-id="${p.id}"><span class="proj-emoji">${esc(p.emoji || "📁")}</span><span class="proj-name">${esc(p.name || "без названия")}</span></button>`).join("") : `<span class="empty">нет проектов</span>`);
        $$("[data-id]", m).forEach((b) => (b.onclick = () => { m._onClose = null; m.remove(); res(b.dataset.id); }));
        $("[data-new]", m).onclick = async () => { const n = await inputBox({ title: "новый проект", placeholder: "название" }); if (!n || !n.trim()) return; const p = await createProject(n.trim()); m._onClose = null; m.remove(); res(p.id); };
      };
      $("input", m).oninput = draw; draw(); setTimeout(() => $("input", m).focus(), 40);
    });
  }
  const NOPROJ = { id: null, emoji: "👤", name: "без проекта" };
  // выплата человеку в проекте за месяц: сумма + дата (создать или изменить)
  function payBox(e, p, current) {
    return new Promise((res) => {
      let date = current ? current.date : C.dayInMonth(S.month, e.pay_day);
      const m = modal(`<div class="modal-title">${esc(p.emoji || "📁")} ${esc(p.name || "проект")}</div><div class="confirm-sub">${esc(C.fullName(e))} · ${C.monthLabel(S.month)}${current ? "" : p.end_date && !p.open_ended ? " — новая выплата проставится до " + C.MONTHS_GEN[+p.end_date.slice(5, 7) - 1] + " " + p.end_date.slice(0, 4) : " — новая выплата проставится до конца года"}</div>
        <div class="pay-amount-wrap"><input class="field field--amount" inputmode="decimal" placeholder="сумма" value="${current ? esc(C.amountToInput(current.amount_minor)) : ""}" /><span class="pay-cur">₽</span></div>
        <button class="meta-pill" data-date><span class="meta-cap">дата</span>${C.dayLabel(date)}</button>
        <div class="minput-err" hidden></div>
        <div class="form-actions"><button class="btn btn--solid" data-y>${current ? "Сохранить" : "Добавить"}</button>${p.id ? `<button class="btn" data-open>Открыть проект</button>` : `<button class="btn" data-n>Отмена</button>`}</div>`);
      m._onClose = () => res(null);
      const inp = $("input", m); setTimeout(() => inp.focus(), 40);
      $("[data-date]", m).onclick = async () => { const v = await pickDate(date); if (v) { date = v; $("[data-date]", m).innerHTML = `<span class="meta-cap">дата</span>${C.dayLabel(date)}`; } };
      const ok = () => { const a = C.parseAmount(inp.value); if (!a) { const er = $(".minput-err", m); er.textContent = "введите сумму"; er.hidden = false; return; } m._onClose = null; m.remove(); res({ amount_minor: a, date }); };
      $("[data-y]", m).onclick = ok; inp.onkeydown = (ev) => { if (ev.key === "Enter") ok(); };
      const op = $("[data-open]", m); if (op) op.onclick = () => { m._onClose = null; m.remove(); res(null); go("projects", p.id); };
      const cn = $("[data-n]", m); if (cn) cn.onclick = () => close(m);
    });
  }
  function renderEmployee(main) {
    const e = empById(S.id); if (!e) { go("team", null, { replace: true }); return; }
    const yearMode = viewOf("employee") === "year";
    const em = EMPLOYMENT[e.employment] || null;
    main.innerHTML = `<div class="taskcard scroll sh-card">
      <div class="taskcard-title sh-big-title" contenteditable="true" data-placeholder="Имя Фамилия" id="e-name">${esc(C.fullName(e))}</div>
      <div class="taskcard-meta sh-meta"><button class="meta-pill" data-day><span class="meta-cap">выплата</span>каждое ${e.pay_day}-е</button>
        <button class="status-slot" data-emp>${em ? `<span class="status-pill" style="--c:${em.c}"><span>${em.name}</span><span class="status-dot" style="--c:${em.c}"></span></span>` : `<span class="meta-pill is-empty">тип занятости</span>`}</button>
        ${e.active === false ? `<span class="meta-pill is-empty">в архиве</span>` : ""}</div>
      ${periodHead("grid")}
      <div id="e-body" class="${S.month > C.monthKey(C.todayStr()) && !yearMode ? "is-plan-month" : ""}"></div>
      <div id="e-note" class="taskcard-desc" contenteditable="true" data-placeholder="реквизиты, паспортные данные, как платить…"></div>
    </div>
    <div class="form-foot"><div class="form-actions"><button class="btn btn--solid" data-done>Готово</button><button class="btn" data-arch>${e.active === false ? "Вернуть" : "В архив"}</button></div></div>`;
    $("#e-note").innerText = noteText(e.note);
    wireMonthBar(main); wireViewToggle(main, () => renderEmployee(main));
    renderEmployeeBody(e, yearMode);
    const saveName = dbg(async () => { Object.assign(e, C.splitName($("#e-name").innerText)); await safe(() => DB.update("employees", e.id, { first_name: e.first_name, last_name: e.last_name })); }, 500);
    const saveNote = dbg(async () => { e.note = $("#e-note").innerText; await safe(() => DB.update("employees", e.id, { note: e.note })); }, 600);
    $("#e-name").oninput = saveName; $("#e-note").oninput = saveNote;
    $("[data-day]", main).onclick = async () => { const d = await pickDay(e.pay_day); if (!d) return; e.pay_day = d; await safe(() => DB.update("employees", e.id, { pay_day: d })); renderEmployee(main); };
    $("[data-emp]", main).onclick = async () => { const k = await pickEmployment(e.employment); if (!k) return; e.employment = k; await safe(() => DB.update("employees", e.id, { employment: k })); renderEmployee(main); };
    $("[data-done]", main).onclick = async () => { if (!C.fullName(e)) { if (!S.entries.some((x) => x.employee_id === e.id)) { await DB.remove("employees", e.id); S.employees = S.employees.filter((x) => x.id !== e.id); } } goBack("team"); };
    $("[data-arch]", main).onclick = () => archiveEmployee(e, () => go("team"));
  }
  // карточка сотрудника: проекты = строки выплат (все проекты человека, даже без суммы в этом месяце)
  function renderEmployeeBody(e, yearMode) {
    const box = $("#e-body"); if (!box) return;
    if (yearMode) {
      const year = yearOf(), ms = C.monthsOfYear(year);
      const sal = S.entries.filter((x) => x.kind === "salary" && x.employee_id === e.id && x.date.startsWith(year));
      const pids = [...new Set([...projectsOf(e.id), ...sal.map((x) => x.project_id)])].map(projById).filter((p) => p && (!p.archived || sal.some((x) => x.project_id === p.id))).sort((a, b) => a.name.localeCompare(b.name, "ru"));
      const rows = [{ sec: "salary", label: "зарплаты", add: { kind: "salary", eid: e.id } }];
      rows.push(yRow("без проекта", ms.map((k) => sumBy(sal.filter((x) => !x.project_id && C.inMonth(x.date, k)))), { edit: { kind: "salary", project_id: null, employee_id: e.id } }));
      pids.forEach((p) => rows.push(yRow(pl(p), ms.map((k) => sumBy(sal.filter((x) => x.project_id === p.id && C.inMonth(x.date, k)))), { open: p.id, page: "projects", edit: { kind: "salary", project_id: p.id, employee_id: e.id } })));
      rows.push(yRow("итого", ms.map((k) => sumBy(sal.filter((x) => C.inMonth(x.date, k)))), { cls: "is-sum" }));
      box.innerHTML = yearGrid(rows); wireYearGrid(box, "employee", () => renderEmployeeBody(e, true)); return;
    }
    const mon = C.employeeMonth(e.id, S.entries, S.month);
    const pids = [...new Set([...projectsOf(e.id), ...mon.list.map((x) => x.project_id)])].map(projById).filter((p) => p && (!p.archived || mon.list.some((x) => x.project_id === p.id))).sort((a, b) => a.name.localeCompare(b.name, "ru"));
    box.innerHTML = `<div class="ent-head emp-month" style="--c:${K.salary}">${kindPill("salary")}<span class="ent-sum">${fm(mon.total)}</span></div>
      <div class="emp-pays">${(() => { const list = mon.list.filter((x) => !x.project_id); const d = list.length ? list.map((x) => x.date).sort()[0] : ""; return `<div class="emp-pay-row emp-pay-row--free" data-pid=""><div class="swipe-row emp-pay"><span class="emp-pay-name emp-free">без проекта</span><span class="emp-pay-date">${d ? `<span class="ent-date">${C.dayLabel(d)}</span>` : ""}</span><span class="emp-pay-sum">${fmz(sumBy(list))}</span></div></div>`; })()}${pids.map((p) => { const list = mon.list.filter((x) => x.project_id === p.id); const sum = sumBy(list); const d = list.length ? list.map((x) => x.date).sort()[0] : ""; return `<div class="swipeable emp-pay-row" data-pid="${p.id}"><div class="swipe-del">${TRASH}</div><div class="swipe-row emp-pay"><span class="emp-pay-name">${pl(p)}</span><span class="emp-pay-date">${d ? `<span class="ent-date">${C.dayLabel(d)}</span>` : ""}</span><span class="emp-pay-sum">${fmz(sum)}</span></div></div>`; }).join("")}
      </div><button class="proj-add-task ent-add" data-addp>+ проект</button>`;
    // зарплата без проекта: та же форма суммы и даты; новая — проставляется до декабря, как в проектах
    const free = $(".emp-pay-row--free", box);
    if (free) free.onclick = async () => {
      const list = mon.list.filter((x) => !x.project_id);
      if (list.length > 1) { localStorage.setItem("sheetaet_view_employee", "year"); renderEmployee($("#main")); return toast("в этом месяце несколько выплат — правьте в годовом виде"); }
      const r = await payBox(e, NOPROJ, list[0]); if (!r) return;
      if (list[0]) { Object.assign(list[0], r); await safe(() => DB.update("entries", list[0].id, r)); }
      else await createEntry({ kind: "salary", project_id: null, employee_id: e.id, title: null, ...r });
      renderEmployeeBody(e, false);
    };
    $$(".emp-pay-row:not(.emp-pay-row--free)", box).forEach((row) => {
      const p = projById(row.dataset.pid);
      row.onclick = async () => {
        if (justSwiped) return;
        const list = mon.list.filter((x) => x.project_id === p.id);
        if (list.length > 1) { go("projects", p.id); return; }   // несколько выплат в месяц — правим в проекте
        const r = await payBox(e, p, list[0]); if (!r) return;
        if (list[0]) { Object.assign(list[0], r); await safe(() => DB.update("entries", list[0].id, r)); }
        else await createEntry({ kind: "salary", project_id: p.id, employee_id: e.id, title: null, ...r });
        renderEmployeeBody(e, false);
      };
      attachSwipe(row, async () => { await removeFromProject(p.id, e.id, S.month); toast("убран из проекта"); renderEmployeeBody(e, false); });
    });
    $("[data-addp]", box).onclick = async () => {
      const pid = await pickProject(projectsOf(e.id), "добавить в проект"); if (!pid) return;
      await DB.addMember(pid, e.id);
      const r = await payBox(e, projById(pid), null);
      if (r) await createEntry({ kind: "salary", project_id: pid, employee_id: e.id, title: null, ...r });
      else toast("добавлен в проект без суммы");
      renderEmployeeBody(e, false);
    };
  }

  /* ================= ОРГАНИЗАЦИЯ ================= */
  // удалить из архива навсегда: проект — со всеми его суммами; человек — с его выплатами
  async function deleteForever(kind, id) {
    if (kind === "project") {
      if (DEMO) { const d = Demo.get(); d.entries = d.entries.filter((e) => e.project_id !== id); d.members = d.members.filter((m) => m.project_id !== id); Demo.write(d); }
      await safe(() => DB.remove("projects", id));
      S.projects = S.projects.filter((p) => p.id !== id); S.entries = S.entries.filter((e) => e.project_id !== id); S.members = S.members.filter((m) => m.project_id !== id);
    } else {
      if (DEMO) { const d = Demo.get(); d.entries = d.entries.filter((e) => e.employee_id !== id); d.members = d.members.filter((m) => m.employee_id !== id); Demo.write(d); }
      else await safe(() => q(sb.from("entries").delete().eq("org_id", S.org.id).eq("employee_id", id)));
      await safe(() => DB.remove("employees", id));
      S.employees = S.employees.filter((e) => e.id !== id); S.entries = S.entries.filter((e) => e.employee_id !== id); S.members = S.members.filter((m) => m.employee_id !== id);
    }
  }
  // архив: два списка — проекты и люди; «вернуть» и «удалить» (навсегда, с подтверждением)
  function archiveBox(after) {
    const m = modal(`<div class="modal-title">архив</div><div class="arch-body scroll"></div><button class="modal-clear" data-ok>готово</button>`, "pick-modal arch-modal");
    m._onClose = () => after && after();
    const draw = () => {
      const archP = S.projects.filter((p) => p.archived).sort((a, b) => (a.name || "").localeCompare(b.name || "", "ru"));
      const archE = S.employees.filter((e) => e.active === false).sort(byName);
      const row = (kind, id, label) => `<div class="org-arch-row"><button class="org-arch-name" data-open="${kind}:${id}">${label}</button><button class="chip" data-back="${kind}:${id}">вернуть</button><button class="chip arch-del" data-del="${kind}:${id}">удалить</button></div>`;
      $(".arch-body", m).innerHTML = `<div class="arch-head">проекты</div>${archP.length ? archP.map((p) => row("project", p.id, pl(p))).join("") : `<p class="empty">пусто</p>`}
        <div class="arch-head">люди</div>${archE.length ? archE.map((e) => row("person", e.id, esc(C.fullName(e) || "без имени"))).join("") : `<p class="empty">пусто</p>`}`;
      $$("[data-open]", m).forEach((b) => (b.onclick = () => { const [k, id] = b.dataset.open.split(":"); m._onClose = null; m.remove(); go(k === "project" ? "projects" : "team", id); }));
      $$("[data-back]", m).forEach((b) => (b.onclick = async () => {
        const [k, id] = b.dataset.back.split(":");
        if (k === "project") { const p = projById(id); p.archived = false; await safe(() => DB.update("projects", id, { archived: false })); toast("проект возвращён"); }
        else { const e = empById(id); e.active = true; await safe(() => DB.update("employees", id, { active: true })); toast("сотрудник возвращён"); }
        draw();
      }));
      $$("[data-del]", m).forEach((b) => (b.onclick = async () => {
        const [k, id] = b.dataset.del.split(":");
        const name = k === "project" ? (projById(id) || {}).name || "без названия" : C.fullName(empById(id)) || "без имени";
        const ok = await confirmBox(`Удалить «${name}» навсегда?`, k === "project" ? "проект и все его суммы удалятся без возможности вернуть" : "человек и все его выплаты во всех проектах удалятся без возможности вернуть", "Удалить навсегда");
        if (!ok) return;
        await deleteForever(k === "project" ? "project" : "person", id); toast("удалено навсегда"); draw();
      }));
    };
    $("[data-ok]", m).onclick = () => close(m);
    draw();
  }
  function orgYearRows() {
    const year = yearOf(), ms = C.monthsOfYear(year);
    const fx = S.entries.filter((e) => e.kind === "org_expense" && e.date.startsWith(year));
    const rows = [{ sec: "fixed", label: "постоянные расходы", add: { kind: "org_expense" } }];
    [...new Set([...fixedTitles(), ...extraTitles("fix")])].forEach((t) => rows.push(yRow(esc(t), ms.map((k) => sumBy(fx.filter((e) => (e.title || "расход").trim() === t && C.inMonth(e.date, k)))), { edit: { kind: "org_expense", project_id: null, title: t } })));
    rows.push(yRow("итого", ms.map((k) => sumBy(fx.filter((e) => C.inMonth(e.date, k)))), { cls: "is-sum" }));
    return rows;
  }
  function renderOrg(main) {
    const o = S.org;
    const prevList = S.entries.filter((x) => x.kind === "org_expense" && C.inMonth(x.date, C.addMonths(S.month, -1)));
    const isOwner = DEMO || (S.people || []).some((p) => S.user && p.email === S.user.email && p.role === "owner");
    const archN = S.projects.filter((p) => p.archived).length + S.employees.filter((e) => e.active === false).length;
    const yearMode = viewOf("org") === "year";
    main.innerHTML = `<div class="taskcard scroll sh-card sh-card--nav">
      <div class="taskcard-title sh-big-title" contenteditable="true" data-placeholder="название организации" id="o-name">${esc(o.name || "")}</div>
      <div class="taskcard-meta sh-meta"><span class="meta-pill"><span class="meta-cap">адрес</span>/${esc(o.slug)}/</span>
        <button class="meta-pill" data-tax title="ставка налога от дохода проекта"><span class="meta-cap">налог</span>${taxPct()} от дохода проекта</button>
        <button class="meta-pill" data-rate><span class="meta-cap">цель по прибыли</span>${String(o.profit_rate ?? 20).replace(".", ",")}%</button>
        <button class="meta-pill" data-arch><span class="meta-cap">архив</span>${archN || ""}</button></div>
      ${periodHead("grid")}
      <div id="o-fixed" class="${S.month > C.monthKey(C.todayStr()) && !yearMode ? "is-plan-month" : ""}"></div>
      <div class="proj-tasks"><div class="proj-tasks-head">участники</div>
        ${(S.people || []).map((p) => `<div class="org-person"><span>${esc(p.email)}</span><span class="pay-role">${p.role === "owner" ? "владелец" : "участник"}</span></div>`).join("")}</div>
      ${isOwner && !DEMO ? `<div class="pane-head-tools org-actions"><button class="chip" data-pass>пароль организации</button></div>` : ""}
      ${DEMO ? `<p class="money-note">демо-режим: данные хранятся только в этом браузере</p>` : ""}
    </div>`;
    const box = $("#o-fixed");
    const draw = () => {
      if (viewOf("org") === "year") { box.innerHTML = yearGrid(orgYearRows()); wireYearGrid(box, "org", draw); return; }
      const l = S.entries.filter((x) => x.kind === "org_expense" && C.inMonth(x.date, S.month)).sort((a, b) => a.date.localeCompare(b.date)).concat(S.drafts.filter((d) => d.kind === "org_expense" && C.inMonth(d.date, S.month)));
      box.innerHTML = `${entrySection("org_expense", l, "постоянный расход")}${prevList.length ? `<div class="pane-head-tools ent-copy"><button class="chip" data-copy>скопировать из прошлого месяца</button></div>` : ""}`;
      wireEntries(box, null, draw);
      const cp = $("[data-copy]", box); if (cp) cp.onclick = () => copyFromPrev(prevList, draw);
    };
    draw();
    wireMonthBar(main); wireViewToggle(main, () => renderOrg(main));
    $("[data-arch]", main).onclick = () => archiveBox(() => renderOrg(main));
    $("#o-name").oninput = dbg(async () => { await safe(() => DB.updateOrg({ name: $("#o-name").innerText.trim() })); }, 500);
    $("[data-tax]", main).onclick = async () => {
      const v = await inputBox({ title: "ставка налога, %", sub: "от дохода каждого проекта. пересчитаются все месяцы и все таблицы", value: String(C.taxRateOf(o)).replace(".", ","), okLabel: "Сохранить" });
      if (v === null) return; const n = Number(v.replace(",", ".").replace("%", "").trim());
      if (!Number.isFinite(n) || n < 0 || n > 100) return toast("от 0 до 100");
      const prev = o.tax_rate; await safe(() => DB.updateOrg({ tax_rate: n }));
      pushUndo("ставка налога", () => DB.updateOrg({ tax_rate: prev })); toast(`налог ${String(n).replace(".", ",")}%`); renderOrg(main);
    };
    $("[data-rate]", main).onclick = async () => { const v = await inputBox({ title: "цель по прибыли, %", sub: "для новых проектов: % от дохода после налогов", value: String(o.profit_rate ?? 20) }); if (v === null) return; const n = Number(v.replace(",", ".")); if (!Number.isFinite(n) || n < 0 || n > 100) return toast("от 0 до 100"); await safe(() => DB.updateOrg({ profit_rate: n })); renderOrg(main); };
    const pw = $("[data-pass]", main); if (pw) pw.onclick = async () => { const v = await inputBox({ title: "пароль организации", sub: "его спрашивают перед личным входом на /" + o.slug + "/. минимум 6 символов", type: "password", okLabel: "Сохранить" }); if (!v) return; try { await q(sb.rpc("org_set_password", { p_org: o.id, p_password: v })); toast("пароль организации сохранён"); } catch (err) { toast(err.message); } };
  }

  // SPA-фолбэк GitHub Pages: 404.html сохранил исходный адрес
  try { const r = sessionStorage.getItem("sheetaet_redirect"); if (r) { sessionStorage.removeItem("sheetaet_redirect"); history.replaceState(null, "", r); } } catch (e) {}
  if (sb) sb.auth.onAuthStateChange((ev, session) => { if (ev === "SIGNED_OUT") { S.org = null; } if (ev === "PASSWORD_RECOVERY" && session) { inputBox({ title: "новый пароль", type: "password", okLabel: "Сохранить" }).then(async (v) => { if (!v) return; const { error } = await sb.auth.updateUser({ password: v }); toast(error ? error.message : "пароль обновлён"); }); } });
  boot();
})();
