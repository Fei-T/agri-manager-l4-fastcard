(function (global) {
  'use strict';

  const views = ['modules', 'cards', 'review', 'practice', 'exam', 'wrong'];
  let data = null;
  let current = 'modules';
  let practiceMode = 'objective';

  function $(id) { return document.getElementById(id); }

  function toast(msg) {
    const el = $('toast');
    el.textContent = msg;
    el.classList.remove('hidden');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => el.classList.add('hidden'), 1800);
  }

  function showView(name) {
    if (views.indexOf(name) < 0) return;
    current = name;
    views.forEach(v => $('view-' + v).classList.toggle('hidden', v !== name));
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.getAttribute('data-view') === name));
    renderCurrent();
  }

  function renderCurrent() {
    if (!data) return;
    const box = $('view-' + current);
    const ctx = makeCtx();
    if (current === 'modules') global.AgriNotes.renderModules(box, ctx);
    else if (current === 'cards') global.AgriNotes.renderCards(box, ctx, ctxState.module || '');
    else if (current === 'review') global.AgriReview.render(box, ctx);
    else if (current === 'practice') {
      if (practiceMode === 'order') global.AgriOrderQuiz.render(box, ctx);
      else global.AgriPractice.render(box, ctx);
    } else if (current === 'exam') global.AgriExam.render(box, ctx);
    else if (current === 'wrong') global.AgriWrongBook.render(box, ctx);
  }

  function makeCtx() {
    return {
      notes: data.notes,
      questions: data.questions,
      manifest: data.manifest,
      toast,
      showView,
      showCards(moduleId) {
        ctxState.module = moduleId;
        showView('cards');
      },
      showOrder() { practiceMode = 'order'; showView('practice'); },
      showObjective() { practiceMode = 'objective'; showView('practice'); }
    };
  }

  const ctxState = { module: '' };

  function applyTheme() {
    const t = global.AgriState.theme();
    document.body.classList.toggle('dark', t === 'dark');
    $('theme-btn').textContent = t === 'dark' ? '☀️' : '🌙';
  }

  function init() {
    applyTheme();
    $('theme-btn').addEventListener('click', () => {
      const next = global.AgriState.theme() === 'dark' ? 'light' : 'dark';
      global.AgriState.setTheme(next);
      applyTheme();
    });
    document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => showView(t.getAttribute('data-view'))));

    global.AgriData.load().then(d => {
      data = d;
      const c = d.manifest.counts;
      $('app-subtitle').textContent = c.modules + ' 模块 · ' + c.questions + ' 题 · 离线学习';
      const allIds = d.notes.questions.map(q => q.id);
      global.AgriSRS.ensureToday(allIds);
      showView('modules');
    }).catch(err => {
      $('app').innerHTML = '<div class="empty">数据加载失败：' + String(err && err.message || err) + '</div>';
    });

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && current === 'review' && data) renderCurrent();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(window);
