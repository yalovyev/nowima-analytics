const crypto = require('crypto');
const https = require('https');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const { call_id } = req.query;
  if (!call_id) { res.status(400).json({ error: 'call_id required' }); return; }

  const KEY    = process.env.ZADARMA_KEY    || process.env.REACT_APP_ZADARMA_KEY;
  const SECRET = process.env.ZADARMA_SECRET || process.env.REACT_APP_ZADARMA_SECRET;

  if (!KEY || !SECRET) {
    res.status(500).json({ error: 'Missing env vars' });
    return;
  }

  // Must match Python SDK: sorted params including format=json
  const paramsObj = { call_id, format: 'json', lifetime: '1800' };
  const paramsString = Object.keys(paramsObj).sort()
    .map(k => k + '=' + encodeURIComponent(paramsObj[k]))
    .join('&');
  
  const path = '/v1/pbx/record/request/';
  const md5 = crypto.createHash('md5').update(paramsString).digest('hex');
  const toSign = path + paramsString + md5;
  
  // Python: hmac.new(SECRET, toSign, sha1).hexdigest() then base64 of that hex string
  const hmacHex = crypto.createHmac('sha1', SECRET).update(toSign).digest('hex');
  const sig = Buffer.from(hmacHex).toString('base64');
  const auth = KEY + ':' + sig;

  const url = `https://api.zadarma.com${path}?${paramsString}`;

  try {
    const data = await new Promise((resolve, reject) => {
      const r = https.get(url, { headers: { Authorization: auth } }, resp => {
        let body = '';
        resp.on('data', d => body += d);
        resp.on('end', () => { try { resolve(JSON.parse(body)); } catch(e) { reject(e); } });
      });
      r.on('error', reject);
    });
    res.status(200).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
