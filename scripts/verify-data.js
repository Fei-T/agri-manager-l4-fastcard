'use strict';

const fs = require('fs');
const path = require('path');

const DATA = path.resolve(__dirname, '..', 'www', 'data');
const notes = JSON.parse(fs.readFileSync(path.join(DATA, 'notes.json'), 'utf8'));
const questions = JSON.parse(fs.readFileSync(path.join(DATA, 'questions.json'), 'utf8'));
const bank = JSON.parse(fs.readFileSync(path.join(DATA, 'bank.json'), 'utf8'));
const manifest = JSON.parse(fs.readFileSync(path.join(DATA, 'manifest.json'), 'utf8'));

const errors = [];
const check = (cond, msg) => { if (!cond) errors.push(msg); };

check(notes.modules.length === 12, `模块数应为 12，实际 ${notes.modules.length}`);
check(notes.questions.length === 48, `题数应为 48，实际 ${notes.questions.length}`);
notes.modules.forEach(m => {
  check(m.questionIds.length === 4, `模块 ${m.id} 应有 4 题，实际 ${m.questionIds.length}`);
});

const caseCount = notes.questions.filter(q => q.type === 'case').length;
check(caseCount === 12, `案例题应为 12，实际 ${caseCount}`);
notes.questions.filter(q => q.type !== 'case').forEach(q => {
  check(q.points.length >= 2, `第 ${q.id} 题分点不足 2（${q.points.length}）`);
});

const counts = questions.counts;
check(counts.fillBlank >= 36, `填空题不足：${counts.fillBlank}`);
check(counts.choice >= 36, `选择题不足：${counts.choice}`);
check(counts.trueFalse >= 36, `判断题不足：${counts.trueFalse}`);
check(counts.order >= 24, `排序题不足：${counts.order}`);

const ids = new Set(notes.questions.map(q => q.id));
let missingRef = 0;
questions.items.forEach(it => {
  check(it.srcRef && ids.has(it.srcRef.questionId), `题目 ${it.id} 的 srcRef 无效`);
  if (!it.srcRef || !ids.has(it.srcRef.questionId)) missingRef++;
  if (it.kind === 'choice') {
    check(it.options.length === 4, `选择题 ${it.id} 选项数不是 4`);
    check(it.answerIndex >= 0 && it.answerIndex < 4, `选择题 ${it.id} 答案索引越界`);
  }
  if (it.kind === 'order') {
    const arr = it.answerOrder;
    const ok = Array.isArray(arr) && arr.length === it.steps.length && arr.every((v, i) => Number.isInteger(v) && v >= 0 && v < arr.length) && new Set(arr).size === arr.length;
    check(ok, `排序题 ${it.id} 的 answerOrder 不是合法排列`);
  }
});
check(missingRef === 0, `共有 ${missingRef} 道题缺少有效出处`);

check(manifest.checks && manifest.checks.pass === true, 'manifest.checks.pass 不为 true');
check(manifest.counts.questions === 48, 'manifest 题数不一致');

check(bank.objective.length === 1206, `理论题应为 1206，实际 ${bank.objective.length}`);
check(bank.practical.length === 48, `实操题应为 48，实际 ${bank.practical.length}`);
check(new Set(bank.objective.map(q => q.id)).size === bank.objective.length, '理论题 ID 有重复');
check(new Set(bank.practical.map(q => q.id)).size === bank.practical.length, '实操题 ID 有重复');
bank.objective.forEach(q => {
  const expectedOptions = q.kind === 'choice' ? 4 : 2;
  check(!!q.prompt, `理论题 ${q.id} 题干为空`);
  check(q.options.length === expectedOptions, `理论题 ${q.id} 选项数应为 ${expectedOptions}`);
  check(q.answerIndex >= 0 && q.answerIndex < expectedOptions, `理论题 ${q.id} 答案索引越界`);
});
bank.practical.forEach(q => {
  check(!!q.stem && !!q.answer, `实操题 ${q.id} 题干或答案缺失`);
});
check(manifest.counts.bankTotal === bank.meta.total, 'manifest 题库总数不一致');
check(bank.repairs.length === 3, `源表答案修正数应为 3，实际 ${bank.repairs.length}`);

if (errors.length) {
  console.error('[verify-data] 校验失败：');
  errors.slice(0, 30).forEach(e => console.error(' - ' + e));
  process.exit(1);
}

console.log('[verify-data] 全部校验通过：12 模块 / 48 题 / 派生题', JSON.stringify(counts));
console.log('[verify-data] 新题库校验通过：', JSON.stringify(bank.meta));
