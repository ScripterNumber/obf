const { TOKEN_TYPES } = require('./lexer');

class Parser {
  constructor(tokens) {
    this.tokens = tokens;
    this.pos = 0;
  }

  peek() { return this.tokens[this.pos]; }
  advance() { return this.tokens[this.pos++]; }

  expect(type, value) {
    const t = this.advance();
    if (t.type !== type || (value !== undefined && t.value !== value)) {
      throw new Error(`Expected ${type} ${value || ''} got ${t.type} ${t.value}`);
    }
    return t;
  }

  match(type, value) {
    const t = this.peek();
    if (t.type === type && (value === undefined || t.value === value)) {
      return this.advance();
    }
    return null;
  }

  parse() {
    const body = this.parseBlock();
    this.expect(TOKEN_TYPES.EOF);
    return { type: 'Chunk', body };
  }

  parseBlock() {
    const stmts = [];
    while (true) {
      const t = this.peek();
      if (t.type === TOKEN_TYPES.EOF) break;
      if (t.type === TOKEN_TYPES.KEYWORD && ['end', 'else', 'elseif', 'until'].includes(t.value)) break;
      const stmt = this.parseStatement();
      if (stmt) stmts.push(stmt);
    }
    return stmts;
  }

  parseStatement() {
    const t = this.peek();

    if (t.type === TOKEN_TYPES.KEYWORD) {
      switch (t.value) {
        case 'local': return this.parseLocal();
        case 'if': return this.parseIf();
        case 'while': return this.parseWhile();
        case 'for': return this.parseFor();
        case 'repeat': return this.parseRepeat();
        case 'function': return this.parseFunctionStat();
        case 'return': return this.parseReturn();
        case 'do': return this.parseDo();
        case 'break': this.advance(); return { type: 'BreakStatement' };
      }
    }

    return this.parseExpressionStatement();
  }

  parseLocal() {
    this.expect(TOKEN_TYPES.KEYWORD, 'local');
    if (this.peek().type === TOKEN_TYPES.KEYWORD && this.peek().value === 'function') {
      this.advance();
      const name = this.expect(TOKEN_TYPES.IDENTIFIER).value;
      const func = this.parseFunctionBody();
      return { type: 'LocalFunction', name, func };
    }
    const names = [this.expect(TOKEN_TYPES.IDENTIFIER).value];
    while (this.match(TOKEN_TYPES.PUNCTUATION, ',')) {
      names.push(this.expect(TOKEN_TYPES.IDENTIFIER).value);
    }
    let values = [];
    if (this.match(TOKEN_TYPES.OPERATOR, '=')) {
      values = this.parseExpressionList();
    }
    return { type: 'LocalStatement', names, values };
  }

  parseIf() {
    this.expect(TOKEN_TYPES.KEYWORD, 'if');
    const condition = this.parseExpression();
    this.expect(TOKEN_TYPES.KEYWORD, 'then');
    const body = this.parseBlock();
    const elseifs = [];
    let elseBody = null;
    while (this.match(TOKEN_TYPES.KEYWORD, 'elseif')) {
      const cond = this.parseExpression();
      this.expect(TOKEN_TYPES.KEYWORD, 'then');
      const block = this.parseBlock();
      elseifs.push({ condition: cond, body: block });
    }
    if (this.match(TOKEN_TYPES.KEYWORD, 'else')) {
      elseBody = this.parseBlock();
    }
    this.expect(TOKEN_TYPES.KEYWORD, 'end');
    return { type: 'IfStatement', condition, body, elseifs, elseBody };
  }

  parseWhile() {
    this.expect(TOKEN_TYPES.KEYWORD, 'while');
    const condition = this.parseExpression();
    this.expect(TOKEN_TYPES.KEYWORD, 'do');
    const body = this.parseBlock();
    this.expect(TOKEN_TYPES.KEYWORD, 'end');
    return { type: 'WhileStatement', condition, body };
  }

  parseFor() {
    this.expect(TOKEN_TYPES.KEYWORD, 'for');
    const name = this.expect(TOKEN_TYPES.IDENTIFIER).value;
    if (this.match(TOKEN_TYPES.OPERATOR, '=')) {
      const start = this.parseExpression();
      this.expect(TOKEN_TYPES.PUNCTUATION, ',');
      const limit = this.parseExpression();
      let step = null;
      if (this.match(TOKEN_TYPES.PUNCTUATION, ',')) {
        step = this.parseExpression();
      }
      this.expect(TOKEN_TYPES.KEYWORD, 'do');
      const body = this.parseBlock();
      this.expect(TOKEN_TYPES.KEYWORD, 'end');
      return { type: 'NumericFor', name, start, limit, step, body };
    }
    const names = [name];
    while (this.match(TOKEN_TYPES.PUNCTUATION, ',')) {
      names.push(this.expect(TOKEN_TYPES.IDENTIFIER).value);
    }
    this.expect(TOKEN_TYPES.KEYWORD, 'in');
    const iterators = this.parseExpressionList();
    this.expect(TOKEN_TYPES.KEYWORD, 'do');
    const body = this.parseBlock();
    this.expect(TOKEN_TYPES.KEYWORD, 'end');
    return { type: 'GenericFor', names, iterators, body };
  }

  parseRepeat() {
    this.expect(TOKEN_TYPES.KEYWORD, 'repeat');
    const body = this.parseBlock();
    this.expect(TOKEN_TYPES.KEYWORD, 'until');
    const condition = this.parseExpression();
    return { type: 'RepeatStatement', body, condition };
  }

  parseFunctionStat() {
    this.expect(TOKEN_TYPES.KEYWORD, 'function');
    const name = this.parseFunctionName();
    const func = this.parseFunctionBody();
    return { type: 'FunctionStatement', name, func };
  }

  parseFunctionName() {
    let name = this.expect(TOKEN_TYPES.IDENTIFIER).value;
    while (this.match(TOKEN_TYPES.PUNCTUATION, '.')) {
      name += '.' + this.expect(TOKEN_TYPES.IDENTIFIER).value;
    }
    if (this.match(TOKEN_TYPES.PUNCTUATION, ':')) {
      name += ':' + this.expect(TOKEN_TYPES.IDENTIFIER).value;
    }
    return name;
  }

  parseFunctionBody() {
    this.expect(TOKEN_TYPES.PUNCTUATION, '(');
    const params = [];
    let hasVarargs = false;
    if (this.peek().type !== TOKEN_TYPES.PUNCTUATION || this.peek().value !== ')') {
      if (this.peek().type === TOKEN_TYPES.PUNCTUATION && this.peek().value === '.') {
        this.advance(); this.advance(); this.advance();
        hasVarargs = true;
      } else {
        params.push(this.expect(TOKEN_TYPES.IDENTIFIER).value);
        while (this.match(TOKEN_TYPES.PUNCTUATION, ',')) {
          if (this.peek().type === TOKEN_TYPES.PUNCTUATION && this.peek().value === '.') {
            this.advance(); this.advance(); this.advance();
            hasVarargs = true;
            break;
          }
          params.push(this.expect(TOKEN_TYPES.IDENTIFIER).value);
        }
      }
    }
    this.expect(TOKEN_TYPES.PUNCTUATION, ')');
    const body = this.parseBlock();
    this.expect(TOKEN_TYPES.KEYWORD, 'end');
    return { type: 'FunctionExpression', params, hasVarargs, body };
  }

  parseReturn() {
    this.expect(TOKEN_TYPES.KEYWORD, 'return');
    const t = this.peek();
    if (t.type === TOKEN_TYPES.EOF || (t.type === TOKEN_TYPES.KEYWORD && ['end', 'else', 'elseif', 'until'].includes(t.value))) {
      return { type: 'ReturnStatement', values: [] };
    }
    const values = this.parseExpressionList();
    this.match(TOKEN_TYPES.PUNCTUATION, ';');
    return { type: 'ReturnStatement', values };
  }

  parseDo() {
    this.expect(TOKEN_TYPES.KEYWORD, 'do');
    const body = this.parseBlock();
    this.expect(TOKEN_TYPES.KEYWORD, 'end');
    return { type: 'DoStatement', body };
  }

  parseExpressionStatement() {
    const expr = this.parseSuffixExpression();
    if (this.match(TOKEN_TYPES.OPERATOR, '=')) {
      const targets = [expr];
      while (this.match(TOKEN_TYPES.PUNCTUATION, ',')) {
        targets.push(this.parseSuffixExpression());
      }
      const values = this.parseExpressionList();
      return { type: 'AssignmentStatement', targets: targets.length === 1 ? targets[0] : targets, values };
    }
    if (this.match(TOKEN_TYPES.PUNCTUATION, ',')) {
      const targets = [expr];
      targets.push(this.parseSuffixExpression());
      while (this.match(TOKEN_TYPES.PUNCTUATION, ',')) {
        targets.push(this.parseSuffixExpression());
      }
      this.expect(TOKEN_TYPES.OPERATOR, '=');
      const values = this.parseExpressionList();
      return { type: 'AssignmentStatement', targets, values };
    }
    return { type: 'ExpressionStatement', expression: expr };
  }

  parseExpressionList() {
    const list = [this.parseExpression()];
    while (this.match(TOKEN_TYPES.PUNCTUATION, ',')) {
      list.push(this.parseExpression());
    }
    return list;
  }

  parseExpression() {
    return this.parseOr();
  }

  parseOr() {
    let left = this.parseAnd();
    while (this.match(TOKEN_TYPES.KEYWORD, 'or')) {
      left = { type: 'BinaryExpression', operator: 'or', left, right: this.parseAnd() };
    }
    return left;
  }

  parseAnd() {
    let left = this.parseComparison();
    while (this.match(TOKEN_TYPES.KEYWORD, 'and')) {
      left = { type: 'BinaryExpression', operator: 'and', left, right: this.parseComparison() };
    }
    return left;
  }

  parseComparison() {
    let left = this.parseConcat();
    const ops = ['<', '>', '<=', '>=', '==', '~='];
    while (this.peek().type === TOKEN_TYPES.OPERATOR && ops.includes(this.peek().value)) {
      const op = this.advance().value;
      left = { type: 'BinaryExpression', operator: op, left, right: this.parseConcat() };
    }
    return left;
  }

  parseConcat() {
    let left = this.parseAddSub();
    if (this.peek().type === TOKEN_TYPES.OPERATOR && this.peek().value === '..') {
      this.advance();
      left = { type: 'BinaryExpression', operator: '..', left, right: this.parseConcat() };
    }
    return left;
  }

  parseAddSub() {
    let left = this.parseMulDiv();
    while (this.peek().type === TOKEN_TYPES.OPERATOR && ['+', '-'].includes(this.peek().value)) {
      const op = this.advance().value;
      left = { type: 'BinaryExpression', operator: op, left, right: this.parseMulDiv() };
    }
    return left;
  }

  parseMulDiv() {
    let left = this.parseUnary();
    while (this.peek().type === TOKEN_TYPES.OPERATOR && ['*', '/', '%', '//'].includes(this.peek().value)) {
      const op = this.advance().value;
      left = { type: 'BinaryExpression', operator: op, left, right: this.parseUnary() };
    }
    return left;
  }

  parseUnary() {
    if (this.peek().type === TOKEN_TYPES.KEYWORD && this.peek().value === 'not') {
      this.advance();
      return { type: 'UnaryExpression', operator: 'not', operand: this.parseUnary() };
    }
    if (this.peek().type === TOKEN_TYPES.OPERATOR && ['-', '#'].includes(this.peek().value)) {
      const op = this.advance().value;
      return { type: 'UnaryExpression', operator: op, operand: this.parseUnary() };
    }
    return this.parsePower();
  }

  parsePower() {
    let base = this.parseSuffixExpression();
    if (this.peek().type === TOKEN_TYPES.OPERATOR && this.peek().value === '^') {
      this.advance();
      base = { type: 'BinaryExpression', operator: '^', left: base, right: this.parseUnary() };
    }
    return base;
  }

  parseSuffixExpression() {
    let expr = this.parsePrimaryExpression();
    while (true) {
      if (this.match(TOKEN_TYPES.PUNCTUATION, '.')) {
        const name = this.expect(TOKEN_TYPES.IDENTIFIER).value;
        expr = { type: 'MemberExpression', object: expr, property: name, computed: false };
      } else if (this.peek().type === TOKEN_TYPES.PUNCTUATION && this.peek().value === '[') {
        this.advance();
        const index = this.parseExpression();
        this.expect(TOKEN_TYPES.PUNCTUATION, ']');
        expr = { type: 'MemberExpression', object: expr, property: index, computed: true };
      } else if (this.match(TOKEN_TYPES.PUNCTUATION, ':')) {
        const method = this.expect(TOKEN_TYPES.IDENTIFIER).value;
        const args = this.parseCallArgs();
        expr = { type: 'MethodCall', object: expr, method, args };
      } else if (this.peek().type === TOKEN_TYPES.PUNCTUATION && this.peek().value === '(' ||
                 this.peek().type === TOKEN_TYPES.STRING ||
                 (this.peek().type === TOKEN_TYPES.PUNCTUATION && this.peek().value === '{')) {
        const args = this.parseCallArgs();
        expr = { type: 'CallExpression', callee: expr, args };
      } else {
        break;
      }
    }
    return expr;
  }

  parseCallArgs() {
    if (this.peek().type === TOKEN_TYPES.STRING) {
      return [{ type: 'StringLiteral', value: this.advance().value }];
    }
    if (this.peek().type === TOKEN_TYPES.PUNCTUATION && this.peek().value === '{') {
      return [this.parseTableConstructor()];
    }
    this.expect(TOKEN_TYPES.PUNCTUATION, '(');
    const args = [];
    if (this.peek().type !== TOKEN_TYPES.PUNCTUATION || this.peek().value !== ')') {
      args.push(...this.parseExpressionList());
    }
    this.expect(TOKEN_TYPES.PUNCTUATION, ')');
    return args;
  }

  parsePrimaryExpression() {
    const t = this.peek();
    if (t.type === TOKEN_TYPES.NUMBER) {
      return { type: 'NumberLiteral', value: this.advance().value };
    }
    if (t.type === TOKEN_TYPES.STRING) {
      return { type: 'StringLiteral', value: this.advance().value };
    }
    if (t.type === TOKEN_TYPES.KEYWORD && t.value === 'true') {
      this.advance();
      return { type: 'BooleanLiteral', value: true };
    }
    if (t.type === TOKEN_TYPES.KEYWORD && t.value === 'false') {
      this.advance();
      return { type: 'BooleanLiteral', value: false };
    }
    if (t.type === TOKEN_TYPES.KEYWORD && t.value === 'nil') {
      this.advance();
      return { type: 'NilLiteral' };
    }
    if (t.type === TOKEN_TYPES.KEYWORD && t.value === 'function') {
      this.advance();
      return this.parseFunctionBody();
    }
    if (t.type === TOKEN_TYPES.PUNCTUATION && t.value === '{') {
      return this.parseTableConstructor();
    }
    if (t.type === TOKEN_TYPES.PUNCTUATION && t.value === '(') {
      this.advance();
      const expr = this.parseExpression();
      this.expect(TOKEN_TYPES.PUNCTUATION, ')');
      return expr;
    }
    if (t.type === TOKEN_TYPES.IDENTIFIER) {
      return { type: 'Identifier', name: this.advance().value };
    }
    if (t.type === TOKEN_TYPES.PUNCTUATION && t.value === '.') {
      this.advance();
      this.expect(TOKEN_TYPES.PUNCTUATION, '.');
      this.expect(TOKEN_TYPES.PUNCTUATION, '.');
      return { type: 'VarargExpression' };
    }
    throw new Error(`Unexpected token: ${t.type} ${t.value}`);
  }

  parseTableConstructor() {
    this.expect(TOKEN_TYPES.PUNCTUATION, '{');
    const fields = [];
    while (this.peek().type !== TOKEN_TYPES.PUNCTUATION || this.peek().value !== '}') {
      if (this.peek().type === TOKEN_TYPES.PUNCTUATION && this.peek().value === '[') {
        this.advance();
        const key = this.parseExpression();
        this.expect(TOKEN_TYPES.PUNCTUATION, ']');
        this.expect(TOKEN_TYPES.OPERATOR, '=');
        const value = this.parseExpression();
        fields.push({ type: 'IndexedField', key, value });
      } else if (this.peek().type === TOKEN_TYPES.IDENTIFIER && this.tokens[this.pos + 1].type === TOKEN_TYPES.OPERATOR && this.tokens[this.pos + 1].value === '=') {
        const key = this.advance().value;
        this.advance();
        const value = this.parseExpression();
        fields.push({ type: 'NamedField', key, value });
      } else {
        fields.push({ type: 'ValueField', value: this.parseExpression() });
      }
      if (!this.match(TOKEN_TYPES.PUNCTUATION, ',') && !this.match(TOKEN_TYPES.PUNCTUATION, ';')) break;
    }
    this.expect(TOKEN_TYPES.PUNCTUATION, '}');
    return { type: 'TableConstructor', fields };
  }
}

module.exports = { Parser };
