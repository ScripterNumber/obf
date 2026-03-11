const OPCODES = {
  LOAD_CONST: 0x01,
  LOAD_NIL: 0x02,
  LOAD_BOOL: 0x03,
  GET_LOCAL: 0x04,
  SET_LOCAL: 0x05,
  GET_GLOBAL: 0x06,
  SET_GLOBAL: 0x07,
  GET_TABLE: 0x08,
  SET_TABLE: 0x09,
  ADD: 0x10,
  SUB: 0x11,
  MUL: 0x12,
  DIV: 0x13,
  MOD: 0x14,
  POW: 0x15,
  CONCAT: 0x16,
  UNM: 0x17,
  NOT: 0x18,
  LEN: 0x19,
  EQ: 0x20,
  LT: 0x21,
  LE: 0x22,
  JMP: 0x30,
  JMP_IF_FALSE: 0x31,
  JMP_IF_TRUE: 0x32,
  CALL: 0x40,
  RETURN: 0x41,
  CLOSURE: 0x42,
  NEW_TABLE: 0x43,
  SET_LIST: 0x44,
  FOR_PREP: 0x50,
  FOR_LOOP: 0x51,
  ITER_PREP: 0x52,
  ITER_LOOP: 0x53,
  MOVE: 0x54,
  POP: 0x55,
  DUP: 0x56,
  METHOD_CALL: 0x57,
  VARARG: 0x58,
  FLOOR_DIV: 0x59
};

class Compiler {
  constructor() {
    this.constants = [];
    this.instructions = [];
    this.locals = [{}];
    this.localCount = [0];
    this.protos = [];
    this.breakStack = [];
  }

  addConstant(value) {
    const idx = this.constants.indexOf(value);
    if (idx !== -1) return idx;
    this.constants.push(value);
    return this.constants.length - 1;
  }

  emit(op, ...args) {
    this.instructions.push([op, ...args]);
    return this.instructions.length - 1;
  }

  currentScope() { return this.locals[this.locals.length - 1]; }

  pushScope() {
    this.locals.push({});
    this.localCount.push(this.localCount[this.localCount.length - 1]);
  }

  popScope() {
    const scope = this.locals.pop();
    this.localCount.pop();
  }

  declareLocal(name) {
    const slot = this.localCount[this.localCount.length - 1];
    this.currentScope()[name] = slot;
    this.localCount[this.localCount.length - 1] = slot + 1;
    return slot;
  }

  resolveLocal(name) {
    for (let i = this.locals.length - 1; i >= 0; i--) {
      if (this.locals[i][name] !== undefined) return this.locals[i][name];
    }
    return null;
  }

  compile(ast) {
    this.compileBlock(ast.body);
    this.emit(OPCODES.RETURN, 0);
    return {
      constants: this.constants,
      instructions: this.instructions,
      protos: this.protos
    };
  }

  compileBlock(stmts) {
    for (const stmt of stmts) {
      this.compileStatement(stmt);
    }
  }

  compileStatement(node) {
    switch (node.type) {
      case 'LocalStatement': return this.compileLocalStatement(node);
      case 'AssignmentStatement': return this.compileAssignment(node);
      case 'IfStatement': return this.compileIf(node);
      case 'WhileStatement': return this.compileWhile(node);
      case 'NumericFor': return this.compileNumericFor(node);
      case 'GenericFor': return this.compileGenericFor(node);
      case 'RepeatStatement': return this.compileRepeat(node);
      case 'ReturnStatement': return this.compileReturn(node);
      case 'DoStatement':
        this.pushScope();
        this.compileBlock(node.body);
        this.popScope();
        return;
      case 'BreakStatement': return this.compileBreak();
      case 'FunctionStatement': return this.compileFunctionStatement(node);
      case 'LocalFunction': return this.compileLocalFunction(node);
      case 'ExpressionStatement': return this.compileExpressionStatement(node);
    }
  }

  compileLocalStatement(node) {
    for (let i = 0; i < node.values.length; i++) {
      this.compileExpression(node.values[i]);
    }
    for (let i = node.values.length; i < node.names.length; i++) {
      this.emit(OPCODES.LOAD_NIL);
    }
    for (let i = node.names.length - 1; i >= 0; i--) {
      const slot = this.declareLocal(node.names[i]);
      this.emit(OPCODES.SET_LOCAL, slot);
    }
  }

  compileAssignment(node) {
    const targets = Array.isArray(node.targets) ? node.targets : [node.targets];
    for (const val of node.values) {
      this.compileExpression(val);
    }
    for (let i = node.values.length; i < targets.length; i++) {
      this.emit(OPCODES.LOAD_NIL);
    }
    for (let i = targets.length - 1; i >= 0; i--) {
      this.compileAssignTarget(targets[i]);
    }
  }

  compileAssignTarget(target) {
    if (target.type === 'Identifier') {
      const slot = this.resolveLocal(target.name);
      if (slot !== null) {
        this.emit(OPCODES.SET_LOCAL, slot);
      } else {
        const idx = this.addConstant(target.name);
        this.emit(OPCODES.SET_GLOBAL, idx);
      }
    } else if (target.type === 'MemberExpression') {
      this.compileExpression(target.object);
      if (target.computed) {
        this.compileExpression(target.property);
      } else {
        const idx = this.addConstant(target.property);
        this.emit(OPCODES.LOAD_CONST, idx);
      }
      this.emit(OPCODES.SET_TABLE);
    }
  }

  compileIf(node) {
    this.compileExpression(node.condition);
    const jumpFalse = this.emit(OPCODES.JMP_IF_FALSE, 0);
    this.pushScope();
    this.compileBlock(node.body);
    this.popScope();
    const exits = [];
    exits.push(this.emit(OPCODES.JMP, 0));
    this.instructions[jumpFalse][1] = this.instructions.length;
    for (const ei of node.elseifs) {
      this.compileExpression(ei.condition);
      const jf = this.emit(OPCODES.JMP_IF_FALSE, 0);
      this.pushScope();
      this.compileBlock(ei.body);
      this.popScope();
      exits.push(this.emit(OPCODES.JMP, 0));
      this.instructions[jf][1] = this.instructions.length;
    }
    if (node.elseBody) {
      this.pushScope();
      this.compileBlock(node.elseBody);
      this.popScope();
    }
    for (const e of exits) {
      this.instructions[e][1] = this.instructions.length;
    }
  }

  compileWhile(node) {
    const loopStart = this.instructions.length;
    this.breakStack.push([]);
    this.compileExpression(node.condition);
    const exitJump = this.emit(OPCODES.JMP_IF_FALSE, 0);
    this.pushScope();
    this.compileBlock(node.body);
    this.popScope();
    this.emit(OPCODES.JMP, loopStart);
    this.instructions[exitJump][1] = this.instructions.length;
    const breaks = this.breakStack.pop();
    for (const b of breaks) this.instructions[b][1] = this.instructions.length;
  }

  compileRepeat(node) {
    const loopStart = this.instructions.length;
    this.breakStack.push([]);
    this.pushScope();
    this.compileBlock(node.body);
    this.compileExpression(node.condition);
    this.popScope();
    this.emit(OPCODES.JMP_IF_FALSE, loopStart);
    const breaks = this.breakStack.pop();
    for (const b of breaks) this.instructions[b][1] = this.instructions.length;
  }

  compileNumericFor(node) {
    this.pushScope();
    this.compileExpression(node.start);
    this.compileExpression(node.limit);
    if (node.step) {
      this.compileExpression(node.step);
    } else {
      this.emit(OPCODES.LOAD_CONST, this.addConstant(1));
    }
    const slot = this.declareLocal(node.name);
    const prepJump = this.emit(OPCODES.FOR_PREP, slot, 0);
    this.breakStack.push([]);
    const loopStart = this.instructions.length;
    this.compileBlock(node.body);
    const loopJump = this.emit(OPCODES.FOR_LOOP, slot, loopStart);
    this.instructions[prepJump][2] = this.instructions.length;
    const breaks = this.breakStack.pop();
    for (const b of breaks) this.instructions[b][1] = this.instructions.length;
    this.popScope();
  }

  compileGenericFor(node) {
    this.pushScope();
    for (const iter of node.iterators) {
      this.compileExpression(iter);
    }
    const slots = node.names.map(n => this.declareLocal(n));
    const prepJump = this.emit(OPCODES.ITER_PREP, slots[0], slots.length);
    this.breakStack.push([]);
    const loopStart = this.instructions.length;
    this.compileBlock(node.body);
    this.emit(OPCODES.ITER_LOOP, slots[0], loopStart);
    this.instructions[prepJump][2] = this.instructions.length;
    const breaks = this.breakStack.pop();
    for (const b of breaks) this.instructions[b][1] = this.instructions.length;
    this.popScope();
  }

  compileReturn(node) {
    for (const val of node.values) {
      this.compileExpression(val);
    }
    this.emit(OPCODES.RETURN, node.values.length);
  }

  compileBreak() {
    if (this.breakStack.length === 0) throw new Error('break outside loop');
    this.breakStack[this.breakStack.length - 1].push(this.emit(OPCODES.JMP, 0));
  }

  compileFunctionStatement(node) {
    const func = this.compileFunction(node.func);
    const protoIdx = this.protos.length;
    this.protos.push(func);
    this.emit(OPCODES.CLOSURE, protoIdx);
    const parts = node.name.split(/[.:]/);
    if (parts.length === 1) {
      const slot = this.resolveLocal(parts[0]);
      if (slot !== null) {
        this.emit(OPCODES.SET_LOCAL, slot);
      } else {
        this.emit(OPCODES.SET_GLOBAL, this.addConstant(parts[0]));
      }
    } else {
      const slot = this.resolveLocal(parts[0]);
      if (slot !== null) {
        this.emit(OPCODES.GET_LOCAL, slot);
      } else {
        this.emit(OPCODES.GET_GLOBAL, this.addConstant(parts[0]));
      }
      for (let i = 1; i < parts.length - 1; i++) {
        this.emit(OPCODES.LOAD_CONST, this.addConstant(parts[i]));
        this.emit(OPCODES.GET_TABLE);
      }
      this.emit(OPCODES.LOAD_CONST, this.addConstant(parts[parts.length - 1]));
      this.emit(OPCODES.SET_TABLE);
    }
  }

  compileLocalFunction(node) {
    const slot = this.declareLocal(node.name);
    const func = this.compileFunction(node.func);
    const protoIdx = this.protos.length;
    this.protos.push(func);
    this.emit(OPCODES.CLOSURE, protoIdx);
    this.emit(OPCODES.SET_LOCAL, slot);
  }

  compileFunction(funcNode) {
    const subCompiler = new Compiler();
    subCompiler.pushScope();
    for (const param of funcNode.params) {
      subCompiler.declareLocal(param);
    }
    subCompiler.compileBlock(funcNode.body);
    subCompiler.emit(OPCODES.RETURN, 0);
    subCompiler.popScope();
    return {
      params: funcNode.params.length,
      hasVarargs: funcNode.hasVarargs,
      constants: subCompiler.constants,
      instructions: subCompiler.instructions,
      protos: subCompiler.protos
    };
  }

  compileExpressionStatement(node) {
    this.compileExpression(node.expression);
    if (node.expression.type !== 'CallExpression' && node.expression.type !== 'MethodCall') {
      this.emit(OPCODES.POP);
    }
  }

  compileExpression(node) {
    switch (node.type) {
      case 'NumberLiteral':
        this.emit(OPCODES.LOAD_CONST, this.addConstant(node.value));
        return;
      case 'StringLiteral':
        this.emit(OPCODES.LOAD_CONST, this.addConstant(node.value));
        return;
      case 'BooleanLiteral':
        this.emit(OPCODES.LOAD_BOOL, node.value ? 1 : 0);
        return;
      case 'NilLiteral':
        this.emit(OPCODES.LOAD_NIL);
        return;
      case 'Identifier': {
        const slot = this.resolveLocal(node.name);
        if (slot !== null) {
          this.emit(OPCODES.GET_LOCAL, slot);
        } else {
          this.emit(OPCODES.GET_GLOBAL, this.addConstant(node.name));
        }
        return;
      }
      case 'BinaryExpression':
        return this.compileBinary(node);
      case 'UnaryExpression':
        return this.compileUnary(node);
      case 'CallExpression':
        return this.compileCall(node);
      case 'MethodCall':
        return this.compileMethodCall(node);
      case 'MemberExpression':
        return this.compileMemberExpression(node);
      case 'FunctionExpression': {
        const func = this.compileFunction(node);
        const protoIdx = this.protos.length;
        this.protos.push(func);
        this.emit(OPCODES.CLOSURE, protoIdx);
        return;
      }
      case 'TableConstructor':
        return this.compileTable(node);
      case 'VarargExpression':
        this.emit(OPCODES.VARARG);
        return;
    }
  }

  compileBinary(node) {
    if (node.operator === 'and') {
      this.compileExpression(node.left);
      this.emit(OPCODES.DUP);
      const jmp = this.emit(OPCODES.JMP_IF_FALSE, 0);
      this.emit(OPCODES.POP);
      this.compileExpression(node.right);
      this.instructions[jmp][1] = this.instructions.length;
      return;
    }
    if (node.operator === 'or') {
      this.compileExpression(node.left);
      this.emit(OPCODES.DUP);
      const jmp = this.emit(OPCODES.JMP_IF_TRUE, 0);
      this.emit(OPCODES.POP);
      this.compileExpression(node.right);
      this.instructions[jmp][1] = this.instructions.length;
      return;
    }
    this.compileExpression(node.left);
    this.compileExpression(node.right);
    const opMap = {
      '+': OPCODES.ADD, '-': OPCODES.SUB, '*': OPCODES.MUL,
      '/': OPCODES.DIV, '%': OPCODES.MOD, '^': OPCODES.POW,
      '..': OPCODES.CONCAT, '==': OPCODES.EQ, '<': OPCODES.LT,
      '<=': OPCODES.LE, '//': OPCODES.FLOOR_DIV
    };
    if (node.operator === '>') {
      this.emit(OPCODES.LT);
      return;
    }
    if (node.operator === '>=') {
      this.emit(OPCODES.LE);
      return;
    }
    if (node.operator === '~=') {
      this.emit(OPCODES.EQ);
      this.emit(OPCODES.NOT);
      return;
    }
    this.emit(opMap[node.operator]);
  }

  compileUnary(node) {
    this.compileExpression(node.operand);
    const opMap = { '-': OPCODES.UNM, 'not': OPCODES.NOT, '#': OPCODES.LEN };
    this.emit(opMap[node.operator]);
  }

  compileCall(node) {
    this.compileExpression(node.callee);
    for (const arg of node.args) {
      this.compileExpression(arg);
    }
    this.emit(OPCODES.CALL, node.args.length, 1);
  }

  compileMethodCall(node) {
    this.compileExpression(node.object);
    const idx = this.addConstant(node.method);
    for (const arg of node.args) {
      this.compileExpression(arg);
    }
    this.emit(OPCODES.METHOD_CALL, idx, node.args.length);
  }

  compileMemberExpression(node) {
    this.compileExpression(node.object);
    if (node.computed) {
      this.compileExpression(node.property);
    } else {
      this.emit(OPCODES.LOAD_CONST, this.addConstant(node.property));
    }
    this.emit(OPCODES.GET_TABLE);
  }

  compileTable(node) {
    this.emit(OPCODES.NEW_TABLE);
    let arrayIdx = 1;
    for (const field of node.fields) {
      if (field.type === 'NamedField') {
        this.emit(OPCODES.DUP);
        this.emit(OPCODES.LOAD_CONST, this.addConstant(field.key));
        this.compileExpression(field.value);
        this.emit(OPCODES.SET_TABLE);
      } else if (field.type === 'IndexedField') {
        this.emit(OPCODES.DUP);
        this.compileExpression(field.key);
        this.compileExpression(field.value);
        this.emit(OPCODES.SET_TABLE);
      } else {
        this.emit(OPCODES.DUP);
        this.emit(OPCODES.LOAD_CONST, this.addConstant(arrayIdx++));
        this.compileExpression(field.value);
        this.emit(OPCODES.SET_TABLE);
      }
    }
  }
}

module.exports = { Compiler, OPCODES };
