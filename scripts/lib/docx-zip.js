'use strict';

const fs = require('fs');
const zlib = require('zlib');

function readUInt16LE(buf, off) { return buf.readUInt16LE(off); }
function readUInt32LE(buf, off) { return buf.readUInt32LE(off); }

/** 从 docx（ZIP）中取出 word/document.xml 的字符串。 */
function extractDocumentXml(docxBuf) {
  let eocdOff = -1;
  const min = Math.max(0, docxBuf.length - 65557);
  for (let i = docxBuf.length - 22; i >= min; i--) {
    if (readUInt32LE(docxBuf, i) === 0x06054b50) { eocdOff = i; break; }
  }
  if (eocdOff < 0) throw new Error('不是有效的 ZIP：未找到 EOCD');

  const cdSize = readUInt32LE(docxBuf, eocdOff + 12);
  const cdOff = readUInt32LE(docxBuf, eocdOff + 16);
  let p = cdOff;
  const end = cdOff + cdSize;

  while (p < end) {
    if (readUInt32LE(docxBuf, p) !== 0x02014b50) throw new Error('ZIP central directory 签名错误');
    const method = readUInt16LE(docxBuf, p + 10);
    const compSize = readUInt32LE(docxBuf, p + 20);
    const nameLen = readUInt16LE(docxBuf, p + 28);
    const extraLen = readUInt16LE(docxBuf, p + 30);
    const commentLen = readUInt16LE(docxBuf, p + 32);
    const localHeaderOff = readUInt32LE(docxBuf, p + 42);
    const name = docxBuf.slice(p + 46, p + 46 + nameLen).toString('utf8');

    if (name === 'word/document.xml') {
      if (readUInt32LE(docxBuf, localHeaderOff) !== 0x04034b50) throw new Error('ZIP local header 签名错误');
      const lhNameLen = readUInt16LE(docxBuf, localHeaderOff + 26);
      const lhExtraLen = readUInt16LE(docxBuf, localHeaderOff + 28);
      const dataStart = localHeaderOff + 30 + lhNameLen + lhExtraLen;
      const data = docxBuf.slice(dataStart, dataStart + compSize);
      if (method === 0) return data.toString('utf8');
      if (method === 8) return zlib.inflateRawSync(data).toString('utf8');
      throw new Error('不支持的 ZIP 压缩方法: ' + method);
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  throw new Error('docx 中未找到 word/document.xml');
}

function decodeXmlEntities(s) {
  return String(s || '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#([0-9]+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&amp;/g, '&');
}

const RE_P = /<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g;
const RE_R = /<w:r(?:\s[^>]*)?>[\s\S]*?<\/w:r>/g;
const RE_T = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g;
const RE_B = /<w:b(?:\s[^>]*)?\/>|<w:b(?:\s[^>]*)?>[\s\S]*?<\/w:b>/;
const RE_BR = /<w:br(?:\s[^>]*)?\/>/g;

/** 解析出所有段落：{ index, text, spans:[{text,bold}] } */
function parseParagraphs(documentXml) {
  const bodyMatch = documentXml.match(/<w:body>[\s\S]*?<\/w:body>/);
  const body = bodyMatch ? bodyMatch[0] : documentXml;
  const paragraphs = [];
  RE_P.lastIndex = 0;
  let m;
  let index = 0;
  while ((m = RE_P.exec(body)) !== null) {
    const pXml = m[0];
    const spans = [];
    RE_R.lastIndex = 0;
    let r;
    while ((r = RE_R.exec(pXml)) !== null) {
      const runXml = r[0].replace(RE_BR, '\n');
      const bold = RE_B.test(runXml);
      let text = '';
      RE_T.lastIndex = 0;
      let t;
      while ((t = RE_T.exec(runXml)) !== null) text += decodeXmlEntities(t[1]);
      if (!text) continue;
      const last = spans[spans.length - 1];
      if (last && last.bold === bold) last.text += text;
      else spans.push({ text, bold });
    }
    const text = spans.map(s => s.text).join('');
    if (text.trim()) paragraphs.push({ index: index++, text, spans });
  }
  return paragraphs;
}

function readDocxParagraphs(filePath) {
  const buf = fs.readFileSync(filePath);
  const xml = extractDocumentXml(buf);
  return parseParagraphs(xml);
}

module.exports = { extractDocumentXml, decodeXmlEntities, parseParagraphs, readDocxParagraphs };
