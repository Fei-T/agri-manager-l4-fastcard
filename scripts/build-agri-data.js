'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { readDocxParagraphs } = require('./lib/docx-zip');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'source', '农业经理人四级考试实操重点(5).docx');
const BANK_SRC = path.join(ROOT, 'source', 'question_bank.json');
const OUT_DIR = path.join(ROOT, 'www', 'data');

const MODULES = [
  '信息收集', '目标管理', '目标分解', '生产要素组织',
  '岗位设置', '会务组织', '计划控制', '质量控制',
  '成本控制', '市场控制', '内部协调与控制', '外部协调与控制'
];

const ANSWER_MARKER_RE = /^(解析[:：]|论述要点[:：]|答案要点[:：]|案例分析活动(?:及建议)?[:：]|案例分析建议[:：])/;
const QUESTION_MARKER_RE = /^问题[:：]/;
const POINT_RE = /^[（(](\d+)[）)]?\s*([\s\S]*)$/;
const NUM_POINT_RE = /^(\d+)[.．、]\s*([\s\S]*)$/;
const SECTION_RE = /^(\d+)\s*[）.)]\s*([\s\S]*)$/;

function strip(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

function splitKeyValue(text) {
  const t = strip(text);
  const m = t.match(/^([^:：]{1,24})[:：]\s*([\s\S]*)$/);
  if (m) return { key: strip(m[1]), value: strip(m[2]) || strip(m[1]) };
  return { key: t.slice(0, 12), value: t };
}

function numberedStart(text) {
  const m = String(text).match(/^(\d{1,2})\s*[.．、]\s*/);
  return m ? Number(m[1]) : 0;
}

function isPointLine(text) {
  return POINT_RE.test(text) || NUM_POINT_RE.test(text);
}

function isSubQuestionLine(text) {
  return /^\d+\s*[）.)]\s*/.test(text);
}

function looksLikeStem(text) {
  const t = strip(text);
  if (!t || ANSWER_MARKER_RE.test(t) || QUESTION_MARKER_RE.test(t)) return false;
  if (isPointLine(t) || isSubQuestionLine(t)) return false;
  if (t.startsWith('"') || t.startsWith('“')) return false;
  return t.length > 14 && (/[？?]$/.test(t) || /^(论述|农业经理人|成本控制)/.test(t));
}

/** 找到 48 道题的起始段落。Q3/Q9 无题号，使用回退规则补全。 */
function findStarts(paragraphs) {
  const starts = [];
  let lastId = 0;
  for (let i = 1; i < paragraphs.length; i++) {
    const n = numberedStart(paragraphs[i].text);
    if (!n || n > 48 || n <= lastId) continue;
    starts.push({ id: n, idx: i });
    lastId = n;
  }

  const byId = new Map(starts.map(s => [s.id, s]));
  for (let id = 1; id <= 48; id++) {
    if (byId.has(id)) continue;
    const prev = byId.get(id - 1);
    const next = byId.get(id + 1);
    if (!prev) continue;
    const from = prev.idx + 1;
    const to = next ? next.idx - 1 : paragraphs.length - 1;
    let found = -1;
    for (let i = from; i <= to; i++) {
      if (looksLikeStem(paragraphs[i].text)) { found = i; break; }
    }
    if (found < 0) throw new Error('无法定位第 ' + id + ' 题的起始段落');
    byId.set(id, { id, idx: found });
  }

  return Array.from(byId.values()).sort((a, b) => a.idx - b.idx);
}

function parseNonCase(start, end, paragraphs, cover) {
  const startText = strip(paragraphs[start.idx].text);
  const stem = strip(startText.replace(/^\d+\s*[.．、]\s*/, '').replace(/^["“]/, ''));
  cover(start.idx);

  let markerIdx = -1;
  let inlinePoint = null;
  for (let i = start.idx + 1; i <= end; i++) {
    if (ANSWER_MARKER_RE.test(strip(paragraphs[i].text))) {
      markerIdx = i;
      const t = strip(paragraphs[i].text);
      const m = t.match(/(（\d+）[\s\S]+)$/);
      if (m) inlinePoint = { idx: i, text: m[1] };
      break;
    }
  }
  if (markerIdx < 0) throw new Error('第 ' + start.id + ' 题缺少答案标记');

  const points = [];
  if (inlinePoint) {
    const m = inlinePoint.text.match(POINT_RE);
    const kv = splitKeyValue(m ? m[2] : inlinePoint.text);
    points.push({ index: points.length, text: strip(inlinePoint.text), key: kv.key, value: kv.value, srcPara: inlinePoint.idx });
  }
  for (let i = markerIdx + (inlinePoint ? 1 : 1); i <= end; i++) {
    const t = strip(paragraphs[i].text);
    const pm = t.match(POINT_RE) || t.match(NUM_POINT_RE);
    if (!pm) continue;
    const body = pm[2];
    const kv = splitKeyValue(body);
    points.push({ index: points.length, text: t, key: kv.key, value: kv.value, srcPara: i });
  }
  cover(markerIdx);
  points.forEach(p => cover(p.srcPara));

  const markerText = strip(paragraphs[markerIdx].text);
  return { stem, points, answerMarker: markerText };
}

function parseCase(start, end, paragraphs, cover) {
  const startText = strip(paragraphs[start.idx].text);

  let qMarkerIdx = -1;
  let answerMarkerIdx = -1;
  for (let i = start.idx + 1; i <= end; i++) {
    const t = strip(paragraphs[i].text);
    if (qMarkerIdx < 0 && QUESTION_MARKER_RE.test(t)) qMarkerIdx = i;
    if (ANSWER_MARKER_RE.test(t)) { answerMarkerIdx = i; break; }
  }
  if (qMarkerIdx < 0 || answerMarkerIdx < 0) throw new Error('第 ' + start.id + ' 题案例结构不完整');

  const backgroundParts = [startText];
  for (let i = start.idx + 1; i < qMarkerIdx; i++) {
    const t = strip(paragraphs[i].text);
    if (t) backgroundParts.push(t);
    cover(i);
  }
  let background = backgroundParts.join(' ')
    .replace(/^\d+\s*[.．、]\s*/, '')
    .replace(/^["“]/, '')
    .replace(/^背景[:：]\s*/, '')
    .replace(/["”]$/, '');
  cover(start.idx);

  const subQuestions = [];
  for (let i = qMarkerIdx + 1; i < answerMarkerIdx; i++) {
    const t = strip(paragraphs[i].text).replace(/["”]$/, '');
    if (!t) continue;
    subQuestions.push({ text: t, srcPara: i });
    cover(i);
  }
  cover(qMarkerIdx);

  const sections = [];
  let current = null;
  for (let i = answerMarkerIdx + 1; i <= end; i++) {
    const t = strip(paragraphs[i].text);
    if (!t) continue;
    const sm = t.match(SECTION_RE);
    if (sm && sm[2].length <= 24 && /[:：]?$/.test(sm[2])) {
      const title = strip(sm[2].replace(/^[）)]\s*/, '').replace(/[:：]$/, ''));
      current = { title, items: [], srcPara: i };
      sections.push(current);
      cover(i);
      continue;
    }
    if (!current) {
      current = { title: '要点', items: [], srcPara: i };
      sections.push(current);
    }
    const kv = splitKeyValue(t);
    current.items.push({ text: t, key: kv.key, value: kv.value, srcPara: i });
    cover(i);
  }
  cover(answerMarkerIdx);

  if (!sections.length) throw new Error('第 ' + start.id + ' 题案例没有答案要点');
  return {
    stem: background,
    case: {
      background,
      subQuestions,
      answerMarker: strip(paragraphs[answerMarkerIdx].text),
      questionMarker: strip(paragraphs[qMarkerIdx].text),
      answerSections: sections
    },
    points: []
  };
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function shuffle(arr, rand) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildNotes(paragraphs) {
  const covered = new Map();
  const cover = (idx) => {
    if (idx < 0 || idx >= paragraphs.length) throw new Error('段落索引越界: ' + idx);
    covered.set(idx, paragraphs[idx].text);
  };

  const starts = findStarts(paragraphs);
  if (starts.length !== 48) throw new Error('题数错误: ' + starts.length);
  cover(0);

  const questions = starts.map((start, i) => {
    const end = i + 1 < starts.length ? starts[i + 1].idx - 1 : paragraphs.length - 1;
    const isCase = /^\d+\s*[.．、]\s*["“]/.test(paragraphs[start.idx].text) ||
      /背景[:：]/.test(paragraphs[start.idx].text);
    const parsed = isCase ? parseCase(start, end, paragraphs, cover) : parseNonCase(start, end, paragraphs, cover);
    const moduleIndex = Math.floor((start.id - 1) / 4) + 1;
    return {
      id: start.id,
      moduleId: 'm' + String(moduleIndex).padStart(2, '0'),
      moduleName: MODULES[moduleIndex - 1],
      type: isCase ? 'case' : (start.id === 35 || /^论述/.test(paragraphs[start.idx].text.replace(/^\d+\s*[.．、]\s*/, '')) ? 'essay' : 'short'),
      stem: parsed.stem,
      points: parsed.points,
      case: parsed.case || null,
      answerMarker: parsed.answerMarker,
      srcParaRange: [start.idx, end]
    };
  });

  if (covered.size !== paragraphs.length) {
    const missing = [];
    for (let i = 0; i < paragraphs.length; i++) if (!covered.has(i)) missing.push(i + ':' + strip(paragraphs[i].text).slice(0, 40));
    throw new Error('零丢失自检失败，未覆盖段落 ' + missing.length + ' 个：\n' + missing.slice(0, 20).join('\n'));
  }

  const sourceJoin = paragraphs.map(p => strip(p.text)).join('');
  const treeJoin = Array.from(covered.entries()).sort((a, b) => a[0] - b[0]).map(e => strip(e[1])).join('');
  if (sourceJoin !== treeJoin) throw new Error('零丢失自检失败：文本顺序不一致');

  const modules = MODULES.map((name, i) => ({
    id: 'm' + String(i + 1).padStart(2, '0'),
    index: i + 1,
    name,
    questionIds: questions.filter(q => q.moduleId === 'm' + String(i + 1).padStart(2, '0')).map(q => q.id)
  }));

  return {
    meta: {
      sourceFile: path.basename(SRC),
      generatedAt: new Date().toISOString(),
      title: '农业经理人四级考试实操重点',
      subtitle: '12 模块 · 48 题 · 速记版',
      moduleCount: 12,
      questionCount: 48
    },
    modules,
    questions
  };
}

function deriveQuestions(notes) {
  const items = [];
  const rand = mulberry32(20261126);
  const allKeys = new Map();
  notes.questions.forEach(q => {
    const keys = [];
    q.points.forEach(p => keys.push(p.key));
    if (q.case) q.case.answerSections.forEach(s => s.items.forEach(it => keys.push(it.key)));
    allKeys.set(q.id, Array.from(new Set(keys.filter(k => k && k.length >= 2))));
  });

  const distractorsFor = (qid, correct, n) => {
    const q = notes.questions.find(x => x.id === qid);
    const sameModule = notes.questions.filter(x => x.moduleId === q.moduleId && x.id !== qid);
    const pool = [];
    sameModule.forEach(x => pool.push(...(allKeys.get(x.id) || [])));
    notes.questions.forEach(x => { if (x.moduleId !== q.moduleId) pool.push(...(allKeys.get(x.id) || [])); });
    const uniq = Array.from(new Set(pool.filter(k => k !== correct && k.length <= 20)));
    return shuffle(uniq, rand).slice(0, n);
  };

  notes.questions.forEach(q => {
    q.points.forEach((p, pi) => {
      const srcRef = { questionId: q.id, pointIndex: pi, para: p.srcPara };
      const filled = p.text.replace(p.key, '____');

      items.push({
        id: 'q' + q.id + '-fb-' + pi,
        kind: 'fillBlank',
        moduleId: q.moduleId,
        sourceQuestionId: q.id,
        prompt: `${q.stem}（要点${pi + 1}）${filled}`,
        answer: p.key,
        accept: [p.key],
        srcRef
      });

      const ds = distractorsFor(q.id, p.key, 3);
      if (ds.length === 3) {
        const options = shuffle([p.key, ...ds], rand);
        items.push({
          id: 'q' + q.id + '-ch-' + pi,
          kind: 'choice',
          moduleId: q.moduleId,
          sourceQuestionId: q.id,
          prompt: `${q.stem}（要点${pi + 1}）${filled}`,
          options,
          answerIndex: options.indexOf(p.key),
          srcRef
        });

        const flip = rand() < 0.5;
        const wrongKey = ds[0];
        const statement = flip ? p.text.replace(p.key, wrongKey) : p.text;
        items.push({
          id: 'q' + q.id + '-tf-' + pi,
          kind: 'trueFalse',
          moduleId: q.moduleId,
          sourceQuestionId: q.id,
          prompt: statement,
          answer: !flip,
          srcRef
        });
      }
    });

    if (q.case) {
      q.case.answerSections.forEach((sec, si) => {
        const entries = sec.items.filter(it => it.text).map((it, ii) => ({ text: it.key || it.value, orig: ii }));
        if (entries.length < 2) return;
        const shuffledEntries = shuffle(entries, rand);
        items.push({
          id: 'q' + q.id + '-or-' + si,
          kind: 'order',
          moduleId: q.moduleId,
          sourceQuestionId: q.id,
          prompt: `请将“${sec.title}”中的 ${entries.length} 项措施按原文顺序排列：`,
          steps: shuffledEntries.map(e => e.text),
          answerOrder: shuffledEntries.map(e => e.orig),
          srcRef: { questionId: q.id, sectionIndex: si, para: sec.srcPara }
        });
      });
    }
  });

  const counts = { fillBlank: 0, choice: 0, trueFalse: 0, order: 0 };
  items.forEach(it => counts[it.kind]++);
  return { version: '1.0.0', items, counts };
}

/** 源表中 3 道题的答案缺失或错填，按题干与选项语义修正并记录在 manifest 中。 */
const BANK_REPAIRS = {
  '880': { field: '答案', from: 'N', to: 'B', reason: '单选题答案误填判断题符号，选项 B 为正确答案' },
  '882': { field: '答案', from: '', to: 'Y', reason: '判断题答案空缺，题干表述正确' },
  '904': { field: '答案', from: '', to: 'C', reason: '单选题答案空缺，选项 C 为正确答案' }
};

function normalizeBank(raw) {
  if (!raw || !Array.isArray(raw.理论) || !Array.isArray(raw.实操)) {
    throw new Error('题库 JSON 结构不正确');
  }

  const repairs = [];
  const objective = raw.理论.map(item => {
    const no = String(item['序号'] || '').trim();
    const type = String(item['题型'] || '').trim();
    const prompt = strip(item['试题内容']);
    let answer = strip(item['答案']).toUpperCase();
    if (BANK_REPAIRS[no] && answer === BANK_REPAIRS[no].from) {
      answer = BANK_REPAIRS[no].to;
      repairs.push({ no, ...BANK_REPAIRS[no] });
    }

    const pointCode = strip(item['所属要素知识点']);
    if (type === '单项选择') {
      const options = ['可选答案A', '可选答案B', '可选答案C', '可选答案D'].map(k => strip(item[k]));
      if (!/^[A-D]$/.test(answer) || options.some(o => !o)) {
        throw new Error('理论题 ' + no + ' 不是有效单选题');
      }
      return {
        id: 't' + no,
        no: Number(no),
        kind: 'choice',
        prompt,
        options,
        answerIndex: answer.charCodeAt(0) - 65,
        answerLabel: answer,
        pointCode,
        source: 'theory'
      };
    }
    if (type === '判断题') {
      if (!/^[YN]$/.test(answer)) throw new Error('理论题 ' + no + ' 不是有效判断题');
      return {
        id: 't' + no,
        no: Number(no),
        kind: 'trueFalse',
        prompt,
        options: ['正确', '错误'],
        answerIndex: answer === 'Y' ? 0 : 1,
        answerLabel: answer === 'Y' ? '正确' : '错误',
        pointCode,
        source: 'theory'
      };
    }
    throw new Error('理论题 ' + no + ' 出现未知题型: ' + type);
  });

  const practical = raw.实操.map(item => {
    const no = String(item['序号'] || '').trim();
    return {
      id: 'p' + no,
      no: Number(no),
      type: strip(item['题型']),
      stem: strip(item['试题内容']),
      answer: String(item['参考答案'] || '').trim(),
      pointCode: strip(item['所属要素知识点']),
      source: 'practical'
    };
  });

  if (objective.length !== 1206) throw new Error('理论题数应为 1206，实际 ' + objective.length);
  if (practical.length !== 48) throw new Error('实操题数应为 48，实际 ' + practical.length);

  return {
    meta: {
      sourceFile: path.basename(BANK_SRC),
      total: objective.length + practical.length,
      theory: objective.length,
      practical: practical.length,
      choice: objective.filter(q => q.kind === 'choice').length,
      trueFalse: objective.filter(q => q.kind === 'trueFalse').length,
      repairedCount: repairs.length
    },
    repairs,
    objective,
    practical
  };
}

function main() {
  if (!fs.existsSync(SRC)) throw new Error('未找到源文档: ' + SRC);
  if (!fs.existsSync(BANK_SRC)) throw new Error('未找到题库文件: ' + BANK_SRC);
  const paragraphs = readDocxParagraphs(SRC);
  const notes = buildNotes(paragraphs);
  const questions = deriveQuestions(notes);
  const bank = normalizeBank(JSON.parse(fs.readFileSync(BANK_SRC, 'utf8')));
  const docxSha256 = crypto.createHash('sha256').update(fs.readFileSync(SRC)).digest('hex');
  const bankSha256 = crypto.createHash('sha256').update(fs.readFileSync(BANK_SRC)).digest('hex');

  const manifest = {
    appName: '农业经理人四级速记',
    appVersion: '1.0.0',
    generatedAt: notes.meta.generatedAt,
    docxSha256,
    bankSha256,
    counts: {
      modules: notes.modules.length,
      questions: notes.questions.length,
      ...questions.counts,
      bankTheory: bank.meta.theory,
      bankPractical: bank.meta.practical,
      bankObjective: bank.meta.theory,
      bankTotal: bank.meta.total
    },
    bankMeta: bank.meta,
    bankRepairs: bank.repairs,
    checks: { zeroLoss: true, bankValid: true, pass: true }
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const writeJson = (name, data) => fs.writeFileSync(path.join(OUT_DIR, name), JSON.stringify(data, null, 2), 'utf8');
  writeJson('notes.json', notes);
  writeJson('questions.json', questions);
  writeJson('bank.json', bank);
  writeJson('manifest.json', manifest);

  const inline = `/* 自动生成：WebView file:// 回退数据，请勿手改 */\nwindow.__AGRI_DATA__ = {\n  notes: ${JSON.stringify(notes)},\n  questions: ${JSON.stringify(questions)},\n  bank: ${JSON.stringify(bank)},\n  manifest: ${JSON.stringify(manifest)}\n};\n`;
  fs.writeFileSync(path.join(OUT_DIR, 'data-inline.js'), inline, 'utf8');

  console.log('[build-agri-data] 段落', paragraphs.length, '模块', notes.modules.length, '题目', notes.questions.length);
  console.log('[build-agri-data] 派生题', JSON.stringify(questions.counts));
  console.log('[build-agri-data] 新题库', bank.meta.total, '题（理论', bank.meta.theory, '/ 实操', bank.meta.practical, '，修正', bank.meta.repairedCount, '题）');
  console.log('[build-agri-data] 零丢失自检通过，已写入 www/data/');
}

main();
