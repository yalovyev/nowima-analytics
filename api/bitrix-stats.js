/**
 * Vercel API endpoint: /api/bitrix-stats
 * Pobiera KPI z Bitrix24 dla Vlada i Marka za podany dzień.
 * Query params: date (YYYY-MM-DD), domyślnie dziś
 */

const https = require('https');
const http_module = require('https'); // alias

const SUPABASE_URL = 'https://ufrpvnxndrjqfcudzayi.supabase.co';
const SUPABASE_KEY = 'sb_publishable_8zenverY0RlvZ8SjGCElaQ_H3xpKD6B';

function supabaseGet(path) {
  return new Promise((resolve, reject) => {
    const url = new URL(SUPABASE_URL + path);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
      },
    };
    const req = https.request(options, res => {
      let raw = '';
      res.on('data', chunk => { raw += chunk; });
      res.on('end', () => { try { resolve(JSON.parse(raw)); } catch(e) { resolve([]); } });
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('timeout')); });
    req.end();
  });
}

const BITRIX_WEBHOOK = 'https://nowima.bitrix24.pl/rest/1/vv0k0rhzmcqmv58z/';

const MANAGERS = [
  { name: 'Vladyslav Horishnyi', userId: '8994', key: 'vlad' },
  { name: 'Mark Fedorov',        userId: '8992', key: 'mark' },
  { name: 'Alona Bondarenko',    userId: '9152', key: 'alona' },
];

const ONBOARDING_PLANS = {
  calls_60s:  30,   // plan: rozmowy powyżej 60s
  emails:     12,
  oferty:      1,
  umowy:       0,
  zamowienia:  0,
};

function bitrixPost(method, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(BITRIX_WEBHOOK + method + '.json');
    const data = JSON.stringify(body);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
    };
    const req = https.request(options, res => {
      let raw = '';
      res.on('data', chunk => { raw += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(raw)); }
        catch(e) { resolve({}); }
      });
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('timeout')); });
    req.write(data);
    req.end();
  });
}

async function getStatsForManager(uid, dateFrom, dateTo) {
  const TYPE_OFERTA = '5588';
  const TYPE_UMOWA  = '5590';
  const TYPE_ZAMOWIENIE_IDS = new Set(['5592', '5594', '5596']);

  const stats = { oferty: 0, umowy: 0, zamowienia: 0, leady: 0, spotkania: 0, email_wyslane: 0, email_otrzymane: 0, calls_total: 0, calls_60s: 0 };

  try {
    // 1. Dokumenty (oferty/umowy/zamówienia)
    const docResp = await bitrixPost('crm.item.list', {
      entityTypeId: 7,
      filter: {
        assignedById: uid,
        '>=createdTime': dateFrom,
        '<=createdTime': dateTo,
      },
      select: ['id', 'ufCrm_QUOTE_1793630073653'],
    });
    const items = (docResp.result || {}).items || [];
    for (const item of items) {
      const typ = String(item.ufCrm_QUOTE_1793630073653|| '');
      if (typ === TYPE_OFERTA) stats.oferty++;
      else if (typ === TYPE_UMOWA) stats.umowy++;
      else if (TYPE_ZAMOWIENIE_IDS.has(typ)) stats.zamowienia++;
    }

    // 2. Leady
    const leadResp = await bitrixPost('crm.lead.list', {
      filter: { ASSIGNED_BY_ID: uid, '>=DATE_MODIFY': dateFrom, '<=DATE_MODIFY': dateTo },
      select: ['ID'],
    });
    stats.leady = (leadResp.result || []).length;

    // 3. Spotkania
    const meetResp = await bitrixPost('crm.activity.list', {
      filter: { RESPONSIBLE_ID: uid, TYPE_ID: 1, '>=CREATED': dateFrom, '<=CREATED': dateTo },
      select: ['ID', 'TYPE_ID', 'SUBJECT'],
    });
    const activities = meetResp.result || [];
    stats.spotkania = activities.filter(a =>
      ['spotkanie','meeting','zoom','teams','video','zapros'].some(kw => (a.SUBJECT||'').toLowerCase().includes(kw))
      || String(a.TYPE_ID) === '1'
    ).length;

    // 4. E-maile
    const mailResp = await bitrixPost('crm.activity.list', {
      filter: { RESPONSIBLE_ID: uid, TYPE_ID: 4, '>=CREATED': dateFrom, '<=CREATED': dateTo },
      select: ['ID', 'DIRECTION'],
    });
    const emails = mailResp.result || [];
    stats.email_wyslane   = emails.filter(e => String(e.DIRECTION) === '2').length;
    stats.email_otrzymane = emails.filter(e => String(e.DIRECTION) === '1').length;

  } catch(e) {
    console.error('Bitrix error for uid', uid, e.message);
  }

  return stats;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  // Parse date params (YYYY-MM-DD), default to today Warsaw time
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Warsaw' }));
  const pad = n => String(n).padStart(2, '0');
  const todayStr = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`;
  const q = req.query || {};
  const dateFrom_d = q.date_from || q.date || todayStr;
  const dateTo_d   = q.date_to   || q.date || todayStr;

  const dateFrom = `${dateFrom_d}T00:00:00`;
  const dateTo   = `${dateTo_d}T23:59:59`;

  // Pobierz rozmowy z Supabase (rzeczywiste dane Zadarma)
  const sipMap = { vlad: '130', mark: '131', alona: '116' };
  const callsFromSupabase = {};
  await Promise.all(MANAGERS.map(async ({ key }) => {
    const sip = sipMap[key];
    try {
      const rows = await supabaseGet(
        `/rest/v1/calls?select=duration&sip=eq.${sip}&call_time=gte.${dateFrom_d}T00:00:00&call_time=lte.${dateTo_d}T23:59:59&limit=1000`
      );
      const arr = Array.isArray(rows) ? rows : [];
      callsFromSupabase[key] = {
        calls_total: arr.length,
        calls_60s: arr.filter(c => parseInt(c.duration || 0, 10) >= 60).length,
      };
    } catch(e) {
      callsFromSupabase[key] = { calls_total: 0, calls_60s: 0 };
    }
  }));

  const result = { date_from: dateFrom_d, date_to: dateTo_d, plans: ONBOARDING_PLANS, managers: {} };

  await Promise.all(MANAGERS.map(async ({ name, userId, key }) => {
    const stats = await getStatsForManager(userId, dateFrom, dateTo);
    result.managers[key] = { name, ...stats, ...callsFromSupabase[key] };
  }));

  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');
  res.status(200).json(result);
};
