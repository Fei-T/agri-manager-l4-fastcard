(function (global) {
  'use strict';

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function parseId(raw) {
    return /^t\d+$/.test(raw) ? raw : Number(raw);
  }

  function render(container, ctx) {
    const byId = new Map();
    ctx.notes.questions.forEach(q => byId.set(q.id, { source: 'card', data: q }));
    if (ctx.bank && ctx.bank.objective) {
      ctx.bank.objective.forEach(q => byId.set(q.id, { source: 'bank', data: q }));
    }

    function bankAnswer(q) {
      return q.options && q.options[q.answerIndex] != null ? q.options[q.answerIndex] : '—';
    }

    function cardAnswer(q) {
      if (q.case) {
        return q.case.answerSections.map(s => '<div><strong>' + esc(s.title) + '</strong><ul class="point-list">' +
          s.items.map(i => '<li>' + esc(i.text) + '</li>').join('') + '</ul></div>').join('');
      }
      return '<ul class="point-list">' + q.points.map(p => '<li>' + esc(p.text) + '</li>').join('') + '</ul>';
    }

    function draw() {
      const ids = global.AgriState.wrongIds();
      if (!ids.length) {
        container.innerHTML = '<h2 class="section-title">错题本</h2><div class="empty">暂无错题<br>练习、随机15题或考试答错后会自动收录</div>';
        return;
      }
      container.innerHTML =
        '<h2 class="section-title">错题本</h2>' +
        '<p class="section-sub">共 ' + ids.length + ' 题 · 连对 2 次可移出</p>' +
        ids.map(id => {
          const entry = byId.get(id);
          if (!entry) return '';
          const streak = global.AgriState.get('wrongStreak:' + id, 0);
          if (entry.source === 'bank') {
            const q = entry.data;
            const type = q.kind === 'choice' ? '单选' : '判断';
            return '<div class="card"><span class="tag danger">' + esc(type) + '</span>' +
              (q.pointCode ? '<span class="tag">' + esc(q.pointCode) + '</span>' : '') +
              '<div class="q-stem" style="margin-top:8px">' + esc(q.prompt) + '</div>' +
              '<div class="src-note">正确答案：' + esc(bankAnswer(q)) + '</div>' +
              '<div class="src-note">连续答对 ' + streak + ' / 2 次</div>' +
              '<div class="btn-row">' +
              '<button class="btn small" data-got="' + esc(id) + '">✅ 已掌握</button>' +
              '<button class="btn ghost small" data-del="' + esc(id) + '">移除</button>' +
              '</div></div>';
          }
          const q = entry.data;
          const tag = global.AgriTag.inferTag(q);
          return '<div class="card"><span class="tag danger">' + esc(tag.name) + '</span>' +
            '<div class="q-stem" style="margin-top:8px">' + esc(q.stem) + '</div>' +
            '<details><summary style="cursor:pointer;color:var(--primary)">查看答案</summary><div style="margin-top:8px">' +
            cardAnswer(q) + '</div></details>' +
            '<div class="src-note">连续答对 ' + streak + ' / 2 次</div>' +
            '<div class="btn-row">' +
            '<button class="btn small" data-got="' + esc(id) + '">✅ 已掌握</button>' +
            '<button class="btn ghost small" data-card="' + esc(id) + '">查看卡片</button>' +
            '<button class="btn ghost small" data-del="' + esc(id) + '">移除</button>' +
            '</div></div>';
        }).join('');

      container.querySelectorAll('[data-got]').forEach(b => b.addEventListener('click', () => {
        const id = parseId(b.getAttribute('data-got'));
        const n = global.AgriState.markWrongCorrect(id);
        ctx.toast(n >= 2 ? '已连续答对 2 次，移出错题本' : '已记录 1 次，再答对 1 次可移出');
        draw();
      }));
      container.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => {
        global.AgriState.removeWrong(parseId(b.getAttribute('data-del')));
        ctx.toast('已移除'); draw();
      }));
      container.querySelectorAll('[data-card]').forEach(b => b.addEventListener('click', () => {
        const q = byId.get(parseId(b.getAttribute('data-card')));
        if (q && q.source === 'card') ctx.showCards(q.data.moduleId);
      }));
    }

    draw();
  }

  global.AgriWrongBook = { render };
})(window);
