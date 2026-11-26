(function (global) {
  'use strict';

  const NS = 'agri4:';

  function get(key, def) {
    try {
      const raw = localStorage.getItem(NS + key);
      return raw === null ? def : JSON.parse(raw);
    } catch (e) { return def; }
  }

  function set(key, value) {
    try { localStorage.setItem(NS + key, JSON.stringify(value)); } catch (e) {}
    return value;
  }

  function wrongIds() { return get('wrongIds', []); }
  function isWrong(id) { return wrongIds().indexOf(id) >= 0; }
  function addWrong(id) {
    const arr = wrongIds();
    if (arr.indexOf(id) < 0) { arr.push(id); set('wrongIds', arr); }
  }
  function removeWrong(id) {
    set('wrongIds', wrongIds().filter(x => x !== id));
  }
  function markWrongCorrect(id) {
    const key = 'wrongStreak:' + id;
    const n = get(key, 0) + 1;
    set(key, n);
    if (n >= 2) { removeWrong(id); set(key, 0); }
    return n;
  }

  function favorites() { return get('favorites', []); }
  function toggleFavorite(id) {
    const arr = favorites();
    const i = arr.indexOf(id);
    if (i >= 0) arr.splice(i, 1); else arr.push(id);
    set('favorites', arr);
    return arr.indexOf(id) >= 0;
  }
  function isFavorite(id) { return favorites().indexOf(id) >= 0; }

  function examHistory() { return get('examHistory', []); }
  function addExam(record) {
    const arr = examHistory();
    arr.unshift(record);
    set('examHistory', arr.slice(0, 20));
  }

  function theme() { return get('theme', 'light'); }
  function setTheme(v) { return set('theme', v); }

  global.AgriState = {
    NS, get, set,
    wrongIds, isWrong, addWrong, removeWrong, markWrongCorrect,
    favorites, isFavorite, toggleFavorite,
    examHistory, addExam,
    theme, setTheme
  };
})(window);
