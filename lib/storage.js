const store = new Map();

function save(id, script) {
  store.set(id, { script, createdAt: Date.now() });
}

function load(id) {
  const entry = store.get(id);
  if (!entry) return null;
  return entry.script;
}

module.exports = { save, load };
