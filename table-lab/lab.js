/* sheetaet · тестовая сводная таблица за год. Читает те же данные, что и приложение (вход — общий), ничего не меняет. */
(function () {
  "use strict";
  const C = window.SheetCore, CFG = window.SHEETAET_CONFIG || {};
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const K = { income: "134,217,152", salary: "231,200,106", expense: "232,155,184", tax: "126,196,232", profit: "178,150,232", fixed: "232,120,120" };
  const SLUG = "sut-media";
  const DEMO = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && new URLSearchParams(location.search).has("demo");
  const store = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } };

  const ST = { year: C.todayStr().slice(0, 4), units: store("lab_units") || "rub", dens: store("lab_dens") || "comfy", folded: new Set(JSON.parse(store("lab_folded") || "[]")), data: null };

  /* ---------- данные ---------- */
  async function load() {
    if (DEMO) { const d = JSON.parse(store("sheetaet_demo_v1") || "null"); if (!d) throw new Error("откройте демо приложения хотя бы раз: /sut-media/?demo=1"); return d; }
    const sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true, storageKey: "sheetaet-auth" } });
    const { data } = await sb.auth.getSession();
    if (!data.session) throw new Error("нужен вход: откройте приложение, войдите и вернитесь на эту страницу");
    const q = async (p) => { const { data, error } = await p; if (error) throw new Error(error.message); return data; };
    const org = await q(sb.from("orgs").select("*").eq("slug", SLUG).maybeSingle());
    if (!org) throw new Error("нет доступа к организации");
    const [projects, employees, entries] = await Promise.all([
      q(sb.from("projects").select("*").eq("org_id", org.id)), q(sb.from("employees").select("*").eq("org_id", org.id)), q(sb.from("entries").select("*").eq("org_id", org.id)),
    ]);
    return { org, projects, employees, entries };
  }

  /* ---------- строки таблицы ---------- */
  const sum = (l) => l.reduce((s, e) => s + e.amount_minor, 0);
  const byName = (a, b) => (a.last_name || a.first_name || "").localeCompare(b.last_name || b.first_name || "", "ru") || (a.first_name || "").localeCompare(b.first_name || "", "ru");
  const fullName = (e) => C.fullName(e) || "без имени";
  function build(d) {
    const year = ST.year, ms = C.monthsOfYear(year), from = year + "-01-01", to = +year + 1 + "-01-01";
    const inYear = (e) => e.date >= from && e.date < to;
    const org = C.orgYear(d.projects, d.entries, year, d.org);
    const withData = new Set(d.entries.filter((e) => e.project_id && inYear(e)).map((e) => e.project_id));
    const projs = d.projects.filter((p) => !p.archived || withData.has(p.id)).sort((a, b) => (a.name || "").localeCompare(b.name || "", "ru"));
    const paid = new Set(d.entries.filter((e) => e.kind === "salary" && inYear(e)).map((e) => e.employee_id));
    const people = d.employees.filter((e) => e.active !== false || paid.has(e.id)).sort(byName);
    const fx = d.entries.filter((e) => e.kind === "org_expense" && inYear(e));
    const titles = [...new Set(fx.map((e) => (e.title || "расход").trim()))].sort((a, b) => a.localeCompare(b, "ru"));
    const pv = (p, key) => org.map((m) => { const x = m.per.find((y) => y.project.id === p.id); return x ? x[key] : 0; });
    const col = (k) => org.map((m) => m[k]);
    const row = (label, values, o) => ({ type: "row", label, values, ...(o || {}) });
    const sec = (id, k, label, values, kids) => ({ type: "sec", id, c: K[k], label, values, kids });
    const pname = (p) => `${esc(p.name || "без названия")}${p.archived ? ` <span class="arch">· архив</span>` : ""}`;
    const tax = String(C.taxRateOf(d.org)).replace(".", ",");
    const income = col("income"), taxv = col("tax"), net = col("profit");
    return [
      sec("inc", "income", "Поступления", income, projs.map((p) => row(pname(p), pv(p, "income")))),
      sec("tax", "tax", `Налог ${tax}%`, taxv, []),
      { type: "res", label: "Выручка после налогов", values: income.map((v, i) => v - taxv[i]) },
      sec("sal", "salary", "Зарплаты", col("salaries"), people.map((e) => row(esc(fullName(e)), ms.map((k) => C.employeeMonth(e.id, d.entries, k).total)))),
      sec("exp", "expense", "Расходы проектов", col("projOther"), projs.map((p) => row(pname(p), pv(p, "other")))),
      sec("fix", "fixed", "Постоянные расходы", col("fixed"), titles.map((t) => row(esc(t), ms.map((k) => sum(fx.filter((e) => (e.title || "расход").trim() === t && C.inMonth(e.date, k))))))),
      { type: "res", grand: true, label: "Чистая прибыль", values: net },
      { type: "pct", label: "Маржа", values: org.map((m) => (m.income ? C.pct(m.profit, m.income) : null)), total: (() => { const i = income.reduce((s, v) => s + v, 0); return i ? C.pct(net.reduce((s, v) => s + v, 0), i) : null; })() },
      sec("pp", "profit", "Прибыль по проектам", col("projectsProfit"), projs.map((p) => row(pname(p), pv(p, "profit")))),
    ];
  }

  /* ---------- формат ---------- */
  function money(minor) {
    if (!minor) return "";
    const grp = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, C.NNBSP);
    if (ST.units === "k") { const t = Math.round(Math.abs(minor) / 10000); if (!t) return ""; return (minor < 0 ? C.MINUS : "") + grp(Math.floor(t / 10)) + "," + (t % 10); }
    const r = Math.round(Math.abs(minor) / 100); if (!r) return "";
    return (minor < 0 ? C.MINUS : "") + grp(r);
  }
  const pctf = (v) => (v == null ? "" : String(v).replace(".", ",") + "%");

  /* ---------- отрисовка ---------- */
  function render() {
    const d = ST.data, rows = build(d), ms = C.monthsOfYear(ST.year), today = C.monthKey(C.todayStr());
    const cls = (i) => (ms[i] === today ? " is-cur" : ms[i] > today ? " is-plan" : "");
    $("#year").textContent = ST.year;
    const head = `<thead><tr><th class="l" scope="col">${ST.units === "k" ? "тыс. ₽" : "₽"}</th>${C.MONTHS_SHORT.map((m, i) => `<th class="n${cls(i)}" data-c="${i}" scope="col"><span class="m">${m}</span></th>`).join("")}<th class="n t" data-c="12" scope="col">итого</th></tr></thead>`;
    const nums = (vals, total, fmt) => vals.map((v, i) => `<td class="n${cls(i)}${v < 0 ? " neg" : ""}" data-c="${i}">${fmt(v)}</td>`).join("") + `<td class="n t${total < 0 ? " neg" : ""}" data-c="12">${fmt(total)}</td>`;
    const tot = (vals) => vals.reduce((s, v) => s + (v || 0), 0);
    let body = "";
    rows.forEach((r) => {
      if (r.type === "sec") {
        const f = ST.folded.has(r.id);
        body += `<tr class="sec${f ? " is-folded" : ""}${r.kids.length ? "" : " no-kids"}" data-sec="${r.id}" style="--c:${r.c}"><th class="l" scope="rowgroup"${r.kids.length ? ` aria-expanded="${!f}" tabindex="0"` : ""}><span class="sec-in"><svg class="chev" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3.5l3 3 3-3"/></svg><span class="dot"></span><span class="sec-name">${esc(r.label)}</span></span></th>${nums(r.values, tot(r.values), money)}</tr>`;
        r.kids.forEach((k) => { const t = tot(k.values); body += `<tr class="row${t || k.values.some(Boolean) ? "" : " is-empty"}${f ? " is-hidden" : ""}" data-of="${r.id}"><td class="l">${k.label}</td>${nums(k.values, t, money)}</tr>`; });
      } else if (r.type === "res") body += `<tr class="res${r.grand ? " grand" : ""}"><th class="l" scope="row">${esc(r.label)}</th>${nums(r.values, tot(r.values), money)}</tr>`;
      else if (r.type === "pct") body += `<tr class="pct"><td class="l">${esc(r.label)}</td>${r.values.map((v, i) => `<td class="n${cls(i)}${v < 0 ? " neg" : ""}" data-c="${i}">${pctf(v)}</td>`).join("")}<td class="n t" data-c="12">${pctf(r.total)}</td></tr>`;
    });
    $("#sheet").innerHTML = `<caption class="sr">Сводная за ${ST.year} год</caption><colgroup><col class="c-l" />${ms.map(() => `<col class="c-m" />`).join("")}<col class="c-t" /></colgroup>${head}<tbody>${body}</tbody>`;
    $("#legend").innerHTML = `<span><span class="sw" style="background:var(--cur);box-shadow:inset 0 0 0 1px var(--rule-strong)"></span>текущий месяц</span><span><i>серые цифры</i> — план: будущие месяцы</span><span><i style="color:var(--neg)">−</i> убыток</span><span>нажмите на раздел, чтобы свернуть его — итог останется</span>`;
    $$("[data-units]").forEach((b) => b.classList.toggle("is-on", b.dataset.units === ST.units));
    $$("[data-dens]").forEach((b) => b.classList.toggle("is-on", b.dataset.dens === ST.dens));
    document.documentElement.classList.toggle("dens-compact", ST.dens === "compact");
    $("#fold").textContent = ST.folded.size ? "развернуть всё" : "свернуть всё";
  }

  /* ---------- взаимодействие ---------- */
  function toggleSec(id) {
    ST.folded.has(id) ? ST.folded.delete(id) : ST.folded.add(id);
    store("lab_folded", JSON.stringify([...ST.folded]));
    const f = ST.folded.has(id), tr = $(`tr.sec[data-sec="${id}"]`);
    tr.classList.toggle("is-folded", f); $("th", tr).setAttribute("aria-expanded", String(!f));
    $$(`tr[data-of="${id}"]`).forEach((r) => r.classList.toggle("is-hidden", f));
    $("#fold").textContent = ST.folded.size ? "развернуть всё" : "свернуть всё";
  }
  const sheet = $("#sheet");
  sheet.addEventListener("click", (e) => { const tr = e.target.closest("tr.sec:not(.no-kids)"); if (tr && e.target.closest("th.l")) toggleSec(tr.dataset.sec); });
  sheet.addEventListener("keydown", (e) => { if ((e.key === "Enter" || e.key === " ") && e.target.matches("tr.sec th.l")) { e.preventDefault(); toggleSec(e.target.parentElement.dataset.sec); } });
  // перекрестие: подсвечиваем колонку под курсором (строку — CSS :hover)
  let hc = null;
  const setCol = (c) => { if (c === hc) return; if (hc != null) $$(`[data-c="${hc}"]`, sheet).forEach((x) => x.classList.remove("is-col")); hc = c; if (c != null) $$(`[data-c="${c}"]`, sheet).forEach((x) => x.classList.add("is-col")); };
  sheet.addEventListener("mouseover", (e) => { const cell = e.target.closest("[data-c]"); setCol(cell ? cell.dataset.c : null); });
  sheet.addEventListener("mouseleave", () => setCol(null));

  $$("[data-y]").forEach((b) => (b.onclick = () => { ST.year = String(+ST.year + +b.dataset.y); hc = null; render(); }));
  $$("[data-units]").forEach((b) => (b.onclick = () => { ST.units = b.dataset.units; store("lab_units", ST.units); hc = null; render(); }));
  $$("[data-dens]").forEach((b) => (b.onclick = () => { ST.dens = b.dataset.dens; store("lab_dens", ST.dens); render(); }));
  $("#fold").onclick = () => {
    const ids = $$("tr.sec:not(.no-kids)").map((t) => t.dataset.sec);
    ST.folded = ST.folded.size ? new Set() : new Set(ids); store("lab_folded", JSON.stringify([...ST.folded])); hc = null; render();
  };
  $("#theme").onclick = () => { const t = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark"; document.documentElement.setAttribute("data-theme", t); store("sheetaet_theme", t); };
  document.addEventListener("keydown", (e) => { if (e.target.closest("input")) return; if (e.key === "ArrowLeft" && e.altKey) $('[data-y="-1"]').click(); if (e.key === "ArrowRight" && e.altKey) $('[data-y="1"]').click(); });

  load().then((d) => { ST.data = d; render(); }).catch((e) => { $("#msg").hidden = false; $("#msg").innerHTML = esc(e.message) + ` · <a href="../sut-media/" style="color:inherit">открыть приложение</a>`; $("#scroll").hidden = true; });
})();
