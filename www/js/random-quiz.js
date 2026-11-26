(function (global) {
  'use strict';

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function shuffled(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function render(container, ctx) {
    const bank = ctx.bank;
    let phase = 'setup';
    let items = [];
    let idx = 0;
    let answers = {};
    let revealed = false;
    let nextTimer = null;
    let startedAt = 0;

    function clearTimer() {
      if (nextTimer) { clearTimeout(nextTimer); nextTimer = null; }
    }

    function pickItems() {
      const pool = (bank && bank.objective ? bank.objective : []).filter(q =>
        q.options && q.options.length === 4 && q.answerIndex >= 0 && q.answerIndex < 4
      );
      return shuffled(pool).slice(0, 15);
    }

    function setup() {
      clearTimer();
      const meta = bank ? bank.meta : { total: 0, theory: 0, practical: 0, choice: 0, trueFalse: 0 };
      container.innerHTML =
        '<h2 class="section-title">随机15题</h2>' +
        '<div class="card quick-card">' +
        '<div class="quick-title">⚡ 每天一组，碎片时间也能练</div>' +
        '<p class="src-note" style="margin-top:6px">从 ' + meta.theory + ' 道理论题中随机抽 15 道 · 单选 ' + meta.choice + ' 道 / 判断 ' + meta.trueFalse + ' 道</p>' +
        '<p class="src-note">答对自动进入下一题，答错显示正确答案并自动进错题本。</p>' +
        '<div class="btn-row"><button class="btn" id="start-random">开始抽题</button>' +
        '<button class="btn ghost" id="browse-practical">浏览实操 ' + meta.practical + ' 题</button></div>' +
        '</div>' +
        '<div class="card"><div class="q-stem">题库已完整收录</div>' +
        '<div class="src-note">理论 ' + meta.theory + ' 题 · 实操 ' + meta.practical + ' 题 · 共 ' + meta.total + ' 题。全部离线可用。</div></div>' +
        '<div class="btn-row"><button class="btn ghost small" id="back-home">返回首页</button></div>';

      container.querySelector('#start-random').addEventListener('click', startQuiz);
      container.querySelector('#browse-practical').addEventListener('click', () => { phase = 'practical'; draw(); });
      container.querySelector('#back-home').addEventListener('click', () => ctx.showView('modules'));
    }

    function startQuiz() {
      items = pickItems();
      if (!items.length) { ctx.toast('题库为空'); return; }
      idx = 0;
      answers = {};
      revealed = false;
      startedAt = Date.now();
      phase = 'quiz';
      draw();
    }

    function currentCorrect() {
      return revealed && answers[items[idx].id] === items[idx].answerIndex;
    }

    function goNext() {
      clearTimer();
      if (idx >= items.length - 1) return finishQuiz();
      idx++;
      answers = answers || {};
      revealed = false;
      draw();
    }

    function draw() {
      if (phase === 'setup') return setup();
      if (phase === 'result') return result();
      if (phase === 'practical') return practical();

      const it = items[idx];
      const chosen = answers[it.id];
      const correct = currentCorrect();
      const wrong = revealed && !correct;
      const tagName = it.kind === 'choice' ? '单选题' : '判断题';

      const options = it.options.map((o, i) => {
        let cls = 'option';
        if (revealed && i === it.answerIndex) cls += ' correct';
        if (revealed && chosen === i && i !== it.answerIndex) cls += ' wrong';
        return '<button class="' + cls + '" data-opt="' + i + '"' + (revealed ? ' disabled' : '') + '>' +
          (it.kind === 'choice' ? String.fromCharCode(65 + i) + '. ' : '') + esc(o) + '</button>';
      }).join('');

      const feedback = revealed
        ? '<div class="feedback ' + (correct ? 'ok' : 'no') + '">' +
          (correct ? '回答正确！' + (idx < items.length - 1 ? '即将进入下一题…' : '本题为最后一题') : '正确答案：' + esc(it.options[it.answerIndex])) +
          '</div>'
        : '';

      container.innerHTML =
        '<h2 class="section-title">随机15题</h2>' +
        '<p class="section-sub">第 ' + (idx + 1) + ' / ' + items.length + ' 题 · ' + esc(tagName) + '</p>' +
        '<div class="progress"><div style="width:' + Math.round(((idx + 1) / items.length) * 100) + '%"></div></div>' +
        '<div class="card"><span class="tag">' + esc(tagName) + '</span>' +
        (it.pointCode ? '<span class="tag">' + esc(it.pointCode) + '</span>' : '') +
        '<div class="q-stem" style="margin-top:8px">' + esc(it.prompt) + '</div>' +
        options + feedback + '</div>' +
        '<div class="btn-row">' +
        (revealed && wrong ? '<button class="btn" id="next-random">' + (idx === items.length - 1 ? '查看成绩' : '下一题') + '</button>' : '') +
        '<button class="btn ghost" id="quit-random">结束本组</button>' +
        '</div>';

      container.querySelectorAll('[data-opt]').forEach(btn => btn.addEventListener('click', () => {
        if (revealed) return;
        answers[it.id] = Number(btn.getAttribute('data-opt'));
        revealed = true;
        if (answers[it.id] === it.answerIndex) {
          ctx.toast('答对了');
          clearTimer();
          nextTimer = setTimeout(goNext, 1100);
        } else {
          ctx.toast('答错了，已加入错题本');
          global.AgriState.addWrong(it.id);
        }
        draw();
      }));
      const next = container.querySelector('#next-random');
      if (next) next.addEventListener('click', goNext);
      const quit = container.querySelector('#quit-random');
      if (quit) quit.addEventListener('click', () => { clearTimer(); finishQuiz(); });
    }

    function finishQuiz() {
      if (!items.length) return;
      const correct = items.filter(it => answers[it.id] === it.answerIndex).length;
      items.forEach(it => {
        if (answers[it.id] !== it.answerIndex) global.AgriState.addWrong(it.id);
      });
      global.AgriState.addExam({
        date: new Date().toLocaleString('zh-CN'),
        score: Math.round((correct / items.length) * 100),
        total: 100,
        correct,
        count: items.length,
        source: 'random15'
      });
      phase = 'result';
      draw();
    }

    function result() {
      const correct = items.filter(it => answers[it.id] === it.answerIndex).length;
      const seconds = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
      const wrongItems = items.filter(it => answers[it.id] !== it.answerIndex);
      container.innerHTML =
        '<h2 class="section-title">本组成绩</h2>' +
        '<div class="card"><div class="q-stem" style="font-size:28px;text-align:center">' + correct + ' / ' + items.length + '</div>' +
        '<p class="src-note" style="text-align:center">正确率 ' + Math.round((correct / items.length) * 100) + '% · 用时 ' + seconds + ' 秒</p></div>' +
        (wrongItems.length
          ? '<div class="card"><div class="q-stem">本组错题</div>' + wrongItems.map(it =>
              '<div class="src-note" style="margin-bottom:6px">' + esc(it.prompt.slice(0, 42)) + '… · 正确答案：' + esc(it.options[it.answerIndex]) + '</div>'
            ).join('') + '</div>'
          : '<div class="card"><div class="q-stem">全对！继续保持 👏</div></div>') +
        '<div class="btn-row"><button class="btn" id="again-random">再来一组</button>' +
        '<button class="btn ghost" id="to-wrong-random">查看错题本</button>' +
        '<button class="btn ghost" id="home-random">返回首页</button></div>';
      container.querySelector('#again-random').addEventListener('click', startQuiz);
      container.querySelector('#to-wrong-random').addEventListener('click', () => ctx.showView('wrong'));
      container.querySelector('#home-random').addEventListener('click', () => ctx.showView('modules'));
    }

    function practical() {
      const list = bank && bank.practical ? bank.practical : [];
      container.innerHTML =
        '<h2 class="section-title">实操题库 · 48 题</h2>' +
        '<p class="section-sub">与速记卡对应 · 点击展开参考答案</p>' +
        list.map(q =>
          '<div class="card"><span class="tag">' + esc(q.type) + '</span>' +
          (q.pointCode ? '<span class="tag">' + esc(q.pointCode) + '</span>' : '') +
          '<div class="q-stem" style="margin-top:8px">' + esc(q.stem) + '</div>' +
          '<details><summary style="cursor:pointer;color:var(--primary)">查看参考答案</summary>' +
          '<div class="answer-text">' + esc(q.answer).replace(/\n/g, '<br>') + '</div></details></div>'
        ).join('') +
        '<div class="btn-row"><button class="btn ghost" id="practical-back">返回</button></div>';
      container.querySelector('#practical-back').addEventListener('click', () => { phase = 'setup'; draw(); });
    }

    setup();
  }

  global.AgriRandom = { render };
})(window);
