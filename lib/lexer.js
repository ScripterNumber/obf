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
  'true', 'until', 'while'
];

function tokenize(source) {
  const tokens = [];
  let pos = 0;
  const len = source.length;

  function peek() { return pos < len ? source[pos] : null; }
  function advance() { return source[pos++]; }

  function skipWhitespaceAndComments() {
    while (pos < len) {
      if (source[pos] === '-' && source[pos + 1] === '-') {
        if (source[pos + 2] === '[' && source[pos + 3] === '[') {
          pos += 4;
          while (pos < len - 1) {
            if (source[pos] === ']' && source[pos + 1] === ']') {
              pos += 2;
              break;
            }
            pos++;
          }
        } else {
          while (pos < len && source[pos] !== '\n') pos++;
        }
      } else if (/\s/.test(source[pos])) {
        pos++;
      } else {
        break;
      }
    }
  }

  function readString(quote) {
    let str = '';
    advance();
    while (pos < len && peek() !== quote) {
      if (peek() === '\\') {
        advance();
        const esc = advance();
        const escMap = { n: '\n', t: '\t', r: '\r', '\\': '\\' };
        escMap[quote] = quote;
        str += escMap[esc] || esc;
      } else {
        str += advance();
      }
    }
    advance();
    return str;
  }

  function readLongString() {
    let level = 0;
    pos++;
    while (peek() === '=') { level++; pos++; }
    pos++;
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
      while (pos < len && /[0-9a-fA-F]/.test(peek())) num += advance();
    } else {
      while (pos < len && /[0-9]/.test(peek())) num += advance();
      if (peek() === '.') {
        num += advance();
        while (pos < len && /[0-9]/.test(peek())) num += advance();
      }
      if (peek() === 'e' || peek() === 'E') {
        num += advance();
        if (peek() === '+' || peek() === '-') num += advance();
        while (pos < len && /[0-9]/.test(peek())) num += advance();
      }
    }
    return parseFloat(num);
  }

  const multiCharOps = ['==', '~=', '<=', '>=', '..', '<<', '>>', '//', '&&', '||'];
  const singleCharOps = ['+', '-', '*', '/', '%', '^', '#', '<', '>', '='];
  const punctuation = ['(', ')', '{', '}', '[', ']', ';', ':', ',', '.'];

  while (pos < len) {
    skipWhitespaceAndComments();
    if (pos >= len) break;

    const ch = peek();

    if (ch === '"' || ch === "'") {
      tokens.push({ type: TOKEN_TYPES.STRING, value: readString(ch) });
      continue;
    }

    if (ch === '[' && (source[pos + 1] === '[' || source[pos + 1] === '=')) {
      tokens.push({ type: TOKEN_TYPES.STRING, value: readLongString() });
      continue;
    }

    if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(source[pos + 1]))) {
      tokens.push({ type: TOKEN_TYPES.NUMBER, value: readNumber() });
      continue;
    }

    if (/[a-zA-Z_]/.test(ch)) {
      let ident = '';
      while (pos < len && /[a-zA-Z0-9_]/.test(peek())) ident += advance();
      if (KEYWORDS.includes(ident)) {
        tokens.push({ type: TOKEN_TYPES.KEYWORD, value: ident });
      } else {
        tokens.push({ type: TOKEN_TYPES.IDENTIFIER, value: ident });
      }
      continue;
    }

    let matched = false;
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
