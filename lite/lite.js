/* =================================================================
   sheetaet lite — экономика маленькой организации в одной таблице.
   Две страницы: год организации (?y=2026) и год проекта (?p=<id>). Одно действие — сумма в ячейке.
   Ячейка = одна сумма за месяц (тип + проект + человек/название). Деньги — целые копейки.
   ================================================================= */
(function () {
  "use strict";
  const CFG = window.SHEETAET_CONFIG || {};
  const SLUG = new URLSearchParams(location.search).get("org") || "sut-media-lite";
  // демо (только localhost и ?demo): снимок данных из _dev/demo.json, всё в памяти, в базу ничего не пишется
  const DEMO = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && new URLSearchParams(location.search).has("demo");
  const sb = DEMO ? null : window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true, storageKey: "sheetaet-auth" } });
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const pad = (n) => String(n).padStart(2, "0");
  const NNBSP = " ", MINUS = "−";
  const MS = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
  const MS_GEN = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
  const K = { income: "134,217,152", salary: "231,200,106", expense: "232,155,184", tax: "126,196,232" };
  const COARSE = matchMedia("(pointer: coarse)").matches;
  const now = new Date(), TODAY = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;

  const S = { org: null, user: null, projects: [], employees: [], members: [], entries: [], drafts: [], year: String(now.getFullYear()), pid: null, q: "", rows: [], edit: null, pending: false };

  /* ---------- деньги ---------- */
  const grp = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, NNBSP);
  function fmt(minor) { if (!minor) return ""; const r = Math.round(Math.abs(minor) / 100); return (minor < 0 ? MINUS : "") + grp(r); }
  function fmtRub(minor) { return (minor < 0 ? MINUS : "") + grp(Math.round(Math.abs(minor || 0) / 100)) + " ₽"; }
  function toInput(minor) { if (!minor) return ""; const a = Math.abs(minor), r = Math.floor(a / 100), k = a % 100; return (minor < 0 ? "-" : "") + grp(r).replace(/ /g, " ") + (k ? "," + pad(k) : ""); }
  // «45 000», «45к», «1,5 млн», «-3000» → копейки; пусто → 0; мусор → null
  function parse(v) {
    let s = String(v || "").toLowerCase().replace(/[\s  ']/g, "").replace(/[−–—]/g, "-").replace(/₽|руб\.?/g, "");
    if (!s) return 0;
    const neg = s.startsWith("-"); s = s.replace(/^[-+]/, "");
    let mult = 1; const m = s.match(/(тыс\.?|к|k|млн\.?|м|m)$/); if (m) { mult = /^(тыс|к|k)/.test(m[1]) ? 1e3 : 1e6; s = s.slice(0, -m[1].length); }
    if (!/^\d+([.,]\d{0,2})?$/.test(s)) return null;
    const n = Math.round(Number(s.replace(",", ".")) * mult * 100);
    return Number.isFinite(n) ? (neg ? -n : n) : null;
  }
  const keys = () => Array.from({ length: 12 }, (_, i) => `${S.year}-${pad(i + 1)}`);
  const mkOf = (e) => e.date.slice(0, 7);
  const inYear = (e) => e.date.startsWith(S.year + "-");
  const fullName = (e) => [e.first_name, e.last_name].filter(Boolean).join(" ").trim() || "без имени";
  const byName = (a, b) => fullName(a).localeCompare(fullName(b), "ru");
  const titleOf = (e) => (e.title || "расход").trim();
  const projById = (id) => S.projects.find((p) => p.id === id) || null;
  const empById = (id) => S.employees.find((e) => e.id === id) || null;
  const plural = (n, one, few, many) => { const a = Math.abs(n) % 100, b = a % 10; return a > 10 && a < 20 ? many : b > 1 && b < 5 ? few : b === 1 ? one : many; };
  const monthLabel = (k) => MS[+k.slice(5) - 1] + (k.slice(0, 4) !== S.year ? " " + k.slice(0, 4) : "");

  /* ---------- налог: ставка с месяца ---------- */
  function taxHistory() { const h = Array.isArray(S.org.tax_history) ? S.org.tax_history.slice() : []; return h.sort((a, b) => a.from.localeCompare(b.from)); }
  function rateFor(key) { let r = Number(S.org.tax_rate ?? 7); for (const h of taxHistory()) if (h.from <= key) r = Number(h.rate); return Number.isFinite(r) ? r : 7; }
  const pctStr = (n) => String(n).replace(".", ",") + "%";

  /* ---------- данные ---------- */
  const q = async (p) => { const { data, error } = await p; if (error) throw new Error(error.message); return data; };
  async function loadAll() {
    if (DEMO) { if (!S.org) Object.assign(S, await (await fetch("_dev/demo.json")).json(), { user: { email: "demo@sheetaet" } }); return; }
    const org = await q(sb.from("orgs").select("*").eq("slug", SLUG).maybeSingle());
    if (!org) throw new Error("нет доступа к организации «" + SLUG + "»");
    const [projects, employees, members, entries] = await Promise.all([
      q(sb.from("projects").select("*").eq("org_id", org.id)), q(sb.from("employees").select("*").eq("org_id", org.id)),
      q(sb.from("project_members").select("*").eq("org_id", org.id)), q(sb.from("entries").select("*").eq("org_id", org.id)),
    ]);
    Object.assign(S, { org, projects, employees, members, entries });
  }
  const uid = () => crypto.randomUUID();
  const DB = {
    async ins(table, row) { if (DEMO) return { id: uid(), created_at: new Date().toISOString(), ...row, org_id: S.org.id }; return await q(sb.from(table).insert({ ...row, org_id: S.org.id }).select().single()); },
    async upd(table, id, patch) { if (DEMO) return; await q(sb.from(table).update(patch).eq("id", id)); },
    async del(table, id) { if (DEMO) return; await q(sb.from(table).delete().eq("id", id)); },
    async org(patch) { if (DEMO) return; await q(sb.from("orgs").update(patch).eq("id", S.org.id)); },
    async memberAdd(row) { if (DEMO) return; await q(sb.from("project_members").upsert(row)); },
    async memberDel(pid, eid) { if (DEMO) return; await q(sb.from("project_members").delete().eq("project_id", pid).eq("employee_id", eid)); },
    async log() { if (DEMO) return []; return await q(sb.from("entry_log").select("*").eq("org_id", S.org.id).order("at", { ascending: false }).limit(40)); },
  };
  async function safe(fn) { try { return await fn(); } catch (e) { toast("не сохранилось: " + e.message); throw e; } }

  /* ---------- журнал отмены: каждая операция — набор изменений записей ---------- */
  const Undo = [];
  async function applyOps(ops) {
    // ops: [{t:'ins', row}|{t:'upd', id, patch, prev}|{t:'del', row}] — выполняются и возвращают обратные
    const back = [];
    for (const op of ops) {
      if (op.t === "ins") { const { id, created_at, updated_at, org_id, ...rest } = op.row; const r = await DB.ins("entries", rest); S.entries.push(r); back.push({ t: "del", row: r }); }
      else if (op.t === "upd") { await DB.upd("entries", op.id, op.patch); const e = S.entries.find((x) => x.id === op.id); if (e) Object.assign(e, op.patch); back.push({ t: "upd", id: op.id, patch: op.prev, prev: op.patch }); }
      else if (op.t === "del") { await DB.del("entries", op.row.id); S.entries = S.entries.filter((x) => x.id !== op.row.id); back.push({ t: "ins", row: op.row }); }
    }
    return back.reverse();
  }
  async function doOps(label, ops, msg) {
    if (!ops.length) return;
    const back = await safe(() => applyOps(ops));
    const it = { label, back }; Undo.push(it);
    render(); toast(msg || label, () => undo(it));
  }
  async function undo(it) {
    it = it || Undo[Undo.length - 1]; if (!it) return toast("нечего отменять");
    const i = Undo.indexOf(it); if (i >= 0) Undo.splice(i, 1);
    await safe(() => applyOps(it.back)); render(); toast("отменено: " + it.label);
  }
  document.addEventListener("keydown", (e) => { if ((e.metaKey || e.ctrlKey) && e.code === "KeyZ" && !e.shiftKey && !/INPUT|TEXTAREA/.test((document.activeElement || {}).tagName || "") && !(document.activeElement || {}).isContentEditable) { e.preventDefault(); undo(); } });

  /* ---------- ячейка: одна сумма за месяц ---------- */
  const match = (spec, key) => (e) => e.kind === spec.kind && (e.project_id || null) === (spec.project_id || null) && mkOf(e) === key
    && (spec.kind === "salary" ? e.employee_id === spec.employee_id : spec.kind === "income" ? true : titleOf(e) === spec.title);
  // изменения, чтобы в ячейке стала сумма minor (0 — пусто); несколько записей в месяце сливаются в одну
  function cellOps(spec, key, minor) {
    const list = S.entries.filter(match(spec, key)), ops = [];
    if (!minor) list.forEach((e) => ops.push({ t: "del", row: e }));
    else if (list.length) {
      if (list[0].amount_minor !== minor) ops.push({ t: "upd", id: list[0].id, patch: { amount_minor: minor }, prev: { amount_minor: list[0].amount_minor } });
      list.slice(1).forEach((e) => ops.push({ t: "del", row: e }));
    } else ops.push({ t: "ins", row: { kind: spec.kind, project_id: spec.project_id || null, employee_id: spec.employee_id || null, title: spec.kind === "expense" || spec.kind === "org_expense" ? spec.title : null, amount_minor: minor, date: key + "-01" } });
    return ops;
  }
  const sumWhere = (fn) => S.entries.reduce((s, e) => (fn(e) ? s + e.amount_minor : s), 0);

  /* ---------- строки таблицы ---------- */
  function visibleProjects() {
    const has = new Set(S.entries.filter(inYear).map((e) => e.project_id));
    return S.projects.filter((p) => !p.archived || has.has(p.id)).sort((a, b) => (a.name || "").localeCompare(b.name || "", "ru"));
  }
  function projectsOfPerson(eid) {
    const s = new Set(S.members.filter((m) => m.employee_id === eid).map((m) => m.project_id));
    S.entries.forEach((e) => { if (e.kind === "salary" && e.employee_id === eid && inYear(e)) s.add(e.project_id); });
    return [...s].map(projById).filter((p) => p && (!p.archived || S.entries.some((e) => e.project_id === p.id && e.employee_id === eid && inYear(e))));
  }
  function taxRow(projIds) {
    const ks = keys();
    return ks.map((k) => projIds.reduce((s, pid) => s + Math.round((sumWhere((e) => e.kind === "income" && e.project_id === pid && mkOf(e) === k) * rateFor(k)) / 100), 0));
  }
  function taxLabel() {
    const ks = keys(), rates = [...new Set(ks.map(rateFor))];
    if (rates.length === 1) return `налог ${pctStr(rates[0])}`;
    const ch = ks.filter((k, i) => i && rateFor(k) !== rateFor(ks[i - 1])).map((k) => `${pctStr(rateFor(k))} с ${MS[+k.slice(5) - 1]}`);
    return `налог ${pctStr(rateFor(ks[0]))} → ${ch.join(", ")}`;
  }
  const lineKey = (pid, title) => (pid || "org") + "|" + title.toLowerCase();
  function expenseLines(pid) {
    // pid: undefined — все (организация), иначе — только проект
    const map = new Map();
    S.entries.filter((e) => (e.kind === "expense" || e.kind === "org_expense") && inYear(e) && (pid === undefined || e.project_id === pid)).forEach((e) => { const t = titleOf(e); map.set(lineKey(e.project_id, t), { project_id: e.project_id || null, title: t }); });
    S.drafts.filter((d) => pid === undefined || d.project_id === pid).forEach((d) => { if (!map.has(lineKey(d.project_id, d.title))) map.set(lineKey(d.project_id, d.title), d); });
    return [...map.values()].sort((a, b) => a.title.localeCompare(b.title, "ru") || String((projById(a.project_id) || {}).name || "").localeCompare(String((projById(b.project_id) || {}).name || ""), "ru"));
  }
  const row = (o) => ({ type: "row", ...o });
  const valuesFor = (spec) => keys().map((k) => sumWhere(match(spec, k)));
  const colSum = (rows) => keys().map((_, i) => rows.reduce((s, r) => s + (r.values[i] || 0), 0));

  function buildOrg() {
    const projs = visibleProjects(), out = [];
    const inc = projs.map((p) => { const spec = { kind: "income", project_id: p.id }; return row({ label: p.name || "без названия", open: p.id, tag: p.archived ? "архив" : "", spec, values: valuesFor(spec) }); });
    out.push({ type: "sec", k: "income", label: "доход" }, ...inc, { type: "add", act: "project", label: "+ проект" }, { type: "sum", label: "доход всего", values: colSum(inc) });
    out.push({ type: "sec", k: "tax", label: "налог" }, { type: "sum", label: taxLabel(), values: taxRow(projs.map((p) => p.id)), note: "считается сам от дохода" });
    const paid = new Set(S.entries.filter((e) => e.kind === "salary" && inYear(e)).map((e) => e.employee_id));
    const people = S.employees.filter((e) => e.active !== false || paid.has(e.id)).sort(byName).map((emp) => {
      const pr = projectsOfPerson(emp.id);
      const values = keys().map((k) => sumWhere((e) => e.kind === "salary" && e.employee_id === emp.id && mkOf(e) === k));
      const spec = pr.length === 1 ? { kind: "salary", project_id: pr[0].id, employee_id: emp.id } : null;
      return row({ label: fullName(emp), person: emp.id, tag: pr.length === 1 ? pr[0].name : pr.length ? `${pr.length} ${plural(pr.length, "проект", "проекта", "проектов")}` : "без проекта", spec, values, ro: spec ? "" : pr.length ? "сумма складывается из нескольких проектов — правьте в проекте" : "добавьте человека в проект: нажмите на имя" });
    });
    out.push({ type: "sec", k: "salary", label: "зарплаты" }, ...people, { type: "add", act: "person", label: "+ человек" }, { type: "sum", label: "зарплаты всего", values: colSum(people) });
    const exp = expenseLines().map((l) => { const spec = { kind: l.project_id ? "expense" : "org_expense", project_id: l.project_id, title: l.title }; return row({ label: l.title, line: l, tag: l.project_id ? (projById(l.project_id) || {}).name || "" : "общие", spec, values: valuesFor(spec) }); });
    out.push({ type: "sec", k: "expense", label: "расходы" }, ...exp, { type: "add", act: "expense", label: "+ расход" }, { type: "sum", label: "расходы всего", values: colSum(exp) });
    return withProfit(out, colSum(inc), taxRow(projs.map((p) => p.id)), colSum(people), colSum(exp));
  }
  function buildProject(p) {
    const out = [], spec = { kind: "income", project_id: p.id };
    const inc = [row({ label: "поступления", spec, values: valuesFor(spec) })];
    out.push({ type: "sec", k: "income", label: "доход" }, ...inc);
    out.push({ type: "sec", k: "tax", label: "налог" }, { type: "sum", label: taxLabel(), values: taxRow([p.id]) });
    const ids = new Set(S.members.filter((m) => m.project_id === p.id).map((m) => m.employee_id));
    S.entries.forEach((e) => { if (e.kind === "salary" && e.project_id === p.id && inYear(e)) ids.add(e.employee_id); });
    const people = [...ids].map(empById).filter((e) => e && (e.active !== false || S.entries.some((x) => x.employee_id === e.id && x.project_id === p.id && inYear(x)))).sort(byName)
      .map((emp) => { const sp = { kind: "salary", project_id: p.id, employee_id: emp.id }; return row({ label: fullName(emp), person: emp.id, spec: sp, values: valuesFor(sp) }); });
    out.push({ type: "sec", k: "salary", label: "зарплаты" }, ...people, { type: "add", act: "person", label: "+ человек" }, { type: "sum", label: "зарплаты всего", values: colSum(people) });
    const exp = expenseLines(p.id).map((l) => { const sp = { kind: "expense", project_id: p.id, title: l.title }; return row({ label: l.title, line: l, spec: sp, values: valuesFor(sp) }); });
    out.push({ type: "sec", k: "expense", label: "расходы" }, ...exp, { type: "add", act: "expense", label: "+ расход" }, { type: "sum", label: "расходы всего", values: colSum(exp) });
    return withProfit(out, colSum(inc), taxRow([p.id]), colSum(people), colSum(exp));
  }
  function withProfit(out, inc, tax, sal, exp) {
    const profit = keys().map((_, i) => inc[i] - tax[i] - sal[i] - exp[i]);
    out.push({ type: "profit", label: "прибыль", values: profit });
    const it = inc.reduce((s, v) => s + v, 0), pt = profit.reduce((s, v) => s + v, 0);
    out.push({ type: "pct", label: "маржа", values: inc.map((v, i) => (v ? Math.round((profit[i] / v) * 1000) / 10 : null)), total: it ? Math.round((pt / it) * 1000) / 10 : null });
    S.profit = profit;
    return out;
  }

  /* ---------- отрисовка ---------- */
  function render() {
    if (!S.org) return;
    if (S.edit) { S.pending = true; return; }   // идёт правка — перерисуем после
    const p = S.pid ? projById(S.pid) : null;
    if (S.pid && !p) { go(null, true); return; }
    $("#year").textContent = S.year;
    $("#back").hidden = !p;
    const t = $("#title");
    t.textContent = p ? p.name || "без названия" : S.org.name || "организация";
    t.contentEditable = p ? "true" : "false";
    $("#title-sub").textContent = p ? (p.archived ? "в архиве" : "проект") : "";
    $("#arch-btn").hidden = !p; if (p) $("#arch-btn").textContent = p.archived ? "Вернуть из архива" : "В архив";
    document.title = (p ? p.name + " · " : "") + "sheetaet lite";
    S.rows = p ? buildProject(p) : buildOrg();
    const ks = keys(), cls = (i) => (ks[i] === TODAY ? " is-cur" : ks[i] > TODAY ? " is-plan" : "");
    const cells = (vals, total, isPct) => vals.map((v, i) => `<td class="n${cls(i)}${v < 0 ? " neg" : ""}" data-k="${ks[i]}">${isPct ? (v == null ? "" : pctStr(v)) : fmt(v)}</td>`).join("") + `<td class="n t${total < 0 ? " neg" : ""}">${isPct ? (total == null ? "" : pctStr(total)) : fmt(total)}</td>`;
    const tot = (v) => v.reduce((s, x) => s + (x || 0), 0);
    let h = `<colgroup><col class="c-l" />${ks.map(() => `<col />`).join("")}<col class="c-t" /></colgroup>
      <thead><tr><th class="l"></th>${ks.map((k, i) => `<th class="n${cls(i)}">${MS[i]}</th>`).join("")}<th class="n t">итого</th></tr></thead><tbody>`;
    S.rows.forEach((r, ri) => {
      if (r.type === "sec") h += `<tr class="sec"><th class="l" colspan="1"><span class="pill" style="--c:${K[r.k]}">${r.label}</span></th>${ks.map((_, i) => `<td class="${cls(i).trim()}"></td>`).join("")}<td class="t"></td></tr>`;
      else if (r.type === "add") h += `<tr class="add"><td class="l"><button class="add-btn" data-add="${r.act}">${r.label}</button></td>${ks.map((_, i) => `<td class="${cls(i).trim()}"></td>`).join("")}<td class="t"></td></tr>`;
      else if (r.type === "sum") h += `<tr class="sum"><td class="l" title="${esc(r.note || r.label)}">${esc(r.label)}</td>${cells(r.values, tot(r.values))}</tr>`;
      else if (r.type === "profit") h += `<tr class="profit"><td class="l">${esc(r.label)}</td>${cells(r.values, tot(r.values))}</tr>`;
      else if (r.type === "pct") h += `<tr class="pct"><td class="l">${esc(r.label)}</td>${cells(r.values, r.total, true)}</tr>`;
      else {
        const lbl = `<button class="lbl" data-lbl="${ri}" title="${esc(r.label + (r.tag ? " · " + r.tag : ""))}"><span class="lbl-m"><span class="lbl-t">${esc(r.label)}</span>${r.open ? `<span class="go">›</span>` : ""}</span>${r.tag ? `<span class="tag">${esc(r.tag)}</span>` : ""}</button>`;
        h += `<tr class="item" data-r="${ri}" data-q="${esc((r.label + " " + (r.tag || "")).toLowerCase())}"><td class="l">${lbl}</td>${r.values.map((v, i) => `<td class="n${cls(i)}${v < 0 ? " neg" : ""} ${r.spec ? "ed" : "ro"}" data-k="${ks[i]}">${fmt(v)}</td>`).join("")}<td class="n t${tot(r.values) < 0 ? " neg" : ""}">${fmt(tot(r.values))}</td></tr>`;
      }
    });
    $("#sheet").innerHTML = h + "</tbody>";
    applySearch(); renderFoot();
  }
  function renderFoot() {
    const ks = keys(), fact = ks.filter((k) => k <= TODAY), plan = ks.filter((k) => k > TODAY);
    const sumK = (list) => list.reduce((s, k) => s + S.profit[ks.indexOf(k)], 0);
    const range = (list) => (list.length ? MS[+list[0].slice(5) - 1] + (list.length > 1 ? "–" + MS[+list[list.length - 1].slice(5) - 1] : "") : "");
    let h = "";
    if (fact.length) h += `<span>факт ${range(fact)}: прибыль <b>${fmtRub(sumK(fact))}</b></span>`;
    if (plan.length) h += `<span>план ${range(plan)} (серым): <b>${fmtRub(sumK(plan))}</b></span>`;
    h += `<span>нажмите на сумму, чтобы изменить</span>`;
    $("#foot").innerHTML = h;
  }
  function applySearch() {
    const qv = S.q.trim().toLowerCase();
    $$("#sheet tr.item").forEach((tr) => tr.classList.toggle("is-off", !!qv && !tr.dataset.q.includes(qv)));
  }

  /* ---------- правка ячейки ---------- */
  let lastDown = null;
  document.addEventListener("pointerdown", (e) => { lastDown = e.target; }, true);
  function startEdit(td) {
    const tr = td.closest("tr.item"); if (!tr) return;
    const r = S.rows[+tr.dataset.r]; if (!r) return;
    if (!r.spec) { toast(r.ro || "эту сумму править здесь нельзя"); return; }
    const key = td.dataset.k, cur = sumWhere(match(r.spec, key));
    S.edit = { td, r, ri: +tr.dataset.r, key, done: false };
    td.classList.add("editing");
    td.innerHTML = `<input class="cell-in" inputmode="decimal" enterkeyhint="done" autocomplete="off" value="${esc(toInput(cur))}" aria-label="${esc(r.label)}, ${MS_GEN[+key.slice(5) - 1]}" />`;
    const inp = $("input", td); inp.focus({ preventScroll: true }); inp.select();
    const bar = document.createElement("div"); bar.className = "edbar";
    bar.innerHTML = `<button data-sign title="плюс / минус (возврат)">±</button><button data-fill title="эта сумма в этом и всех следующих месяцах до декабря">до декабря</button><button class="ok" data-ok>Сохранить</button>`;
    document.body.appendChild(bar); S.edit.bar = bar; placeBar();
    bar.addEventListener("pointerdown", (e) => e.preventDefault());   // фокус остаётся в ячейке
    $("[data-sign]", bar).onclick = () => { inp.value = inp.value.trim().startsWith("-") ? inp.value.trim().slice(1) : "-" + inp.value.trim(); inp.focus(); };
    $("[data-fill]", bar).onclick = () => finish("fill");
    $("[data-ok]", bar).onclick = () => finish("save");
    inp.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); finish("save"); }
      else if (e.key === "Escape") { e.preventDefault(); finish("cancel"); }
      else if (e.key === "Tab") { e.preventDefault(); finish("save", { dx: e.shiftKey ? -1 : 1 }); }
      else if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); finish("save", { dy: e.key === "ArrowDown" ? 1 : -1 }); }
    });
    inp.addEventListener("blur", () => setTimeout(() => {
      if (!S.edit || S.edit.td !== td || S.edit.done) return;
      // компьютер: клик мимо — сохранить; телефон: сохраняем, только если нажата другая ячейка (иначе — отмена, чтобы случайная цифра не попала в учёт)
      const toCell = lastDown && lastDown.closest && lastDown.closest("td.ed");
      finish(!COARSE || toCell ? "save" : "cancel", toCell ? { next: toCell } : null);
    }, 0));
  }
  function placeBar() {
    const ed = S.edit; if (!ed || !ed.bar) return;
    const r = ed.td.getBoundingClientRect(), b = ed.bar.getBoundingClientRect();
    let top = r.bottom + 6; if (top + b.height > innerHeight - 8) top = r.top - b.height - 6;
    ed.bar.style.top = top + "px"; ed.bar.style.left = Math.max(8, Math.min(innerWidth - b.width - 8, r.right - b.width)) + "px";
  }
  $("#scroll").addEventListener("scroll", placeBar, { passive: true }); addEventListener("resize", placeBar);
  async function finish(mode, move) {
    const ed = S.edit; if (!ed || ed.done) return; ed.done = true;
    const val = $("input", ed.td) ? $("input", ed.td).value : "";
    if (ed.bar) ed.bar.remove();
    S.edit = null;
    let ops = [], label = "";
    if (mode !== "cancel") {
      const a = parse(val);
      if (a == null) { toast("не похоже на сумму — пример: 45 000, 45к, -3000"); }
      else if (mode === "fill") {
        keys().filter((k) => k >= ed.key).forEach((k) => (ops = ops.concat(cellOps(ed.r.spec, k, a))));
        label = a ? `${fmtRub(a)} — ${MS[+ed.key.slice(5) - 1]}–дек` : `очищено ${MS[+ed.key.slice(5) - 1]}–дек`;
      } else { ops = cellOps(ed.r.spec, ed.key, a); label = `${ed.r.label}, ${MS[+ed.key.slice(5) - 1]}: ${a ? fmtRub(a) : "пусто"}`; }
    }
    if (ops.length) await doOps(label, ops); else { S.pending = false; render(); }
    if (S.pending) { S.pending = false; render(); }
    // переход к следующей ячейке (Tab, стрелки, нажатие на другую ячейку)
    let target = null;
    if (move && move.next) { const tr = move.next.closest("tr.item"); target = tr && $(`tr.item[data-r="${tr.dataset.r}"] td[data-k="${move.next.dataset.k}"]`); }
    else if (move && move.dx) { const ks = keys(), i = ks.indexOf(ed.key) + move.dx; if (i >= 0 && i < 12) target = $(`tr.item[data-r="${ed.ri}"] td[data-k="${ks[i]}"]`); }
    else if (move && move.dy) { let ri = ed.ri + move.dy; while (ri >= 0 && ri < S.rows.length && !(S.rows[ri].type === "row" && S.rows[ri].spec)) ri += move.dy; target = $(`tr.item[data-r="${ri}"] td[data-k="${ed.key}"]`); }
    if (target && target.classList.contains("ed")) startEdit(target);
  }
  $("#sheet").addEventListener("click", (e) => {
    const td = e.target.closest("td.ed, td.ro"); if (td && td.dataset.k && !td.classList.contains("editing")) { startEdit(td); return; }
    const lb = e.target.closest("[data-lbl]"); if (lb) { rowMenu(S.rows[+lb.dataset.lbl]); return; }
    const add = e.target.closest("[data-add]"); if (add) addFlow(add.dataset.add);
  });

  /* ---------- окна ---------- */
  function modal(html) {
    const m = document.createElement("div"); m.className = "modal"; m.innerHTML = `<div class="card" role="dialog" aria-modal="true">${html}</div>`;
    $("#modals").appendChild(m); m.addEventListener("click", (e) => { if (e.target === m) closeM(m); });
    return m;
  }
  function closeM(m) { if (!m.isConnected) return; const f = m._close; m._close = null; m.remove(); if (f) f(); }
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") { const m = $$("#modals .modal").pop(); if (m) closeM(m); } });
  function promptBox(title, { value = "", placeholder = "", ok = "Готово", sub = "" } = {}) {
    return new Promise((res) => {
      const m = modal(`<h2>${esc(title)}</h2>${sub ? `<p>${esc(sub)}</p>` : ""}<input class="field" value="${esc(value)}" placeholder="${esc(placeholder)}" /><div class="actions"><button class="btn btn--solid" data-y>${esc(ok)}</button><button class="btn" data-n>Отмена</button></div>`);
      m._close = () => res(null); const inp = $("input", m); setTimeout(() => inp.focus(), 30);
      const y = () => { m._close = null; m.remove(); res(inp.value.trim() || null); };
      $("[data-y]", m).onclick = y; inp.onkeydown = (e) => { if (e.key === "Enter") y(); }; $("[data-n]", m).onclick = () => closeM(m);
    });
  }
  function choose(title, opts, sub) {
    return new Promise((res) => {
      const m = modal(`<h2>${esc(title)}</h2>${sub ? `<p>${esc(sub)}</p>` : ""}<div class="opts">${opts.map((o, i) => `<button class="opt" data-i="${i}" ${o.disabled ? "disabled style=opacity:.45" : ""}><span>${esc(o.label)}</span>${o.sub ? `<small>${esc(o.sub)}</small>` : ""}</button>`).join("")}</div><div class="actions"><button class="btn" data-n>Отмена</button></div>`);
      m._close = () => res(null);
      $$("[data-i]", m).forEach((b) => (b.onclick = () => { m._close = null; m.remove(); res(opts[+b.dataset.i].value); }));
      $("[data-n]", m).onclick = () => closeM(m);
    });
  }
  function confirmBox(title, sub, ok, danger) {
    return new Promise((res) => {
      const m = modal(`<h2>${esc(title)}</h2>${sub ? `<p>${esc(sub)}</p>` : ""}<div class="actions"><button class="btn ${danger ? "btn--danger" : "btn--solid"}" data-y>${esc(ok || "Да")}</button><button class="btn" data-n>Отмена</button></div>`);
      m._close = () => res(false);
      $("[data-y]", m).onclick = () => { m._close = null; m.remove(); res(true); }; $("[data-n]", m).onclick = () => closeM(m);
    });
  }

  /* ---------- сообщение с «Отменить» (5 секунд) ---------- */
  function toast(text, onUndo) {
    const el = $("#toast"); el.innerHTML = `<span>${esc(text)}</span>${onUndo ? `<button>Отменить</button>` : ""}`; el.classList.toggle("has-undo", !!onUndo); el.hidden = false;
    if (onUndo) $("button", el).onclick = () => { el.hidden = true; onUndo(); };
    clearTimeout(el._t); el._t = setTimeout(() => (el.hidden = true), onUndo ? 5000 : 3500);
  }

  /* ---------- добавление строк: сначала имя, запись создаётся только с ним ---------- */
  async function addFlow(act) {
    const p = S.pid ? projById(S.pid) : null;
    if (act === "project") {
      const name = await promptBox("новый проект", { placeholder: "название" }); if (!name) return;
      const r = await safe(() => DB.ins("projects", { name, status: "progress", archived: false })); S.projects.push(r); render(); toast(`проект «${name}» добавлен`);
    } else if (act === "person") {
      const pool = S.employees.filter((e) => e.active !== false && !(p && S.members.some((m) => m.project_id === p.id && m.employee_id === e.id))).sort(byName);
      let eid = p ? await choose("кого добавить в проект", [{ label: "+ новый человек", value: "new" }, ...pool.map((e) => ({ label: fullName(e), sub: projectsOfPerson(e.id).map((x) => x.name).join(", "), value: e.id }))]) : "new";
      if (!eid) return;
      if (eid === "new") {
        const name = await promptBox("новый человек", { placeholder: "Имя Фамилия" }); if (!name) return;
        const w = name.split(/\s+/);
        const r = await safe(() => DB.ins("employees", { first_name: w[0], last_name: w.slice(1).join(" "), active: true })); S.employees.push(r); eid = r.id;
      }
      let pid = p && p.id;
      if (!pid) { const list = visibleProjects().filter((x) => !x.archived); pid = await choose("в какой проект", list.map((x) => ({ label: x.name, value: x.id })), "зарплата всегда относится к проекту"); }
      if (pid) await addMember(pid, eid);
      render(); toast("человек добавлен — впишите сумму в нужный месяц");
    } else if (act === "expense") {
      const title = await promptBox("новый расход", { placeholder: p ? "сервер, реклама, техника…" : "офис, бухгалтер, банк…" }); if (!title) return;
      let pid = p ? p.id : await choose("к чему относится", [{ label: "общие расходы организации", value: "org" }, ...visibleProjects().filter((x) => !x.archived).map((x) => ({ label: x.name, value: x.id }))]);
      if (!pid) return;
      S.drafts.push({ project_id: pid === "org" ? null : pid, title }); render(); toast("строка добавлена — впишите сумму");
    }
  }
  async function addMember(pid, eid) {
    if (S.members.some((m) => m.project_id === pid && m.employee_id === eid)) return;
    const row = { project_id: pid, employee_id: eid, org_id: S.org.id };
    await safe(() => DB.memberAdd(row)); S.members.push(row);
  }

  /* ---------- меню строки (нажатие на название) ---------- */
  async function rowMenu(r) {
    if (!r) return;
    if (r.open) { go(r.open); return; }
    if (r.person) {
      const emp = empById(r.person), inProj = S.pid;
      const act = await choose(fullName(emp), [{ label: "переименовать", value: "rename" },
        ...(inProj ? [{ label: "убрать из проекта", sub: "суммы остаются, строка исчезнет, когда их не будет", value: "unlink" }] : [{ label: "добавить в проект", value: "link" }]),
        { label: emp.active === false ? "вернуть из архива" : "в архив", value: "arch" }]);
      if (act === "rename") { const n = await promptBox("имя", { value: fullName(emp) }); if (!n) return; const w = n.split(/\s+/); Object.assign(emp, { first_name: w[0], last_name: w.slice(1).join(" ") }); await safe(() => DB.upd("employees", emp.id, { first_name: emp.first_name, last_name: emp.last_name })); render(); }
      if (act === "link") { const list = visibleProjects().filter((x) => !x.archived && !S.members.some((m) => m.project_id === x.id && m.employee_id === emp.id)); const pid = await choose("в какой проект", list.map((x) => ({ label: x.name, value: x.id }))); if (pid) { await addMember(pid, emp.id); render(); } }
      if (act === "unlink") { await safe(() => DB.memberDel(S.pid, emp.id)); S.members = S.members.filter((m) => !(m.project_id === S.pid && m.employee_id === emp.id)); render(); toast("убран из проекта"); }
      if (act === "arch") { const to = emp.active === false; emp.active = to; await safe(() => DB.upd("employees", emp.id, { active: to })); render(); toast(to ? "возвращён" : "в архиве — суммы сохранены, вернуть: настройки → архив"); }
      return;
    }
    if (r.line) {
      const l = r.line, kind = l.project_id ? "expense" : "org_expense";
      const all = S.entries.filter((e) => e.kind === kind && (e.project_id || null) === l.project_id && titleOf(e) === l.title);
      const act = await choose(l.title, [{ label: "переименовать", value: "rename" }, { label: "удалить строку", sub: all.length ? `и все её суммы (${all.length})` : "", value: "del" }]);
      if (act === "rename") {
        const n = await promptBox("название расхода", { value: l.title }); if (!n || n === l.title) return;
        for (const e of all) { e.title = n; await safe(() => DB.upd("entries", e.id, { title: n })); }
        S.drafts.forEach((d) => { if (d.project_id === l.project_id && d.title === l.title) d.title = n; }); render();
      }
      if (act === "del") {
        S.drafts = S.drafts.filter((d) => !(d.project_id === l.project_id && d.title === l.title));
        if (!all.length) return render();
        if (!(await confirmBox(`Удалить «${l.title}»?`, `удалятся все суммы этой строки за все годы (${all.length}). можно отменить сразу после удаления`, "Удалить", true))) return;
        await doOps(`строка «${l.title}» удалена`, all.map((e) => ({ t: "del", row: e })));
      }
    }
  }

  /* ---------- настройки: название, налог с месяца, архив, журнал, выгрузка, выход ---------- */
  async function settings() {
    const hist = taxHistory();
    const archP = S.projects.filter((p) => p.archived).sort((a, b) => (a.name || "").localeCompare(b.name || "", "ru"));
    const archE = S.employees.filter((e) => e.active === false).sort(byName);
    const used = (kind, id) => S.entries.some((e) => (kind === "p" ? e.project_id === id : e.employee_id === id));
    const months = []; for (let y = +S.year - 1; y <= +S.year + 1; y++) for (let i = 1; i <= 12; i++) months.push(`${y}-${pad(i)}`);
    const m = modal(`<h2>настройки</h2>
      <h3>организация</h3><input class="field" id="s-name" value="${esc(S.org.name || "")}" placeholder="название" />
      <h3>налог от дохода</h3>
      <div class="list">${(hist.length ? hist : [{ from: "2000-01", rate: S.org.tax_rate ?? 7 }]).map((h) => `<div class="li"><span class="grow">${h.from <= "2000-01" ? "с самого начала" : "с " + MS_GEN[+h.from.slice(5) - 1] + " " + h.from.slice(0, 4)}</span><b>${pctStr(Number(h.rate))}</b></div>`).join("")}</div>
      <div class="row2"><select class="select" id="s-from">${months.map((k) => `<option value="${k}" ${k === TODAY ? "selected" : ""}>с ${MS_GEN[+k.slice(5) - 1]} ${k.slice(0, 4)}</option>`).join("")}</select><input class="field" id="s-rate" inputmode="decimal" placeholder="ставка, %" /></div>
      <button class="btn" id="s-tax">Применить ставку с этого месяца</button>
      <p>прошлые месяцы не пересчитываются — ставка действует с выбранного месяца и дальше</p>
      <h3>архив</h3>
      <div class="list">${archP.map((p) => `<div class="li"><span class="grow">${esc(p.name)} <small style="color:var(--muted)">проект</small></span><button class="chip" data-back-p="${p.id}">вернуть</button>${used("p", p.id) ? "" : `<button class="chip del" data-del-p="${p.id}">удалить</button>`}</div>`).join("")}
        ${archE.map((e) => `<div class="li"><span class="grow">${esc(fullName(e))} <small style="color:var(--muted)">человек</small></span><button class="chip" data-back-e="${e.id}">вернуть</button>${used("e", e.id) ? "" : `<button class="chip del" data-del-e="${e.id}">удалить</button>`}</div>`).join("") || `<div class="li"><span class="grow" style="color:var(--muted)">пусто</span></div>`}</div>
      ${archP.length + archE.length ? `<p>удалить навсегда можно только то, у чего нет сумм — иначе исказятся прошлые месяцы</p>` : ""}
      <h3>журнал изменений</h3><div class="list log" id="s-log"><div class="li">загружаю…</div></div>
      <h3>выгрузка</h3><button class="btn" id="s-csv">Скачать таблицу ${S.year} для Excel (CSV)</button>
      <h3>аккаунт</h3><div class="li"><span class="grow">${esc((S.user && S.user.email) || "")}</span><button class="chip" id="s-out">Выйти</button></div>
      <div class="actions"><button class="btn btn--solid" data-n>Закрыть</button></div>`);
    m._close = () => render();
    $("[data-n]", m).onclick = () => closeM(m);
    $("#s-name", m).onchange = async (e) => { S.org.name = e.target.value.trim(); await safe(() => DB.org({ name: S.org.name })); toast("сохранено"); };
    $("#s-tax", m).onclick = async () => {
      const from = $("#s-from", m).value, rate = Number(String($("#s-rate", m).value).replace(",", ".").replace("%", ""));
      if (!Number.isFinite(rate) || rate < 0 || rate > 100 || $("#s-rate", m).value.trim() === "") return toast("ставка от 0 до 100");
      const base = hist.length ? hist : [{ from: "2000-01", rate: Number(S.org.tax_rate ?? 7) }];
      const next = base.filter((h) => h.from !== from).concat({ from, rate }).sort((a, b) => a.from.localeCompare(b.from));
      const prev = S.org.tax_history; S.org.tax_history = next;
      await safe(() => DB.org({ tax_history: next }));
      closeM(m); toast(`налог ${pctStr(rate)} с ${MS_GEN[+from.slice(5) - 1]} ${from.slice(0, 4)}`, async () => { S.org.tax_history = prev; await safe(() => DB.org({ tax_history: prev })); render(); });
    };
    const reopen = () => { m._close = null; m.remove(); settings(); };
    $$("[data-back-p]", m).forEach((b) => (b.onclick = async () => { const p = projById(b.dataset.backP); p.archived = false; await safe(() => DB.upd("projects", p.id, { archived: false })); toast("проект возвращён"); reopen(); }));
    $$("[data-back-e]", m).forEach((b) => (b.onclick = async () => { const e = empById(b.dataset.backE); e.active = true; await safe(() => DB.upd("employees", e.id, { active: true })); toast("человек возвращён"); reopen(); }));
    $$("[data-del-p]", m).forEach((b) => (b.onclick = async () => { const p = projById(b.dataset.delP); if (!(await confirmBox(`Удалить «${p.name}» навсегда?`, "сумм у проекта нет, вернуть будет нельзя", "Удалить", true))) return; await safe(() => DB.del("projects", p.id)); S.projects = S.projects.filter((x) => x.id !== p.id); S.members = S.members.filter((x) => x.project_id !== p.id); reopen(); }));
    $$("[data-del-e]", m).forEach((b) => (b.onclick = async () => { const e = empById(b.dataset.delE); if (!(await confirmBox(`Удалить «${fullName(e)}» навсегда?`, "выплат у человека нет, вернуть будет нельзя", "Удалить", true))) return; await safe(() => DB.del("employees", e.id)); S.employees = S.employees.filter((x) => x.id !== e.id); S.members = S.members.filter((x) => x.employee_id !== e.id); reopen(); }));
    $("#s-csv", m).onclick = exportCsv;
    $("#s-out", m).onclick = async () => { if (await confirmBox("Выйти из аккаунта?")) { if (sb) await sb.auth.signOut(); location.reload(); } };
    loadLog($("#s-log", m));
  }
  async function loadLog(box) {
    try {
      const rows = await DB.log();
      if (!rows.length) { box.innerHTML = `<div class="li"><span class="grow" style="color:var(--muted)">пока пусто</span></div>`; return; }
      const what = (e) => { if (!e) return ""; const p = projById(e.project_id), who = e.employee_id ? fullName(empById(e.employee_id) || {}) : ""; const t = e.kind === "income" ? "доход" : e.kind === "salary" ? who : titleOf(e); return `${t}${p ? " · " + p.name : e.kind === "org_expense" ? " · общие" : ""}, ${MS[+e.date.slice(5, 7) - 1]} ${e.date.slice(0, 4)}`; };
      box.innerHTML = rows.map((r) => { const d = new Date(r.at), e = r.new || r.old; const ch = r.action === "insert" ? `+ ${fmtRub(r.new.amount_minor)}` : r.action === "delete" ? `удалено ${fmtRub(r.old.amount_minor)}` : r.old.amount_minor !== r.new.amount_minor ? `${fmtRub(r.old.amount_minor)} → ${fmtRub(r.new.amount_minor)}` : "переименовано";
        return `<div class="li"><span class="when">${pad(d.getDate())}.${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}</span><span class="grow">${esc(what(e))} — ${esc(ch)}</span><span class="when">${esc((r.actor_email || "система").split("@")[0])}</span></div>`; }).join("");
    } catch (e) { box.innerHTML = `<div class="li">журнал недоступен: ${esc(e.message)}</div>`; }
  }
  function exportCsv() {
    const ks = keys(), cell = (v) => (v ? (v / 100).toFixed(2).replace(".", ",") : "");
    const lines = [["", ...MS, "итого"].join(";")];
    S.rows.forEach((r) => {
      if (r.type === "sec") lines.push(r.label.toUpperCase());
      else if (r.type === "row" || r.type === "sum" || r.type === "profit") lines.push([`"${(r.label + (r.tag ? " · " + r.tag : "")).replace(/"/g, '""')}"`, ...r.values.map(cell), cell(r.values.reduce((s, v) => s + v, 0))].join(";"));
      else if (r.type === "pct") lines.push(["маржа %", ...r.values.map((v) => (v == null ? "" : String(v).replace(".", ","))), r.total == null ? "" : String(r.total).replace(".", ",")].join(";"));
    });
    const p = S.pid ? projById(S.pid) : null;
    const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `sheetaet-${p ? (p.name || "проект").replace(/[\\/:*?"<>|]/g, "") + "-" : ""}${S.year}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  /* ---------- адреса: ?p=<проект>&y=<год>; «назад» — туда, откуда пришли ---------- */
  function readUrl() { const u = new URLSearchParams(location.search); S.pid = u.get("p"); const y = u.get("y"); if (/^\d{4}$/.test(y || "")) S.year = y; }
  function urlFor(pid) { const u = new URLSearchParams(); if (DEMO) u.set("demo", "1"); if (SLUG !== "sut-media-lite") u.set("org", SLUG); if (pid) u.set("p", pid); if (S.year !== String(now.getFullYear())) u.set("y", S.year); const s = u.toString(); return location.pathname + (s ? "?" + s : ""); }
  function go(pid, replace) { if (S.edit) finish("cancel"); history[replace ? "replaceState" : "pushState"]({ fromMain: !S.pid && !!pid }, "", urlFor(pid)); S.pid = pid || null; $("#scroll").scrollTo(0, 0); render(); }
  addEventListener("popstate", () => { readUrl(); render(); });
  $("#back").onclick = () => (history.state && history.state.fromMain ? history.back() : go(null));
  $$("[data-y]").forEach((b) => (b.onclick = () => { if (S.edit) finish("cancel"); S.year = String(+S.year + +b.dataset.y); history.replaceState(history.state, "", urlFor(S.pid)); render(); }));
  $("#q").addEventListener("input", (e) => { S.q = e.target.value; applySearch(); });
  $("#settings-btn").onclick = settings;
  $("#arch-btn").onclick = async () => {
    const p = projById(S.pid); if (!p) return; const to = !p.archived;
    if (to && !(await confirmBox(`«${p.name}» в архив?`, "проект пропадёт из таблицы следующих лет, все суммы сохранятся. вернуть — в настройках", "В архив"))) return;
    p.archived = to; await safe(() => DB.upd("projects", p.id, { archived: to }));
    toast(to ? "проект в архиве" : "проект возвращён", async () => { p.archived = !to; await safe(() => DB.upd("projects", p.id, { archived: !to })); render(); });
    render();
  };
  const t = $("#title");
  t.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); t.blur(); } });
  t.addEventListener("blur", async () => { const p = projById(S.pid); if (!p || t.contentEditable !== "true") return; const n = t.textContent.trim(); if (!n) { t.textContent = p.name; return; } if (n !== p.name) { p.name = n; await safe(() => DB.upd("projects", p.id, { name: n })); toast("название сохранено"); } });

  /* ---------- реальное время: правки второго участника приходят сами ---------- */
  let rt = null, rtTimer = null;
  function realtime() {
    if (rt || DEMO) return;
    const upsert = (arr, row) => { const i = arr.findIndex((x) => x.id === row.id); if (i >= 0) arr[i] = row; else arr.push(row); };
    const on = (table, key) => (pl) => {
      const arr = S[key];
      if (pl.eventType === "DELETE") S[key] = arr.filter((x) => x.id !== (pl.old || {}).id); else upsert(arr, pl.new);
      clearTimeout(rtTimer); rtTimer = setTimeout(render, 250);
    };
    rt = sb.channel("lite-" + S.org.id)
      .on("postgres_changes", { event: "*", schema: "public", table: "entries", filter: `org_id=eq.${S.org.id}` }, on("entries", "entries"))
      .on("postgres_changes", { event: "*", schema: "public", table: "projects", filter: `org_id=eq.${S.org.id}` }, on("projects", "projects"))
      .on("postgres_changes", { event: "*", schema: "public", table: "employees", filter: `org_id=eq.${S.org.id}` }, on("employees", "employees"))
      .subscribe();
  }
  // вернулись на вкладку — подтянуть всё (на случай, если соединение засыпало)
  document.addEventListener("visibilitychange", async () => { if (document.visibilityState === "visible" && S.org && !S.edit && !DEMO) { try { await loadAll(); render(); } catch (e) {} } });

  /* ---------- вход ---------- */
  function lmsg(t, err) { const el = $("#l-msg"); el.textContent = t || ""; el.classList.toggle("is-error", !!err); }
  $("#login-form").addEventListener("submit", async (e) => {
    e.preventDefault(); lmsg("…");
    const { data, error } = await sb.auth.signInWithPassword({ email: $("#l-email").value.trim(), password: $("#l-pass").value });
    if (error) return lmsg(/Invalid login/i.test(error.message) ? "неверный e-mail или пароль" : error.message, true);
    $("#l-pass").value = ""; S.user = data.user; start();
  });
  $("#l-forgot").onclick = async () => { const email = $("#l-email").value.trim(); if (!email) return lmsg("введите e-mail", true); const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.href }); lmsg(error ? error.message : "письмо для сброса пароля отправлено", !!error); };
  async function start() {
    try { await loadAll(); } catch (e) { $("#app").hidden = true; $("#login").hidden = false; lmsg(e.message, true); return; }
    $("#login").hidden = true; $("#app").hidden = false; readUrl(); render(); realtime();
  }
  (async () => {
    readUrl();
    if (DEMO) return start();
    const { data } = await sb.auth.getSession();
    if (data.session) { S.user = data.session.user; start(); } else { $("#login").hidden = false; }
  })();
})();
