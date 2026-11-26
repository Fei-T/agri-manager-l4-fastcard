(function (global) {
  'use strict';

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function render(container, ctx) {
    const notes = ctx.notes;
    const byId = new Map(notes.questions.map(q => [q.id, q]));
    const allIds = notes.questions.map(q => q.id);
    let ids = [];
    let idx = 0;
    let sessionDone = 0;

    function start() {
      ids = global.AgriSRS.queue(allIds);
      idx = 0;
      sessionDone = 0;
      draw();
    }

    function draw() {
      const st = global.AgriSRS.stats(allIds);
      if (!ids.length) {
        container.innerHTML =
          '<h2 class="section-title">每日复习</h2>' +
          '<div class="card"><div class="q-stem">今天没有到期的卡片 🎉</div>' +
          '<p class="src-note">记忆间隔：1 / 2 / 4 / 7 / 15 / 30 天。明天再来复习吧。</p></div>' +
          '<div class="card"><div class="q-stem">掌握度分布</div><div class="src-note">' +
          st.dist.map((n, i) => ['L' + i, n].join(':')).join(' · ') + '</div></div>' +
          '<div class="btn-row"><button class="btn" id="rebuild">重新计算队列</button>' +
          '<button class="btn ghost" id="undo">撤销上次标记</button></div>';
        bindCommon();
        return;
      }

      const q = byId.get(ids[idx]);
      const tag = global.AgriTag.inferTag(q);
      const lv = global.AgriSRS.levelOf(q.id);
      container.innerHTML =
        '<h2 class="section-title">每日复习</h2>' +
        '<p class="section-sub">到期 ' + ids.length + ' 张 · 第 ' + (idx + 1) + ' 张 · 等级 L' + lv + '</p>' +
        '<div class="progress"><div style="width:' + Math.round((idx / ids.length) * 100) + '%"></div></div>' +
        '<div class="card">' +
        '<span class="tag">' + esc(tag.name) + '</span>' +
        '<div class="q-stem" style="margin-top:8px">' + esc(q.stem) + '</div>' +
        '<details><summary style="cursor:pointer;color:var(--primary)">查看答案</summary><div style="margin-top:8px">' + answerHtml(q) + '</div></details>' +
        '</div>' +
        '<div class="btn-row">' +
        '<button class="btn" id="known">✅ 记住了</button>' +
        '<button class="btn danger" id="forgot">❌ 忘记了</button>' +
        '</div>' +
        '<div class="btn-row">' +
        '<button class="btn ghost small" id="undo">撤销上次</button>' +
        '<button class="btn ghost small" id="rebuild">重建队列</button>' +
        '</div>';

      container.querySelector('#known').addEventListener('click', () => grade(true));
      container.querySelector('#forgot').addEventListener('click', () => grade(false));
      bindCommon();
    }

    function answerHtml(q) {
      if (q.case) {
        return q.case.answerSections.map(s => '<div><strong>' + esc(s.title) + '</strong><ul class="point-list">' +
          s.items.map(i => '<li>' + esc(i.text) + '</li>').join('') + '</ul></div>').join('');
      }
      return '<ul class="point-list">' + q.points.map(p => '<li>' + esc(p.text) + '</li>').join('') + '</ul>';
    }

    function grade(known) {
      global.AgriSRS.mark(ids[idx], known);
      if (!known) global.AgriState.addWrong(ids[idx]);
      sessionDone++;
      idx++;
      if (idx >= ids.length) {
        ctx.toast('本轮复习完成，共 ' + sessionDone + ' 张');
        start();
      } else draw();
    }

    function bindCommon() {
      const undo = container.querySelector('#undo');
      if (undo) undo.addEventListener('click', () => {
        ctx.toast(global.AgriSRS.undo() ? '已撤销上次标记' : '没有可撤销的标记');
        start();
      });
      const rebuild = container.querySelector('#rebuild');
      if (rebuild) rebuild.addEventListener('click', start);
    }

    start();
  }

  global.AgriReview = { render };
})(window);
