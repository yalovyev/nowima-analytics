const crypto = require('crypto');
const https = require('https');
const urllib = require('url');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const { call_id } = req.query;
  if (!call_id) { res.status(400).json({ error: 'call_id required' }); return; }

  const KEY    = process.env.REACT_APP_ZADARMA_KEY;
  const SECRET = process.env.REACT_APP_ZADARMA_SECRET;
  const params = `call_id=${encodeURIComponent(call_id)}&lifetime=1800`;
  const path   = '/v1/pbx/record/request/';
  const md5    = crypto.createHash('md5').update(params).digest('hex');
  const toSign = path + params + md5;
  const sig    = crypto.createHmac('sha1', SECRET).update(toSign).digest('base64');
  const auth   = KEY + ':' + sig;

  const url = `https://api.zadarma.com${path}?${params}`;

  try {
    const data = await new Promise((resolve, reject) => {
      const req2 = https.get(url, { headers: { Authorization: auth } }, r => {
        let body = '';
        r.on('data', d => body += d);
        r.on('end', () => { try { resolve(JSON.parse(body)); } catch(e) { reject(e); } });
      });
      req2.on('error', reject);
    });
    res.status(200).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

