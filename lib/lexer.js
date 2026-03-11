const TOKEN_TYPES = {
  NUMBER: 'NUMBER',
  STRING: 'STRING',
  KEYWORD: 'KEYWORD',
  IDENTIFIER: 'IDENTIFIER',
  OPERATOR: 'OPERATOR',
  PUNCTUATION: 'PUNCTUATION',
  EOF: 'EOF'
};

const KEYWORDS = [
  'and', 'break', 'do', 'else', 'elseif', 'end',
  'false', 'for', 'function', 'if', 'in', 'local',
  'nil', 'not', 'or', 'repeat', 'return', 'then',
  'true', 'until', 'while', 'continue'
];

function tokenize(source) {
  const tokens = [];
  let pos = 0;
  const len = source.length;

  function peek() { return pos < len ? source[pos] : null; }
  function peek2() { return pos + 1 < len ? source[pos + 1] : null; }
  function advance() { return source[pos++]; }

  function skipWhitespaceAndComments() {
    while (pos < len) {
      if (source[pos] === '-' && source[pos + 1] === '-') {
        if (source[pos + 2] === '[') {
          let eqCount = 0;
          let checkPos = pos + 3;
          while (checkPos < len && source[checkPos] === '=') {
            eqCount++;
            checkPos++;
          }
          if (checkPos < len && source[checkPos] === '[') {
            pos = checkPos + 1;
            const closing = ']' + '='.repeat(eqCount) + ']';
            while (pos < len) {
              if (source.substring(pos, pos + closing.length) === closing) {
                pos += closing.length;
                break;
              }
              pos++;
            }
            continue;
          }
        }
        while (pos < len && source[pos] !== '\n') pos++;
        continue;
      }

      if (/\s/.test(source[pos])) {
        pos++;
        continue;
      }

      break;
    }
  }

  function readString(quote) {
    let str = '';
    advance();
    while (pos < len && peek() !== quote) {
      if (peek() === '\\') {
        advance();
        const esc = advance();
        const escMap = { n: '\n', t: '\t', r: '\r', '\\': '\\', '0': '\0', a: '\x07', b: '\b', f: '\f', v: '\v' };
        escMap[quote] = quote;
        if (escMap[esc] !== undefined) {
          str += escMap[esc];
        } else if (esc === 'x') {
          const hex = source[pos] + source[pos + 1];
          pos += 2;
          str += String.fromCharCode(parseInt(hex, 16));
        } else if (/[0-9]/.test(esc)) {
          let numStr = esc;
          if (/[0-9]/.test(peek())) numStr += advance();
          if (/[0-9]/.test(peek())) numStr += advance();
          str += String.fromCharCode(parseInt(numStr, 10));
        } else {
          str += esc;
        }
      } else {
        str += advance();
      }
    }
    if (pos < len) advance();
    return str;
  }

  function readLongString() {
    let level = 0;
    pos++;
    while (peek() === '=') { level++; pos++; }
    pos++;
    if (peek() === '\n') pos++;
    let str = '';
    const closing = ']' + '='.repeat(level) + ']';
    while (pos < len) {
      if (source.substring(pos, pos + closing.length) === closing) {
        pos += closing.length;
        return str;
      }
      str += advance();
    }
    return str;
  }

  function readNumber() {
    let num = '';
    if (peek() === '0' && (source[pos + 1] === 'x' || source[pos + 1] === 'X')) {
      num += advance() + advance();
      while (pos < len && /[0-9a-fA-F_]/.test(peek())) {
        if (peek() !== '_') num += advance();
        else advance();
      }
    } else if (peek() === '0' && (source[pos + 1] === 'b' || source[pos + 1] === 'B')) {
      num += advance() + advance();
      while (pos < len && /[01_]/.test(peek())) {
        if (peek() !== '_') num += advance();
        else advance();
      }
    } else {
      while (pos < len && /[0-9_]/.test(peek())) {
        if (peek() !== '_') num += advance();
        else advance();
      }
      if (peek() === '.' && /[0-9]/.test(source[pos + 1])) {
        num += advance();
        while (pos < len && /[0-9_]/.test(peek())) {
          if (peek() !== '_') num += advance();
          else advance();
        }
      }
      if (peek() === 'e' || peek() === 'E') {
        num += advance();
        if (peek() === '+' || peek() === '-') num += advance();
        while (pos < len && /[0-9]/.test(peek())) num += advance();
      }
    }
    return parseFloat(num);
  }

  function skipTypeAnnotation() {
    let depth = 0;
    while (pos < len) {
      const ch = peek();
      if (ch === '(') { depth++; advance(); continue; }
      if (ch === ')') {
        if (depth > 0) { depth--; advance(); continue; }
        break;
      }
      if (ch === '{') { depth++; advance(); continue; }
      if (ch === '}') {
        if (depth > 0) { depth--; advance(); continue; }
        break;
      }
      if (ch === '<') { depth++; advance(); continue; }
      if (ch === '>') {
        if (depth > 0) { depth--; advance(); continue; }
        break;
      }
      if (depth === 0 && (ch === ',' || ch === ')' || ch === '=' || ch === '\n' || ch === ';')) break;
      if (depth === 0 && ch === '-' && source[pos + 1] === '-') break;
      if (depth === 0 && /\s/.test(ch)) {
        advance();
        skipWhitespaceAndComments();
        const next = peek();
        if (next === '|' || next === '&' || next === '?' || next === '-') {
          if (next === '-' && source[pos + 1] === '>') {
            advance(); advance();
            continue;
          }
          if (next === '-' && source[pos + 1] === '-') break;
          if (next !== '-') { advance(); continue; }
        }
        break;
      }
      advance();
    }
  }

  const compoundOps = ['+=', '-=', '*=', '/=', '%=', '^=', '..=', '//='];
  const multiCharOps = ['==', '~=', '<=', '>=', '..', '<<', '>>', '//', '->'];
  const singleCharOps = ['+', '-', '*', '/', '%', '^', '#', '<', '>', '='];
  const punctuation = ['(', ')', '{', '}', '[', ']', ';', ':', ',', '.'];

  while (pos < len) {
    skipWhitespaceAndComments();
    if (pos >= len) break;

    const ch = peek();

    if (ch === '`') {
      advance();
      let str = '';
      while (pos < len && peek() !== '`') {
        if (peek() === '{') {
          if (str.length > 0) {
            tokens.push({ type: TOKEN_TYPES.STRING, value: str });
            tokens.push({ type: TOKEN_TYPES.OPERATOR, value: '..' });
            str = '';
          }
          advance();
          tokens.push({ type: TOKEN_TYPES.IDENTIFIER, value: 'tostring' });
          tokens.push({ type: TOKEN_TYPES.PUNCTUATION, value: '(' });
          let depth = 1;
          let inner = '';
          while (pos < len && depth > 0) {
            if (peek() === '{') depth++;
            if (peek() === '}') { depth--; if (depth === 0) break; }
            inner += advance();
          }
          advance();
          const innerTokens = tokenize(inner);
          innerTokens.pop();
          tokens.push(...innerTokens);
          tokens.push({ type: TOKEN_TYPES.PUNCTUATION, value: ')' });
          tokens.push({ type: TOKEN_TYPES.OPERATOR, value: '..' });
          continue;
        }
        if (peek() === '\\') {
          advance();
          str += advance();
        } else {
          str += advance();
        }
      }
      if (pos < len) advance();
      if (tokens.length > 0 && tokens[tokens.length - 1].type === TOKEN_TYPES.OPERATOR && tokens[tokens.length - 1].value === '..') {
        tokens.push({ type: TOKEN_TYPES.STRING, value: str });
      } else {
        tokens.push({ type: TOKEN_TYPES.STRING, value: str });
      }
      continue;
    }

    if (ch === '"' || ch === "'") {
      tokens.push({ type: TOKEN_TYPES.STRING, value: readString(ch) });
      continue;
    }

    if (ch === '[' && (source[pos + 1] === '[' || source[pos + 1] === '=')) {
      let eqCheck = pos + 1;
      let isLong = false;
      if (source[eqCheck] === '[') {
        isLong = true;
      } else if (source[eqCheck] === '=') {
        while (eqCheck < len && source[eqCheck] === '=') eqCheck++;
        if (eqCheck < len && source[eqCheck] === '[') isLong = true;
      }
      if (isLong) {
        tokens.push({ type: TOKEN_TYPES.STRING, value: readLongString() });
        continue;
      }
    }

    if (/[0-9]/.test(ch) || (ch === '.' && pos + 1 < len && /[0-9]/.test(source[pos + 1]))) {
      tokens.push({ type: TOKEN_TYPES.NUMBER, value: readNumber() });
      continue;
    }

    if (/[a-zA-Z_]/.test(ch)) {
      let ident = '';
      while (pos < len && /[a-zA-Z0-9_]/.test(peek())) ident += advance();
      if (ident === 'type' && pos < len && peek() !== '(' && peek() !== '.' && peek() !== ':' && peek() !== '[' && peek() !== '=' && peek() !== ',') {
        skipWhitespaceAndComments();
        if (/[a-zA-Z_]/.test(peek())) {
          while (pos < len && /[a-zA-Z0-9_]/.test(peek())) advance();
          skipWhitespaceAndComments();
          if (peek() === '=') {
            advance();
            skipTypeAnnotation();
          }
          continue;
        }
      }
      if (ident === 'export') {
        skipWhitespaceAndComments();
        continue;
      }
      if (KEYWORDS.includes(ident)) {
        tokens.push({ type: TOKEN_TYPES.KEYWORD, value: ident });
      } else {
        tokens.push({ type: TOKEN_TYPES.IDENTIFIER, value: ident });
      }
      skipWhitespaceAndComments();
      if (peek() === ':' && source[pos + 1] !== ':' && source[pos + 1] !== ')' && tokens.length > 0) {
        const prevToken = tokens[tokens.length - 1];
        if (prevToken.type === TOKEN_TYPES.IDENTIFIER) {
          const savedPos = pos;
          advance();
          skipWhitespaceAndComments();
          if (/[a-zA-Z_{(]/.test(peek())) {
            let isType = true;
            const typeStart = pos;
            skipTypeAnnotation();
            skipWhitespaceAndComments();
            const after = peek();
            if (after === ',' || after === ')' || after === '=' || after === '\n' || after === ';' || after === undefined) {
              continue;
            }
            pos = savedPos;
          } else {
            pos = savedPos;
          }
        }
      }
      continue;
    }

    let matched = false;
    for (const op of compoundOps) {
      if (source.substring(pos, pos + op.length) === op) {
        tokens.push({ type: TOKEN_TYPES.OPERATOR, value: op });
        pos += op.length;
        matched = true;
        break;
      }
    }
    if (matched) continue;

    for (const op of multiCharOps) {
      if (source.substring(pos, pos + op.length) === op) {
        tokens.push({ type: TOKEN_TYPES.OPERATOR, value: op });
        pos += op.length;
        matched = true;
        break;
      }
    }
    if (matched) continue;

    if (singleCharOps.includes(ch)) {
      tokens.push({ type: TOKEN_TYPES.OPERATOR, value: advance() });
      continue;
    }

    if (punctuation.includes(ch)) {
      tokens.push({ type: TOKEN_TYPES.PUNCTUATION, value: advance() });
      continue;
    }

    pos++;
  }

  tokens.push({ type: TOKEN_TYPES.EOF, value: null });
  return tokens;
}

module.exports = { tokenize, TOKEN_TYPES, KEYWORDS };
