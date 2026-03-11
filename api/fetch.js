const { load } = require('../lib/storage');

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { id } = req.query;
  if (!id) {
    return res.status(400).send('-- No ID provided');
  }

  const script = load(id);
  if (!script) {
    return res.status(404).send('-- Script not found or expired');
  }

  res.setHeader('Content-Type', 'text/plain');
  res.status(200).send(script);
};
