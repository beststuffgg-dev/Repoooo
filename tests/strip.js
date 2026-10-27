const acorn = require('acorn');

function parse(src, extra) {
  const base = Object.assign({ ecmaVersion: 'latest', allowHashBang: true }, extra);
  try {
    return acorn.parse(src, Object.assign({ sourceType: 'script' }, base));
  } catch (e) {
    return acorn.parse(src, Object.assign({ sourceType: 'module' }, base));
  }
}

function removeRanges(src, ranges) {
  let s = src;
  const sorted = ranges.slice().sort((a, b) => b[0] - a[0]);
  for (const [start, end] of sorted) {
    const lineStart = s.lastIndexOf('\n', start - 1) + 1;
    let lineEnd = s.indexOf('\n', end);
    if (lineEnd < 0) lineEnd = s.length;
    const before = s.slice(lineStart, start);
    const after = s.slice(end, lineEnd);

    if (!before.trim() && !after.trim()) {
      let cutEnd = Math.min(lineEnd + 1, s.length);
      const prevBlank = lineStart === 0 || s[lineStart - 1] === '\n' && (lineStart === 1 || s[lineStart - 2] === '\n');
      const nl = s.indexOf('\n', cutEnd);
      const nextLine = cutEnd < s.length ? s.slice(cutEnd, nl < 0 ? s.length : nl) : null;
      if (prevBlank && nextLine !== null && !nextLine.trim()) cutEnd = nl < 0 ? s.length : nl + 1;
      s = s.slice(0, lineStart) + s.slice(cutEnd);
    } else if (!after.trim()) {
      s = s.slice(0, lineStart) + before.replace(/[ \t]+$/, '') + s.slice(lineEnd);
    } else {
      const glue = before === '' || /\s$/.test(before) || /^\s/.test(after) ? '' : ' ';
      s = s.slice(0, start) + glue + s.slice(end);
    }
  }
  return s;
}

function jsCommentRanges(src) {
  const comments = [];
  parse(src, { onComment: (block, text, start, end) => comments.push([start, end]) });
  return src.startsWith('#!') ? comments.filter(c => c[0] !== 0) : comments;
}

function stripJs(src) {
  return removeRanges(src, jsCommentRanges(src));
}

function astSig(src) {
  return JSON.stringify(parse(src), (k, v) => (k === 'start' || k === 'end' ? undefined : v));
}

module.exports = { stripJs, removeRanges, jsCommentRanges, astSig, parse };
