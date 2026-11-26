(function (global) {
  'use strict';

  function format(ms) {
    const s = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(s / 60);
    return String(m).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  }

  function countdown(el, seconds, onEnd) {
    const end = Date.now() + seconds * 1000;
    const tick = () => {
      const left = end - Date.now();
      if (el) el.textContent = format(left);
      if (left <= 0) { clearInterval(timer); if (onEnd) onEnd(); }
    };
    const timer = setInterval(tick, 500);
    tick();
    return () => clearInterval(timer);
  }

  global.AgriTimer = { format, countdown };
})(window);
