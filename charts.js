/* =================================================================
   Sheetaet — диаграммы без библиотек (HTML + SVG), монохромный стиль Gunco.
   SheetCharts.bars(items)  — горизонтальные полосы с нулём (прибыль по проектам)
   SheetCharts.donut(segs, center) — кольцо с подписями сегментов и легендой
   ================================================================= */
(function () {
  "use strict";
  const C = () => window.SheetCore;
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  // items: [{label, emoji, value (копейки), c (RGB)}]; ноль — тонкая черта, убыток — влево, коралловый
  function bars(items) {
    if (!items.length) return `<p class="empty">нет проектов в работе</p>`;
    const maxPos = Math.max(0, ...items.map((i) => i.value)), maxNeg = Math.max(0, ...items.map((i) => -i.value));
    const span = maxPos + maxNeg || 1;
    const zero = (maxNeg / span) * 100;   // где ось нуля, %
    return `<div class="ch-bars">${items.map((i) => {
      const w = (Math.abs(i.value) / span) * 100;
      const left = i.value >= 0 ? zero : zero - w;
      const bar = i.value === 0 ? `<div class="ch-zero" style="left:${zero}%"></div>`
        : `<div class="ch-bar ${i.value < 0 ? "is-neg" : ""}" style="left:${left}%;width:${Math.max(w, 0.8)}%;--c:${i.c || "178,150,232"}"></div>`;
      return `<div class="ch-row"><span class="ch-label">${i.emoji ? `<span class="proj-emoji">${esc(i.emoji)}</span>` : ""}<span class="ch-name">${esc(i.label)}</span></span>
        <div class="ch-track">${maxNeg ? `<div class="ch-axis" style="left:${zero}%"></div>` : ""}${bar}</div>
        <span class="ch-val ${i.value < 0 ? "is-neg" : ""}">${C().formatMoneyHTML(i.value)}</span></div>`;
    }).join("")}</div>`;
  }

  // segs: [{label, emoji, value, c}] — только положительные; center: {label, value}
  function donut(segs, center) {
    const list = segs.filter((s) => s.value > 0);
    const total = list.reduce((s, x) => s + x.value, 0);
    if (!total) return `<p class="empty">нет данных за месяц</p>`;
    const R = 70, r = 46, cx = 90, cy = 90;
    let a0 = -Math.PI / 2, paths = "", labels = "";
    list.forEach((s) => {
      const frac = s.value / total, a1 = a0 + frac * Math.PI * 2;
      const large = a1 - a0 > Math.PI ? 1 : 0;
      const p = (rad, ang) => `${(cx + rad * Math.cos(ang)).toFixed(2)} ${(cy + rad * Math.sin(ang)).toFixed(2)}`;
      paths += frac >= 0.9999
        ? `<circle cx="${cx}" cy="${cy}" r="${(R + r) / 2}" fill="none" stroke="rgb(${s.c})" stroke-width="${R - r}"/>`
        : `<path d="M ${p(R, a0)} A ${R} ${R} 0 ${large} 1 ${p(R, a1)} L ${p(r, a1)} A ${r} ${r} 0 ${large} 0 ${p(r, a0)} Z" fill="rgb(${s.c})" stroke="var(--bg)" stroke-width="1.5"/>`;
      if (frac >= 0.06) { const mid = (a0 + a1) / 2, lr = (R + r) / 2; labels += `<text x="${(cx + lr * Math.cos(mid)).toFixed(1)}" y="${(cy + lr * Math.sin(mid)).toFixed(1)}" class="ch-seg-pct">${Math.round(frac * 100)}%</text>`; }
      a0 = a1;
    });
    const legend = list.slice().sort((a, b) => b.value - a.value).map((s) => `<div class="ch-leg"><span class="ch-dot" style="--c:${s.c}"></span><span class="ch-leg-name">${s.emoji ? esc(s.emoji) + " " : ""}${esc(s.label)}</span><span class="ch-leg-val">${C().formatMoneyHTML(s.value)}</span><span class="ch-leg-pct">${C().pct(s.value, total).toString().replace(".", ",")}%</span></div>`).join("");
    // подпись в центре: размер считается от длины строки в единицах viewBox, поэтому при любом масштабе
    // и ширине окна текст целиком внутри отверстия (диаметр 2r) с запасом и не касается кольца
    const val = C().formatMoney(center.value).replace(/,\d\d/, "");
    const fit = (str, em, max) => Math.min(max, (r * 2 * 0.64) / (str.length * em));
    const fsV = fit(val, 0.62, 15).toFixed(2), fsL = fit(center.label, 0.55, 8.5).toFixed(2);
    return `<div class="ch-donut"><svg viewBox="0 0 180 180" class="ch-svg" role="img" aria-label="${esc(center.label)}">${paths}${labels}
        <text x="90" y="${(90 - fsV * 0.55).toFixed(1)}" class="ch-c-label" style="font-size:${fsL}px">${esc(center.label)}</text><text x="90" y="${(90 + fsV * 0.75).toFixed(1)}" class="ch-c-val" style="font-size:${fsV}px">${esc(val)}</text></svg>
      <div class="ch-legend">${legend}</div></div>`;
  }
  window.SheetCharts = { bars, donut };
})();
