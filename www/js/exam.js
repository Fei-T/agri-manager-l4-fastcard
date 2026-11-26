(function (global) {
  'use strict';

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function shuffled(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  function correctOrder(it) {
    return it.steps.map((_, i) => i).sort((a, b) => it.answerOrder[a] - it.answerOrder[b]);
  }

  function render(container, ctx) {
    let phase = 'setup';
    let items = [];
    let answers = {};
    let idx = 0;
    let stopTimer = null;

    function buildPaper() {
      const pick = (kind, n) => shuffled(global.AgriQuestions.byKind(ctx, kind)).slice(0, n);
      return shuffled([
        ...pick('choice', 14),
        ...pick('trueFalse', 10),
        ...pick('fillBlank', 8),
        ...pick('order', 8)
      ]).slice(0, 40);
    }

    function setup() {
      container.innerHTML =
        '<h2 class="section-title">模拟考试</h2>' +
        '<div class="card"><div class="q-stem">40 题混合卷 · 90 分钟</div>' +
        '<p class="src-note">选择/判断/填空/排序混合抽题，交卷后自动评分并记录错题。</p></div>' +
        '<div class="btn-row"><button class="btn" id="start">开始考试</button>' +
        '<button class="btn ghost" id="history">查看历史成绩</button></div><div id="history-box"></div>';
      container.querySelector('#start').addEventListener('click', () => {
        items = buildPaper(); answers = {}; idx = 0; phase='exam'; draw();
      });
      container.querySelector('#history').addEventListener('click', () => {
        const h = global.AgriState.examHistory();
        container.querySelector('#history-box').innerHTML = h.length
          ? '<div class="card"><div class="q-stem">最近成绩</div>' + h.map(r =>
              '<div class="src-note">' + esc(r.date) + ' · ' + r.score + ' / ' + r.total + ' 分</div>').join('') + '</div>'
          : '<div class="empty">暂无考试记录</div>';
      });
    }

    function draw() {
      if (phase === 'setup') return setup();
      if (phase === 'result') return result();
      const it = items[idx];
      const q = ctx.notes.questions.find(x => x.id === it.sourceQuestionId);
      const tag = global.AgriTag.inferTag(q || { id: it.sourceQuestionId, moduleId: it.moduleId });
      const body = answerControl(it);

      container.innerHTML =
        '<h2 class="section-title">模拟考试</h2>' +
        '<p class="section-sub">第 ' + (idx + 1) + ' / ' + items.length + ' 题 · <span class="timer" id="timer">90:00</span></p>' +
        '<div class="progress"><div style="width:' + Math.round(((idx + 1) / items.length) * 100) + '%"></div></div>' +
        '<div class="card"><span class="tag">' + esc(tag.name) + '</span>' +
        '<div class="q-stem" style="margin-top:8px">' + esc(it.prompt) + '</div>' + body + '</div>' +
        '<div class="btn-row">' +
        '<button class="btn ghost" id="prev"' + (idx === 0 ? ' disabled' : '') + '>上一题</button>' +
        (idx === items.length - 1
          ? '<button class="btn" id="finish">交卷</button>'
          : '<button class="btn" id="next">下一题</button>') +
        '</div>';

      bindControl(it);
      const prev = container.querySelector('#prev');
      if (prev) prev.addEventListener('click', () => { idx--; draw(); });
      const next = container.querySelector('#next');
      if (next) next.addEventListener('click', () => { idx++; draw(); });
      const finish = container.querySelector('#finish');
      if (finish) finish.addEventListener('click', finishExam);
      if (!stopTimer) stopTimer = global.AgriTimer.countdown(container.querySelector('#timer'), 90 * 60, finishExam);
    }

    function answerControl(it) {
      const a = answers[it.id];
      if (it.kind === 'choice') {
        return it.options.map((o, i) => '<button class="option ' + (a === i ? 'selected' : '') + '" data-opt="' + i + '">' +
          String.fromCharCode(65 + i) + '. ' + esc(o) + '</button>').join('');
      }
      if (it.kind === 'trueFalse') {
        return [true, false].map(v => '<button class="option ' + (a === v ? 'selected' : '') + '" data-tf="' + v + '">' +
          (v ? '✅ 正确' : '❌ 错误') + '</button>').join('');
      }
      if (it.kind === 'fillBlank') {
        return '<input id="exam-blank" class="option" placeholder="请输入答案" value="' + esc(a || '') + '">';
      }
      const order = Array.isArray(a) && a.length === it.steps.length ? a : it.steps.map((_, i) => i);
      return order.map((s, pos) => '<div class="step-item" data-pos="' + pos + '"><span class="idx">' + (pos + 1) + '</span>' + esc(it.steps[s]) + '</div>').join('') +
        '<div class="src-note">点击两项交换顺序</div>';
    }

    function bindControl(it) {
      container.querySelectorAll('[data-opt]').forEach(b => b.addEventListener('click', () => { answers[it.id] = Number(b.getAttribute('data-opt')); draw(); }));
      container.querySelectorAll('[data-tf]').forEach(b => b.addEventListener('click', () => { answers[it.id] = b.getAttribute('data-tf') === 'true'; draw(); }));
      const blank = container.querySelector('#exam-blank');
      if (blank) blank.addEventListener('input', () => { answers[it.id] = blank.value; });
      if (it.kind === 'order') {
        let picked = null;
        container.querySelectorAll('[data-pos]').forEach(el => el.addEventListener('click', () => {
          const pos = Number(el.getAttribute('data-pos'));
          const arr = (answers[it.id] || it.steps.map((_, i) => i)).slice();
          if (picked === null) { picked = pos; return; }
          if (picked === pos) { picked = null; return; }
          const tmp = arr[picked]; arr[picked] = arr[pos]; arr[pos] = tmp;
          answers[it.id] = arr; picked = null; draw();
        }));
      }
    }

    function isRight(it) {
      const a = answers[it.id];
      if (it.kind === 'choice') return a === it.answerIndex;
      if (it.kind === 'trueFalse') return a === it.answer;
      if (it.kind === 'fillBlank') return String(a || '').trim() === it.answer || (it.accept || []).indexOf(String(a || '').trim()) >= 0;
      if (it.kind === 'order') return Array.isArray(a) && a.join(',') === correctOrder(it).join(',');
      return false;
    }

    function finishExam() {
      if (!items.length) return;
      if (stopTimer) { stopTimer(); stopTimer = null; }
      let score = 0;
      const wrong = [];
      items.forEach(it => {
        if (isRight(it)) score += 100 / items.length;
        else { wrong.push(it); global.AgriState.addWrong(it.sourceQuestionId); }
      });
      global.AgriState.addExam({
        date: new Date().toLocaleString('zh-CN'),
        score: Math.round(score),
        total: 100,
        correct: items.length - wrong.length,
        count: items.length
      });
      phase = 'result';
      draw();
    }

    function result() {
      const h = global.AgriState.examHistory()[0] || {};
      container.innerHTML =
        '<h2 class="section-title">考试结果</h2>' +
        '<div class="card"><div class="q-stem" style="font-size:28px;text-align:center">' + (h.score || 0) + ' 分</div>' +
        '<p class="src-note" style="text-align:center">答对 ' + (h.correct || 0) + ' / ' + (h.count || 0) + ' 题 · 错题已自动入本</p></div>' +
        '<div class="btn-row"><button class="btn" id="again">再考一次</button>' +
        '<button class="btn ghost" id="to-wrong">查看错题本</button></div>';
      container.querySelector('#again').addEventListener('click', () => { phase='setup'; setup(); });
      container.querySelector('#to-wrong').addEventListener('click', () => ctx.showView('wrong'));
    }

    setup();
  }

  global.AgriExam = { render };
})(window);
