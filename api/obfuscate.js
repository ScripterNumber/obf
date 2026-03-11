const { v4: uuidv4 } = require('uuid');
const { tokenize } = require('../lib/lexer');
const { Parser } = require('../lib/parser');
const { Compiler } = require('../lib/compiler');
const { generateVM } = require('../lib/vm-template');
const { save } = require('../lib/storage');

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { code } = req.body;
    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: 'No code provided' });
    }

    if (code.length > 500000) {
      return res.status(400).json({ error: 'Code too large (max 500KB)' });
    }

    const tokens = tokenize(code);
    const parser = new Parser(tokens);
    const ast = parser.parse();
    const compiler = new Compiler();
    const bytecode = compiler.compile(ast);
    const vmScript = generateVM(bytecode);

    const id = uuidv4();
    save(id, vmScript);

    const baseUrl = `https://${req.headers.host}`;

    res.status(200).json({
      id,
      url: `${baseUrl}/api/fetch?id=${id}`,
      size: vmScript.length,
      script: vmScript
    });
  } catch (err) {
    res.status(500).json({
      error: 'Compilation failed',
      details: err.message,
      position: err.pos || null
    });
  }
};
