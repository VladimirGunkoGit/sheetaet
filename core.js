/* =================================================================
   Sheetaet — core: вся денежная математика без DOM.
   Деньги — ЦЕЛЫЕ копейки. Даты — 'YYYY-MM-DD'. Месяц — 'YYYY-MM', с 1-го по 1-е.
   Форматирование и месяцы скопированы из Gunco (money-core.js).
   Браузер: window.SheetCore · Node (тесты): module.exports
   ================================================================= */
(function (root) {
  "use strict";
  const NNBSP = " ", NBSP = " ", MINUS = "−";
  const pad = (n) => String(n).padStart(2, "0");
  const TAX_RATE = 7;              // налог — всегда 7% от дохода проекта
  const DEFAULT_PROFIT_RATE = 20;  // цель — % от дохода после налогов

  /* ---------- суммы ---------- */
  function parseAmount(input) {
    if (input == null) return null;
    let s = String(input).toLowerCase().replace(/[\s   ']/g, "").replace(/₽|руб\.?|rub|р\.$/g, "");
    if (!s) return null;
    let mult = 1;
    const suf = s.match(/(тыс\.?|к|k|млн\.?|м|m)$/);
    if (suf) { mult = /^(тыс|к|k)/.test(suf[1]) ? 1000 : 1000000; s = s.slice(0, -suf[1].length); }
    s = s.replace(/^\+/, "");
    if (!/^\d[\d.,]*$/.test(s)) return null;
    let intPart = s, frac = "";
    const lc = s.lastIndexOf(","), ld = s.lastIndexOf(".");
    if (lc >= 0 && ld >= 0) { const dec = Math.max(lc, ld); intPart = s.slice(0, dec).replace(/[.,]/g, ""); frac = s.slice(dec + 1); }
    else if (lc >= 0 || ld >= 0) {
      const parts = s.split(lc >= 0 ? "," : ".");
      if (parts.length > 2) { if (!parts.slice(1).every((p) => p.length === 3)) return null; intPart = parts.join(""); }
      else { intPart = parts[0]; frac = parts[1]; }
    }
    if (!/^\d*$/.test(intPart) || !/^\d*$/.test(frac) || (!intPart && !frac)) return null;
    const minor = Number(intPart || "0") * mult * 100 + Math.round((Number(frac || "0") * mult * 100) / Math.pow(10, frac.length));
    return Number.isFinite(minor) && minor <= 9e15 ? minor : null;
  }
  const groupInt = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, NNBSP);
  function formatMoney(minor, opts) {
    opts = opts || {};
    const m = Math.round(Number(minor) || 0), a = Math.abs(m), rub = Math.floor(a / 100), kop = a % 100;
    return (m < 0 ? MINUS : opts.sign && m > 0 ? "+" : "") + groupInt(rub) + (kop ? "," + pad(kop) : "") + (opts.noCurrency ? "" : NBSP + "₽");
  }
  function formatMoneyHTML(minor, opts) {
    opts = opts || {};
    const m = Math.round(Number(minor) || 0), a = Math.abs(m), rub = Math.floor(a / 100), kop = a % 100;
    return (m < 0 ? MINUS : opts.sign && m > 0 ? "+" : "") + groupInt(rub) + (kop ? `<span class="mk">,${pad(kop)}</span>` : "") + (opts.noCurrency ? "" : NBSP + "₽");
  }
  function amountToInput(minor) {
    if (minor == null) return "";
    const rub = Math.floor(minor / 100), kop = minor % 100;
    return groupInt(rub).replace(new RegExp(NNBSP, "g"), " ") + (kop ? "," + pad(kop) : "");
  }
  const pct = (part, whole) => (whole ? Math.round((part / whole) * 1000) / 10 : 0);   // до 0,1%

  /* ---------- месяцы ---------- */
  const daysInMonth = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
  const monthKey = (d) => String(d).slice(0, 7);
  const monthStart = (key) => key + "-01";
  function addMonths(key, n) { let [y, m] = key.split("-").map(Number); m += n; while (m > 12) { m -= 12; y++; } while (m < 1) { m += 12; y--; } return `${y}-${pad(m)}`; }
  const inMonth = (d, key) => !!d && d >= monthStart(key) && d < monthStart(addMonths(key, 1));
  function dayInMonth(key, day) { const [y, m] = key.split("-").map(Number); return `${key}-${pad(Math.min(Math.max(1, day || 1), daysInMonth(y, m)))}`; }
  function todayStr(now) { const d = now || new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
  const MONTHS = ["январь","февраль","март","апрель","май","июнь","июль","август","сентябрь","октябрь","ноябрь","декабрь"];
  const MONTHS_GEN = ["января","февраля","марта","апреля","мая","июня","июля","августа","сентября","октября","ноября","декабря"];
  const MONTHS_PREP = ["январе","феврале","марте","апреле","мае","июне","июле","августе","сентябре","октябре","ноябре","декабре"];
  const MONTHS_SHORT = ["янв","фев","мар","апр","мая","июн","июл","авг","сен","окт","ноя","дек"];
  const monthLabel = (key) => { const [y, m] = key.split("-").map(Number); return `${MONTHS[m - 1]} ${y}`; };
  const monthPrep = (key) => { const [, m] = key.split("-").map(Number); return MONTHS_PREP[m - 1]; };
  const dayLabel = (d) => { const [, m, dd] = d.split("-").map(Number); return `${dd} ${MONTHS_SHORT[m - 1]}`.toUpperCase(); };
  const dayLong = (d) => { const [, m, dd] = d.split("-").map(Number); return `${dd} ${MONTHS_GEN[m - 1]}`; };
  function plural(n, one, few, many) { const a = Math.abs(n) % 100, b = a % 10; if (a > 10 && a < 20) return many; if (b > 1 && b < 5) return few; if (b === 1) return one; return many; }

  /* ---------- экономика проекта за месяц (§5) ---------- */
  // ставка налога — из настроек организации (меняется в карточке организации), по умолчанию 7%
  const taxRateOf = (org) => { const n = org && org.tax_rate != null ? Number(org.tax_rate) : TAX_RATE; return Number.isFinite(n) ? n : TAX_RATE; };
  const sum = (list) => list.reduce((s, e) => s + e.amount_minor, 0);
  // комиссия банка за выплату человеку: 2% от суммы, но не меньше 900 ₽ — с каждой выплаты отдельно
  const FEE_RATE = 2, FEE_MIN = 90000;
  const payoutFee = (minor) => (minor > 0 ? Math.max(Math.round((minor * FEE_RATE) / 100), FEE_MIN) : 0);
  const feesOf = (list) => list.filter((e) => e.kind === "salary").reduce((s, e) => s + payoutFee(e.amount_minor), 0);
  function projectMonth(project, entries, key, org) {
    const mine = entries.filter((e) => e.project_id === project.id && inMonth(e.date, key));
    const D = sum(mine.filter((e) => e.kind === "income"));
    const S = sum(mine.filter((e) => e.kind === "salary"));
    const F = feesOf(mine);   // комиссия за выплаты — расход проекта
    const O = sum(mine.filter((e) => e.kind === "expense"));
    const taxRate = taxRateOf(org);
    const T = Math.round((D * taxRate) / 100);
    const total = S + F + O + T;
    const profit = D - total;
    const rate = project.profit_rate != null ? Number(project.profit_rate) : (org && org.profit_rate != null ? Number(org.profit_rate) : DEFAULT_PROFIT_RATE);
    const target = Math.round(((D - T) * rate) / 100);
    return { income: D, salaries: S, fees: F, other: O, tax: T, taxRate, total, profit, margin: pct(profit, D), rate, target, vsTarget: profit - target };
  }
  // Организация за месяц: суммы по проектам + постоянные расходы
  function orgMonth(projects, entries, key, org) {
    const per = projects.map((p) => ({ project: p, ...projectMonth(p, entries, key, org) }));
    const fixed = sum(entries.filter((e) => e.kind === "org_expense" && inMonth(e.date, key)));
    const income = per.reduce((s, x) => s + x.income, 0);
    // зарплата без проекта (просто человеку) — в зарплатах и расходах организации, но не в прибыли проектов
    const looseSalaries = sum(entries.filter((e) => e.kind === "salary" && !e.project_id && inMonth(e.date, key)));
    const salaries = per.reduce((s, x) => s + x.salaries, 0) + looseSalaries;
    const fees = per.reduce((s, x) => s + x.fees, 0) + feesOf(entries.filter((e) => e.kind === "salary" && !e.project_id && inMonth(e.date, key)));
    const tax = per.reduce((s, x) => s + x.tax, 0);
    const projOther = per.reduce((s, x) => s + x.other, 0);
    const other = projOther + fixed;
    const expense = salaries + fees + tax + other;
    return { per, income, salaries, fees, looseSalaries, tax, projOther, fixed, other, expense, profit: income - expense, projectsProfit: per.reduce((s, x) => s + x.profit, 0) };
  }
  // Зарплата сотрудника за месяц = Σ его выплат во всех проектах
  function employeeMonth(employeeId, entries, key) {
    const list = entries.filter((e) => e.kind === "salary" && e.employee_id === employeeId && inMonth(e.date, key));
    return { total: sum(list), list };
  }
  // Сравнение с прошлым месяцем: стрелка по направлению, цвет — «хорошо/плохо»
  // kind: 'up-good' (доход, прибыль) | 'up-bad' (расходы)
  function compare(cur, prev, kind) {
    const dir = cur > prev ? "up" : cur < prev ? "down" : "flat";
    const good = dir === "flat" ? null : (dir === "up") === (kind !== "up-bad");
    const change = prev ? Math.round(((cur - prev) / Math.abs(prev)) * 100) : null;
    return { dir, tone: dir === "flat" ? "flat" : good ? "good" : "bad", change, isNew: !prev && !!cur };
  }
  // «Скопировать из прошлого месяца»: какие строки создать (без дублей)
  function copyPlan(src, existing, toKey) {
    const key = (e) => [e.kind, e.project_id || "", e.employee_id || "", (e.title || "").trim().toLowerCase(), e.amount_minor, e.date].join("|");
    const have = new Set(existing.map(key));
    const out = [];
    for (const e of src) {
      const day = Number(e.date.slice(8));
      const row = { kind: e.kind, project_id: e.project_id || null, employee_id: e.employee_id || null, title: e.title || null, amount_minor: e.amount_minor, date: dayInMonth(toKey, day) };
      if (have.has(key(row))) continue;
      have.add(key(row)); out.push(row);
    }
    return out;
  }
  /* ---------- год: 12 колонок ---------- */
  const MONTHS_COL = ["ЯНВ","ФЕВ","МАР","АПР","МАЙ","ИЮН","ИЮЛ","АВГ","СЕН","ОКТ","НОЯ","ДЕК"];
  const monthsOfYear = (year) => Array.from({ length: 12 }, (_, i) => `${year}-${pad(i + 1)}`);
  // ряд из 12 значений + итог (итог — сумма копеек, не округлённых ячеек)
  function yearRow(year, fn) { const values = monthsOfYear(year).map(fn); return { values, total: values.reduce((s, v) => s + v, 0) }; }
  // ячейка годовой таблицы: целые рубли, без «₽»; ноль — «—»
  function formatCell(minor) { const r = Math.round((Number(minor) || 0) / 100); if (!r) return "—"; return (r < 0 ? MINUS : "") + groupInt(Math.abs(r)); }
  const orgYear = (projects, entries, year, org) => monthsOfYear(year).map((k) => orgMonth(projects, entries, k, org));
  const projectYear = (project, entries, year, org) => monthsOfYear(year).map((k) => projectMonth(project, entries, k, org));

  // «Имя Фамилия» → части
  function splitName(full) { const w = String(full || "").trim().split(/\s+/).filter(Boolean); return { first_name: w[0] || "", last_name: w.slice(1).join(" ") }; }
  const fullName = (e) => [e.first_name, e.last_name].filter(Boolean).join(" ").trim();

  const api = {
    TAX_RATE, DEFAULT_PROFIT_RATE, taxRateOf, payoutFee, feesOf, NNBSP, NBSP, MINUS,
    parseAmount, formatMoney, formatMoneyHTML, amountToInput, pct,
    daysInMonth, monthKey, monthStart, addMonths, inMonth, dayInMonth, todayStr,
    MONTHS, MONTHS_GEN, MONTHS_SHORT, monthLabel, monthPrep, dayLabel, dayLong, plural,
    projectMonth, orgMonth, employeeMonth, compare, copyPlan, splitName, fullName,
    MONTHS_COL, monthsOfYear, yearRow, formatCell, orgYear, projectYear,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.SheetCore = api;
})(typeof window !== "undefined" ? window : globalThis);
