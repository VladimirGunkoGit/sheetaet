/* Перетаскивание (мышь + сенсор) — скопировано из Gunco (app.js, makeSortable). */
(function () {
  "use strict";
  /* ---------- Перетаскивание (мышь + сенсор), анимация расталкивания (FLIP 0.2s) ----------
     Сенсор: удержание 1с берёт элемент; мышь: хватание с порогом 5px. Перетаскиваемый элемент
     поднимается (position:fixed), на его месте — плейсхолдер-зазор; соседи разъезжаются через FLIP. */
  const DRAG = { active: false };
  // Эффективный zoom предков (на десктопе html{zoom:1.25}) — иначе position:fixed из-за zoom «улетает».
  function dndZoom(el) { let z = 1; for (let n = el; n; n = n.parentElement) { const v = getComputedStyle(n).zoom; const f = v && v !== "normal" ? parseFloat(v) : 1; if (f && !isNaN(f)) z *= f; } return z || 1; }
  function makeSortable(root, opts) {
    if (!root) return;
    const itemSel = opts.itemSelector;
    const contSel = opts.containerSelector || null;   // null → root — единственный контейнер
    const axis = opts.axis || "y";                    // 'y' | 'wrap'
    const colSel = opts.columnSelector || null;       // для кросс-колоночного (канбан)
    let st = null;

    const containersOf = () => (contSel ? [...root.querySelectorAll(contSel)].filter((c) => c.getClientRects().length) : [root]);   // скрытые (пустые) колонки — не цели сброса
    const colOf = (cont) => (colSel ? cont.closest(colSel) || cont : cont);

    root.addEventListener("pointerdown", (e) => {
      if (e.button != null && e.button > 0) return;
      if (st) return;
      if (opts.ignore && e.target.closest(opts.ignore)) return;
      const item = e.target.closest(itemSel);
      if (!item || !root.contains(item)) return;
      const container = contSel ? item.closest(contSel) : root;
      if (!container) return;
      st = { item, container, pointerId: e.pointerId, pointerType: e.pointerType, startX: e.clientX, startY: e.clientY, dragging: false, holdTimer: null, placeholder: null };
      if (e.pointerType === "touch" || e.pointerType === "pen") st.holdTimer = setTimeout(() => { if (st && !st.dragging) beginDrag(st.startX, st.startY); }, 500);
      window.addEventListener("pointermove", onMove, { passive: false });
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onCancel);
      document.addEventListener("keydown", onKey, true);
    });

    function onKey(e) { if (e.key === "Escape" && st && st.dragging) { e.preventDefault(); onCancel(); } }

    function onMove(e) {
      if (!st || st.dropping || e.pointerId !== st.pointerId) return;
      const dx = e.clientX - st.startX, dy = e.clientY - st.startY;
      if (!st.dragging) {
        const dist = Math.hypot(dx, dy);
        if (st.pointerType === "mouse") { if (dist > 5) beginDrag(e.clientX, e.clientY); }
        else if (dist > 10 && st.holdTimer) { detach(); return; }   // сдвиг до удержания = скролл/свайп
        if (!st || !st.dragging) return;
      }
      e.preventDefault();
      moveDrag(e.clientX, e.clientY);
    }

    function beginDrag(x, y) {
      if (!st || st.dragging) return;
      if (st.holdTimer) { clearTimeout(st.holdTimer); st.holdTimer = null; }
      st.dragging = true; DRAG.active = true; document.body.classList.add("dnd-active");
      st.blockTouch = (ev) => ev.preventDefault();
      window.addEventListener("touchmove", st.blockTouch, { passive: false });
      const item = st.item, r = item.getBoundingClientRect();
      const z = st.zoom = dndZoom(item.parentElement);
      st.grabDX = st.startX - r.left; st.grabDY = st.startY - r.top;
      const ph = document.createElement(item.tagName);
      ph.className = "dnd-ph"; ph.style.width = (r.width / z) + "px"; ph.style.height = (r.height / z) + "px";
      item.parentNode.insertBefore(ph, item);
      st.placeholder = ph; st.origContainer = st.container;
      st.origIndex = [...st.container.children].filter((c) => c !== item && c.matches(itemSel)).indexOf(ph); // фиктивно; для отмены пересчитаем
      st.origRef = item.nextSibling;
      Object.assign(item.style, { position: "fixed", margin: "0", width: (r.width / z) + "px", height: (r.height / z) + "px", left: (r.left / z) + "px", top: (r.top / z) + "px", zIndex: "2000", pointerEvents: "none" });
      item.classList.add("dnd-dragging");
      st.lastCont = st.container;
      moveDrag(x, y);
    }

    function moveDrag(x, y) {
      const item = st.item, z = st.zoom;
      item.style.left = ((x - st.grabDX) / z) + "px";
      item.style.top = ((y - st.grabDY) / z) + "px";
      let cont = st.container;
      if (contSel) {
        const conts = containersOf();
        let inside = null, nearest = null, nd = Infinity;
        for (const c of conts) {
          const cr = colOf(c).getBoundingClientRect();
          if (x >= cr.left && x <= cr.right) { inside = c; break; }
          const d = x < cr.left ? cr.left - x : x - cr.right;
          if (d < nd) { nd = d; nearest = c; }
        }
        cont = inside || nearest || st.container;
      }
      placePlaceholder(cont, insertIndex(cont, x, y));
      st.lastCont = cont;
    }

    function insertIndex(cont, x, y) {
      const items = [...cont.children].filter((c) => c !== st.item && c !== st.placeholder && c.matches(itemSel));
      for (let i = 0; i < items.length; i++) {
        const r = items[i].getBoundingClientRect();
        if (axis === "y") { if (y < r.top + r.height / 2) return i; }
        else { if (y < r.top) return i; if (y < r.bottom && x < r.left + r.width / 2) return i; }
      }
      return items.length;
    }

    function placePlaceholder(cont, idx) {
      const ph = st.placeholder;
      const items = [...cont.children].filter((c) => c !== st.item && c !== ph && c.matches(itemSel));
      const ref = items[idx] || null;
      if (ph.parentNode === cont && ph.nextSibling === ref) return;
      const affected = new Set([...cont.children]); if (ph.parentNode) [...ph.parentNode.children].forEach((c) => affected.add(c));
      const rects = new Map(); affected.forEach((el) => { if (el !== st.item && el !== ph) rects.set(el, el.getBoundingClientRect()); });
      cont.insertBefore(ph, ref);
      rects.forEach((first, el) => {
        if (!el.isConnected) return;
        const last = el.getBoundingClientRect(); const z = st.zoom; const ddx = (first.left - last.left) / z, ddy = (first.top - last.top) / z;
        if (ddx || ddy) { el.style.transition = "none"; el.style.transform = `translate(${ddx}px,${ddy}px)`; el.getBoundingClientRect(); el.style.transition = "transform .2s ease"; el.style.transform = ""; }
      });
    }

    function onUp(e) { if (!st || st.dropping || e.pointerId !== st.pointerId) return; if (!st.dragging) { detach(); return; } finishDrop(false); }
    function onCancel(e) { if (!st || st.dropping || e.pointerId !== st.pointerId) return; if (!st.dragging) { detach(); return; } st.lastCont = st.origContainer; st.origContainer.insertBefore(st.placeholder, st.origRef); finishDrop(true); }

    function finishDrop(cancelled) {
      st.dropping = true;
      const item = st.item, ph = st.placeholder, cont = st.lastCont, orig = st.origContainer;
      // погасить клик, который иначе откроет карточку/выберет статус после drag
      const kill = (ev) => { ev.stopPropagation(); ev.preventDefault(); };
      document.addEventListener("click", kill, true); setTimeout(() => document.removeEventListener("click", kill, true), 350);
      const pr = ph.getBoundingClientRect(), z = st.zoom;
      item.style.transition = "left .2s ease, top .2s ease";
      item.style.left = (pr.left / z) + "px"; item.style.top = (pr.top / z) + "px";
      setTimeout(() => {
        cont.insertBefore(item, ph); ph.remove();
        item.classList.remove("dnd-dragging");
        ["position", "margin", "width", "height", "left", "top", "zIndex", "pointerEvents", "transition", "transform"].forEach((k) => (item.style[k] = ""));
        const items = [...cont.children].filter((c) => c.matches(itemSel));
        const detail = { item, itemId: item.dataset.id || item.dataset.k, fromContainer: orig, toContainer: cont, newIndex: items.indexOf(item), orderedIds: items.map((x) => x.dataset.id || x.dataset.k) };
        endGesture();
        if (!cancelled && opts.onDrop) opts.onDrop(detail);
      }, 205);
    }

    function endGesture() { detach(); document.body.classList.remove("dnd-active"); DRAG.active = false; if (opts.onEnd) opts.onEnd(); }
    function detach() {
      if (st && st.holdTimer) clearTimeout(st.holdTimer);
      if (st && st.blockTouch) window.removeEventListener("touchmove", st.blockTouch);
      window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); window.removeEventListener("pointercancel", onCancel); document.removeEventListener("keydown", onKey, true);
      st = null;
    }
  }

  window.makeSortable = makeSortable;
})();
