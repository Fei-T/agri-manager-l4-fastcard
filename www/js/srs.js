(function (global) {
  'use strict';

  const NS = 'agri4:';
  const INTERVAL_DAYS = [1, 2, 4, 7, 15, 30];

  function today() { return Math.floor(Date.now() / 86400000); }

  function get(k, def) {
    try {
      const raw = localStorage.getItem(NS + k);
      return raw === null ? def : JSON.parse(raw);
    } catch (e) { return def; }
  }
  function set(k, v) {
    try { localStorage.setItem(NS + k, JSON.stringify(v)); } catch (e) {}
    return v;
  }

  function levelOf(id) { return get('s_' + id, 0); }
  function dueOf(id) { return get('d_' + id, 0); }
  function knownOf(id) { return get('k_' + id, false); }

  function ensureToday(allIds) {
    const t = today();
    allIds.forEach(id => {
      if (get('d_' + id, null) === null) set('d_' + id, t);
    });
    if (get('queue_date', 0) !== t) set('queue_date', t);
  }

  function queue(allIds) {
    ensureToday(allIds);
    const t = today();
    return allIds
      .filter(id => dueOf(id) <= t && !knownOf(id))
      .sort((a, b) => levelOf(a) - levelOf(b) || dueOf(a) - dueOf(b));
  }

  function mark(id, isKnown) {
    const prev = { id, level: levelOf(id), due: dueOf(id), known: knownOf(id) };
    let lv = prev.level;
    if (isKnown) {
      lv = Math.min(lv + 1, INTERVAL_DAYS.length - 1);
      if (lv === INTERVAL_DAYS.length - 1) set('k_' + id, true);
    } else {
      lv = 0;
      set('k_' + id, false);
    }
    set('s_' + id, lv);
    set('d_' + id, today() + INTERVAL_DAYS[lv]);
    set('lastMark', prev);
    return lv;
  }

  function undo() {
    const p = get('lastMark', null);
    if (!p) return false;
    set('s_' + p.id, p.level);
    set('d_' + p.id, p.due);
    set('k_' + p.id, p.known);
    set('lastMark', null);
    return true;
  }

  function stats(allIds) {
    const dist = [0, 0, 0, 0, 0, 0];
    allIds.forEach(id => { const lv = levelOf(id); if (lv >= 0 && lv <= 5) dist[lv]++; });
    return { dist, mastered: dist[5], due: queue(allIds).length, today: today() };
  }

  global.AgriSRS = { INTERVAL_DAYS, today, ensureToday, queue, mark, undo, stats, levelOf, dueOf, knownOf };
})(window);
