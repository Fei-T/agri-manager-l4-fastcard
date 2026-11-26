(function (global) {
  'use strict';

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function render(container, ctx) {
    let moduleId = '';
    let idx = 0;
    let order = [];
    let picked = null;
    let answered = false;
    let autoTimer = null;

    function goNext() { idx++; startItem(); draw(); }

    function list() { return global.AgriQuestions.byKind(ctx, 'order', moduleId); }

    function correctOrder(it) {
      return it.steps.map((_, i) => i).sort((a, b) => it.answerOrder[a] - it.answerOrder[b]);
    }

    function startItem() {
      const l = list();
      const it = l[idx] || null;
      order = it ? it.steps.map((_, i) => i) : [];
      picked = null;
      answered = false;
    }

    function draw() {
      if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; }
      const l = list();
      if (!l.length) {
        container.innerHTML = '<h2 class="section-title">实操排序题</h2><div class="empty">该模块暂无排序题</div>' + header();
        bindHeader(); return;
      }
      if (idx >= l.length) idx = 0;
      const it = l[idx];
      if (!order.length) startItem();
      const q = ctx.notes.questions.find(x => x.id === it.sourceQuestionId);
      const tag = global.AgriTag.inferTag(q || { id: it.sourceQuestionId, moduleId: it.moduleId });

      const stepsHtml = order.map((stepIdx, pos) => {
        const cls = 'step-item' + (picked === pos ? ' selected' : '');
        return '<div class="' + cls + '" data-pos="' + pos + '"><span class="idx">' + (pos + 1) + '</span>' + esc(it.steps[stepIdx]) + '</div>';
      }).join('');

      const fb = answered
        ? '<div class="feedback ' + (isCorrect(it) ? 'ok' : 'no') + '">' +
          (isCorrect(it) ? '顺序正确！即将进入下一题…' : '正确顺序：<br>' + correctOrder(it).map((s, i) => (i + 1) + '. ' + esc(it.steps[s])).join('<br>')) +
          '</div>'
        : '';

      container.innerHTML =
        '<h2 class="section-title">实操排序题</h2>' + header() +
        '<p class="section-sub">第 ' + (idx + 1) + ' / ' + l.length + ' 题 · 点击两项交换顺序</p>' +
        '<div class="card"><span class="tag">' + esc(tag.name) + '</span>' +
        '<div class="q-stem" style="margin-top:8px">' + esc(it.prompt) + '</div>' +
        stepsHtml + fb +
        '<div class="src-note">出处：第 ' + it.srcRef.questionId + ' 题</div></div>' +
        (answered ? '<div class="btn-row"><button class="btn" id="next">下一题</button></div>'
          : '<div class="btn-row"><button class="btn" id="submit">提交排序</button>' +
            '<button class="btn ghost" id="reset">重置</button></div>');

      container.querySelectorAll('[data-pos]').forEach(el => el.addEventListener('click', () => {
        if (answered) return;
        const pos = Number(el.getAttribute('data-pos'));
        if (picked === null) { picked = pos; draw(); return; }
        if (picked === pos) { picked = null; draw(); return; }
        const tmp = order[picked]; order[picked] = order[pos]; order[pos] = tmp;
        picked = null; draw();
      }));
      const submit = container.querySelector('#submit');
      if (submit) submit.addEventListener('click', () => {
        answered = true;
        if (isCorrect(it)) {
          ctx.toast('排序正确');
          draw();
          if (idx < l.length - 1) autoTimer = setTimeout(goNext, 1100);
          else autoTimer = setTimeout(() => { ctx.toast('本组排序题已完成！'); goNext(); }, 1400);
        } else {
          ctx.toast('排序错误，已加入错题本');
          global.AgriState.addWrong(it.sourceQuestionId);
          draw();
        }
      });
      const reset = container.querySelector('#reset');
      if (reset) reset.addEventListener('click', () => { startItem(); draw(); });
      const next = container.querySelector('#next');
      if (next) next.addEventListener('click', goNext);
      bindHeader();
    }

    function isCorrect(it) { return order.join(',') === correctOrder(it).join(','); }

    function header() {
      return '<select id="order-module" class="option" style="margin:0 0 10px"><option value="">全部模块</option>' +
        (ctx ? ctx.notes.modules.map(m => '<option value="' + m.id + '"' + (moduleId === m.id ? ' selected' : '') + '>' + esc(m.name) + '</option>').join('') : '') +
        '</select><div id="back-objective" class="src-note" style="cursor:pointer;text-align:right">← 返回客观题</div>';
    }

    function bindHeader() {
      const sel = container.querySelector('#order-module');
      if (sel) sel.addEventListener('change', () => { if (autoTimer) clearTimeout(autoTimer); moduleId = sel.value; idx = 0; startItem(); draw(); });
      const back = container.querySelector('#back-objective');
      if (back) back.addEventListener('click', () => { if (autoTimer) clearTimeout(autoTimer); if (ctx.showObjective) ctx.showObjective(); });
    }

    startItem();
    draw();
  }

  global.AgriOrderQuiz = { render };
})(window);
