(function (global) {
  'use strict';

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function render(container, ctx) {
    let moduleId = '';
    let kind = 'choice';
    let idx = 0;
    let answered = false;
    let selected = null;

    function items() { return global.AgriQuestions.byKind(ctx, kind, moduleId); }

    function draw() {
      const list = items();
      if (!list.length) {
        container.innerHTML = '<h2 class="section-title">客观题练习</h2><div class="empty">该模块暂无此类题目</div>';
        bindHeader();
        return;
      }
      if (idx >= list.length) idx = 0;
      const it = list[idx];
      const q = ctx.notes.questions.find(x => x.id === it.sourceQuestionId);
      const tag = global.AgriTag.inferTag(q || { id: it.sourceQuestionId, moduleId: it.moduleId });

      let body = '';
      if (it.kind === 'choice') {
        body = it.options.map((o, i) => {
          let cls = 'option';
          if (answered) {
            if (i === it.answerIndex) cls += ' correct';
            else if (i === selected) cls += ' wrong';
          } else if (i === selected) cls += ' selected';
          return '<button class="' + cls + '" data-opt="' + i + '">' + String.fromCharCode(65 + i) + '. ' + esc(o) + '</button>';
        }).join('');
      } else if (it.kind === 'trueFalse') {
        body = [
          { v: true, t: '✅ 正确' },
          { v: false, t: '❌ 错误' }
        ].map(o => {
          let cls = 'option';
          if (answered) {
            if (o.v === it.answer) cls += ' correct';
            else if (o.v === selected) cls += ' wrong';
          } else if (o.v === selected) cls += ' selected';
          return '<button class="' + cls + '" data-tf="' + o.v + '">' + o.t + '</button>';
        }).join('');
      } else {
        body = '<input id="blank-input" class="option" placeholder="请输入答案" ' + (answered ? 'disabled value="' + esc(it.answer) + '"' : '') + '>';
      }

      const feedback = answered
        ? '<div class="feedback ' + (isCorrect(it) ? 'ok' : 'no') + '">' +
          (isCorrect(it) ? '回答正确！' : '正确答案：' + esc(it.answer != null ? it.answer : (it.options ? it.options[it.answerIndex] : '—'))) +
          '</div>'
        : '';

      container.innerHTML =
        '<h2 class="section-title">客观题练习</h2>' +
        headerHtml() +
        '<p class="section-sub">' + global.AgriQuestions.label(it.kind) + ' · 第 ' + (idx + 1) + ' / ' + list.length + ' 题</p>' +
        '<div class="card">' +
        '<span class="tag">' + esc(tag.name) + '</span>' +
        '<div class="q-stem" style="margin-top:8px">' + esc(it.prompt) + '</div>' +
        body + feedback +
        '<div class="src-note">出处：第 ' + it.srcRef.questionId + ' 题 · 段落 ' + it.srcRef.para + '</div>' +
        '</div>' +
        (answered ? '<div class="btn-row"><button class="btn" id="next-q">下一题</button></div>'
          : '<div class="btn-row"><button class="btn" id="submit">提交答案</button></div>');

      container.querySelectorAll('[data-opt]').forEach(b => b.addEventListener('click', () => {
        if (answered) return;
        selected = Number(b.getAttribute('data-opt')); draw();
      }));
      container.querySelectorAll('[data-tf]').forEach(b => b.addEventListener('click', () => {
        if (answered) return;
        selected = b.getAttribute('data-tf') === 'true'; draw();
      }));
      const submit = container.querySelector('#submit');
      if (submit) submit.addEventListener('click', () => {
        if (it.kind === 'fillBlank') {
          const v = container.querySelector('#blank-input').value.trim();
          if (!v) { ctx.toast('请先填写答案'); return; }
          selected = v;
        } else if (selected === null) { ctx.toast('请先选择答案'); return; }
        check(it);
      });
      const next = container.querySelector('#next-q');
      if (next) next.addEventListener('click', () => { idx++; answered = false; selected = null; draw(); });
      bindHeader();
    }

    function isCorrect(it) {
      if (it.kind === 'fillBlank') return (it.accept || [it.answer]).indexOf(String(selected).trim()) >= 0;
      return selected === (it.kind === 'choice' ? it.answerIndex : it.answer);
    }

    function check(it) {
      answered = true;
      if (isCorrect(it)) ctx.toast('答对了');
      else { ctx.toast('答错了，已加入错题本'); global.AgriState.addWrong(it.sourceQuestionId); }
      draw();
    }

    function headerHtml() {
      const mods = '<select id="module-select" class="option" style="margin:0 0 10px">' +
        '<option value="">全部模块</option>' +
        ctx.notes.modules.map(m => '<option value="' + m.id + '"' + (moduleId === m.id ? ' selected' : '') + '>' + esc(m.name) + '</option>').join('') +
        '</select>';
      const tabs = ['choice', 'trueFalse', 'fillBlank'].map(k =>
        '<div class="subtab ' + (kind === k ? 'active' : '') + '" data-kind="' + k + '">' + global.AgriQuestions.label(k) + '</div>'
      ).join('');
      return mods + '<div class="subtabs">' + tabs + '</div><div id="order-link" class="src-note" style="cursor:pointer;text-align:right">切换到排序题 →</div>';
    }

    function bindHeader() {
      const sel = container.querySelector('#module-select');
      if (sel) sel.addEventListener('change', () => { moduleId = sel.value; idx = 0; answered = false; selected = null; draw(); });
      container.querySelectorAll('[data-kind]').forEach(el => el.addEventListener('click', () => {
        kind = el.getAttribute('data-kind'); idx = 0; answered = false; selected = null; draw();
      }));
      const link = container.querySelector('#order-link');
      if (link) link.addEventListener('click', () => { if (ctx.showOrder) ctx.showOrder(); });
    }

    draw();
  }

  global.AgriPractice = { render };
})(window);
