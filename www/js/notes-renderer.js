(function (global) {
  'use strict';

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function pointsHtml(q) {
    if (q.case) {
      const secs = q.case.answerSections.map(sec =>
        '<div class="case-section"><div class="point-key">' + esc(sec.title) + '</div><ul class="point-list">' +
        sec.items.map(it => '<li><span class="point-key">' + esc(it.key) + '</span>：' + esc(it.value || it.text) + '</li>').join('') +
        '</ul></div>'
      ).join('');
      const subs = q.case.subQuestions.map((s, i) => '<li>' + (i + 1) + '. ' + esc(s.text) + '</li>').join('');
      return '<div class="q-stem">案例：' + esc(q.stem) + '</div><ul class="point-list">' + subs + '</ul>' + secs;
    }
    return '<ul class="point-list">' + q.points.map(p =>
      '<li><span class="point-key">' + esc(p.key) + '</span>：' + esc(p.value || p.text) + '</li>'
    ).join('') + '</ul>';
  }

  function renderModules(container, ctx) {
    const notes = ctx.notes;
    const stats = global.AgriSRS.stats(notes.questions.map(q => q.id));
    container.innerHTML =
      '<h2 class="section-title">12 个模块</h2>' +
      '<p class="section-sub">全部 48 题已收录 · 点击模块查看速记卡 · 飞行模式也能用</p>' +
      '<div class="card"><div class="q-stem">今日复习进度</div>' +
      '<div class="progress"><div style="width:' + Math.round((stats.dist[5] / 48) * 100) + '%"></div></div>' +
      '<div class="src-note">已掌握 ' + stats.mastered + ' / 48 · 今日待复习 ' + stats.due + ' 张</div></div>' +
      '<div class="module-grid">' + notes.modules.map(m =>
        '<div class="card module-card tappable" data-module="' + m.id + '">' +
        '<div class="num">模块 ' + String(m.index).padStart(2, '0') + '</div>' +
        '<h3>' + esc(m.name) + '</h3>' +
        '<p>题 ' + m.questionIds[0] + '–' + m.questionIds[m.questionIds.length - 1] + ' · 4 张卡</p>' +
        '</div>'
      ).join('') + '</div>';

    container.querySelectorAll('[data-module]').forEach(el => {
      el.addEventListener('click', () => ctx.showCards(el.getAttribute('data-module')));
    });
  }

  function renderCards(container, ctx, moduleId) {
    const notes = ctx.notes;
    const questions = moduleId
      ? notes.questions.filter(q => q.moduleId === moduleId)
      : notes.questions;
    const label = moduleId ? (global.AgriTag.inferTag({ moduleId }).name) : '全部卡片';
    let idx = 0;

    function draw() {
      const q = questions[idx];
      const tag = global.AgriTag.inferTag(q);
      const fav = global.AgriState.isFavorite(q.id);
      container.innerHTML =
        '<h2 class="section-title">' + esc(label) + '</h2>' +
        '<p class="section-sub">第 ' + (idx + 1) + ' / ' + questions.length + ' 张 · 点击卡片翻面</p>' +
        '<div class="card flashcard" id="flashcard">' +
        '<div class="front"><span class="tag">' + esc(tag.name) + '</span><div style="margin-top:10px">' + esc(q.stem) + '</div><div class="hint">点击翻面看答案</div></div>' +
        '<div class="back">' + pointsHtml(q) + '<div class="src-note">原文段落 ' + q.srcParaRange[0] + '–' + q.srcParaRange[1] + '</div></div>' +
        '</div>' +
        '<div class="btn-row">' +
        '<button class="btn ghost" id="prev">上一张</button>' +
        '<button class="btn ghost" id="fav">' + (fav ? '★ 已收藏' : '☆ 收藏') + '</button>' +
        '<button class="btn" id="next">下一张</button>' +
        '</div>' +
        '<div class="btn-row">' +
        '<button class="btn ghost small" id="back-modules">返回模块</button>' +
        '</div>';

      const card = container.querySelector('#flashcard');
      card.addEventListener('click', () => card.classList.toggle('flipped'));
      container.querySelector('#prev').addEventListener('click', () => { idx = (idx - 1 + questions.length) % questions.length; draw(); });
      container.querySelector('#next').addEventListener('click', () => { idx = (idx + 1) % questions.length; draw(); });
      container.querySelector('#fav').addEventListener('click', () => {
        const now = global.AgriState.toggleFavorite(q.id);
        ctx.toast(now ? '已加入收藏' : '已取消收藏');
        draw();
      });
      container.querySelector('#back-modules').addEventListener('click', () => ctx.showView('modules'));
    }

    draw();
  }

  global.AgriNotes = { renderModules, renderCards };
})(window);
