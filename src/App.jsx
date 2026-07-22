import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, parseISO, subWeeks, subMonths } from 'date-fns';

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.REACT_APP_SUPABASE_KEY || '';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const C = {
  brand:'#5A171E', brandLight:'#F4ECED', brandBorder:'rgba(90,23,30,0.15)',
  lime:'#D1E925', limeDark:'#8A9C00',
  beata:'#5A171E', kamil:'#2D6A4F',
  red:'#C0392B', redLight:'#FEF2F0', redBorder:'#F5C0BB',
  amber:'#C07A1A', amberLight:'#FEF8EC', amberBorder:'#F5D89A',
  green:'#1A7A4A', greenLight:'#EDF7F2', greenBorder:'#9AD5BC',
  blue:'#2B5BDB', blueLight:'#EEF2FF',
  bg:'#F6F4F0', surface:'#FFFFFF', surface2:'#F9F8F5',
  border:'#E8E4DC', text:'#1A1714', text2:'#6B6560', text3:'#A09890',
};

export default function App() {
  const [allData, setAllData] = useState([]);
  const [prevData, setPrevData] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [companiesLoading, setCompaniesLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('day');
  const [compareMode, setCompareMode] = useState(false);
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [showCalendar, setShowCalendar] = useState(false);
  const [mgr, setMgr] = useState('all');
  const [source, setSource] = useState('all');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [activeCall, setActiveCall] = useState(null);
  const [view, setView] = useState('calls');
  const [onboardingType, setOnboardingType] = useState('best');  // 'best' | 'worst'
  const [onboardingStart, setOnboardingStart] = useState('');
  const [onboardingEnd, setOnboardingEnd] = useState('');
  const [onboardingLimit, setOnboardingLimit] = useState(10);
  const [search, setSearch] = useState('');
  const [callTypeFilter, setCallTypeFilter] = useState('all');
  const [portfolioSearch, setPortfolioSearch] = useState('');
  const [portfolioFilter, setPortfolioFilter] = useState('all');
  const [portfolioMgr, setPortfolioMgr] = useState('all');
  const [portfolioPage, setPortfolioPage] = useState(0);
  const PAGE_SIZE = 100;

  const getRange = useCallback((offset = 0) => {
    const now = new Date();
    if (period === 'custom' && customStart && customEnd) return { start: new Date(customStart), end: new Date(customEnd + 'T23:59:59') };
    switch (period) {
      case 'day': { const d = subDays(now, offset); const s = new Date(d); s.setHours(0,0,0,0); const e = new Date(d); e.setHours(23,59,59,999); return { start: s, end: e }; }
      case 'yesterday': { const d = subDays(now, 1 + offset); const s = new Date(d); s.setHours(0,0,0,0); const e = new Date(d); e.setHours(23,59,59,999); return { start: s, end: e }; }
      case 'week': { const s = startOfWeek(subWeeks(now, offset), { weekStartsOn: 1 }); const e = endOfWeek(subWeeks(now, offset), { weekStartsOn: 1 }); return { start: s, end: e }; }
      case 'month': { const s = startOfMonth(subMonths(now, offset)); const e = endOfMonth(subMonths(now, offset)); return { start: s, end: e }; }
      default: return { start: new Date('2024-01-01'), end: now };
    }
  }, [period, customStart, customEnd]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { start, end } = getRange(0);
    const { data } = await supabase.from('calls').select('*').gte('call_time', start.toISOString()).lte('call_time', end.toISOString()).order('call_time', { ascending: false });
    setAllData(data || []);
    if (compareMode) {
      const { start: ps, end: pe } = getRange(1);
      const { data: pd } = await supabase.from('calls').select('*').gte('call_time', ps.toISOString()).lte('call_time', pe.toISOString());
      setPrevData(pd || []);
    }
    setLastUpdate(new Date());
    setLoading(false);
  }, [getRange, compareMode]);

  const fetchCompanies = useCallback(async () => {
    if (companies.length > 0) return;
    setCompaniesLoading(true);
    const { data } = await supabase.from('companies').select('*').in('manager', ['Beata Janoszka', 'Kamil Wiśniewski', 'Monika Żukiewicz']).order('ostatnia_aktywnosc', { ascending: false }).limit(5000);
    setCompanies(data || []);
    setCompaniesLoading(false);
  }, [companies.length]);

  useEffect(() => { fetchData(); const i = setInterval(fetchData, 5 * 60 * 1000); return () => clearInterval(i); }, [fetchData]);
  useEffect(() => { if (view === 'portfolio') fetchCompanies(); }, [view, fetchCompanies]);

  // Filtered calls by manager + source
  const calls = useMemo(() => {
    let d = allData;
    if (mgr === 'beata') d = d.filter(c => c.sip === '123' || c.manager === 'Beata Janoszka');
    if (mgr === 'kamil') d = d.filter(c => c.sip === '119' || c.manager === 'Kamil Wisniewski' || c.manager === 'Kamil Wiśniewski');
    if (source === 'calls') d = d.filter(c => c.sip !== 'meeting');
    if (source === 'meetings') d = d.filter(c => c.sip === 'meeting');
    return d;
  }, [allData, mgr, source]);

  const phoneCalls = useMemo(() => calls.filter(c => c.sip !== 'meeting'), [calls]);
  const meetings = useMemo(() => calls.filter(c => c.sip === 'meeting'), [calls]);
  const over60 = useMemo(() => phoneCalls.filter(c => c.duration > 60), [phoneCalls]);
  const lprCalls = useMemo(() => phoneCalls.filter(c => c.lpr), [phoneCalls]);
  const hot = useMemo(() => calls.filter(c => c.wynik === 'gorący lead'), [calls]);
  const pilne = useMemo(() => calls.filter(c => c.pilne), [calls]);
  const bots = useMemo(() => phoneCalls.filter(c => c.typ_rozmowy === 'bot_niedozwon' || c.wynik === 'bot/automat'), [phoneCalls]);

  // Filtered list for call view
  const filtered = useMemo(() => {
    let d = calls;
    if (search) d = d.filter(c => (c.klient || '').toLowerCase().includes(search.toLowerCase()) || (c.manager || '').toLowerCase().includes(search.toLowerCase()));
    if (callTypeFilter !== 'all') {
      if (callTypeFilter === 'hot') d = d.filter(c => c.wynik === 'gorący lead');
      else if (callTypeFilter === 'lpr') d = d.filter(c => c.lpr);
      else if (callTypeFilter === 'pilne') d = d.filter(c => c.pilne);
      else d = d.filter(c => c.typ_rozmowy === callTypeFilter);
    }
    return d;
  }, [calls, search, callTypeFilter]);

  // Portfolio
  const filteredCompanies = useMemo(() => {
    let d = portfolioMgr === 'all' ? companies : companies.filter(c => c.manager === portfolioMgr);
    if (portfolioSearch) d = d.filter(c => (c.nazwa || '').toLowerCase().includes(portfolioSearch.toLowerCase()));
    if (portfolioFilter !== 'all') d = d.filter(c => c.potencjal === portfolioFilter);
    return d;
  }, [companies, portfolioMgr, portfolioSearch, portfolioFilter]);

  const pagedCompanies = useMemo(() => filteredCompanies.slice(portfolioPage * PAGE_SIZE, (portfolioPage + 1) * PAGE_SIZE), [filteredCompanies, portfolioPage]);
  const totalPortfolioPages = Math.ceil(filteredCompanies.length / PAGE_SIZE);

  // Stats
  // Onboarding calls
  const onboardingCalls = useMemo(() => {
    let d = allData.filter(c => c.sip !== 'meeting' && c.typ_rozmowy && !['bot_niedozwon','operacyjny'].includes(c.typ_rozmowy) && c.wynik_procentowy != null && c.transcript);
    if (onboardingStart) d = d.filter(c => c.call_time >= onboardingStart);
    if (onboardingEnd) d = d.filter(c => c.call_time <= onboardingEnd + 'T23:59:59');
    if (mgr === 'beata') d = d.filter(c => c.sip === '123' || c.manager === 'Beata Janoszka');
    if (mgr === 'kamil') d = d.filter(c => c.sip === '119' || c.manager === 'Kamil Wisniewski' || c.manager === 'Kamil Wiśniewski');
    if (onboardingType === 'best') {
      return [...d].sort((a,b) => b.wynik_procentowy - a.wynik_procentowy).slice(0, onboardingLimit);
    } else {
      return [...d].sort((a,b) => a.wynik_procentowy - b.wynik_procentowy).slice(0, onboardingLimit);
    }
  }, [allData, onboardingType, onboardingStart, onboardingEnd, onboardingLimit, mgr]);

  const beataPhone = phoneCalls.filter(c => c.sip === '123' || c.manager === 'Beata Janoszka');
  const kamilPhone = phoneCalls.filter(c => c.sip === '119' || c.manager === 'Kamil Wisniewski' || c.manager === 'Kamil Wiśniewski');

  const avgPct = (arr) => { const v = arr.filter(c => c.wynik_procentowy != null).map(c => c.wynik_procentowy); return v.length ? Math.round(v.reduce((a,b)=>a+b,0)/v.length) : null; };

  const typStats = useMemo(() => {
    const types = ['zimny_telefon','sekretariat','kontakt_z_lpr','followup_po_materialach','followup_bez_materialow'];
    const labels = { zimny_telefon:'❄️ Zimny', sekretariat:'📋 Sekretariat', kontakt_z_lpr:'🎯 Z ŁPR', followup_po_materialach:'📨 Follow-up z mat.', followup_bez_materialow:'🔄 Follow-up' };
    return types.map(typ => {
      const arr = phoneCalls.filter(c => c.typ_rozmowy === typ);
      const sukces = arr.filter(c => c.sukces_wg_kryteriow).length;
      const avg = avgPct(arr);
      return { typ, label: labels[typ], total: arr.length, sukces, avg };
    }).filter(t => t.total > 0);
  }, [phoneCalls]);

  const repeatedErrors = useMemo(() => {
    const errors = {};
    phoneCalls.forEach(c => {
      if (!c.do_poprawy) return;
      const key = c.do_poprawy.substring(0, 60);
      errors[key] = (errors[key] || 0) + 1;
    });
    return Object.entries(errors).filter(([,v]) => v > 1).sort((a,b)=>b[1]-a[1]).slice(0, 5);
  }, [phoneCalls]);

  const exportOnboardingCSV = () => {
    const h = ['#','Data','Menedżer','Klient','%','Typ','Wynik','Akcja','Do poprawy','Bitrix'];
    const rows = onboardingCalls.map((c,i) => [
      i+1,
      c.call_time ? format(parseISO(c.call_time),'dd.MM.yyyy HH:mm') : '',
      c.manager, c.klient||'', c.wynik_procentowy||'',
      c.typ_rozmowy||'', c.wynik||'', c.akcja||'', c.do_poprawy||'', c.bitrix_url||''
    ]);
    const csv = [h,...rows].map(r=>r.join(';')).join('\n');
    const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `nowima_top_${onboardingType}_${format(new Date(),'yyyy-MM-dd')}.csv`; a.click();
  };

  const exportCSV = () => {
    const h = ['Data','Menedżer','Klient','Czas','ŁPR','Wynik','%','Typ','Akcja'];
    const rows = filtered.map(c => [c.call_time ? format(parseISO(c.call_time),'dd.MM.yyyy HH:mm') : '', c.manager, c.klient||'', c.duration, c.lpr?'TAK':'NIE', c.wynik||'', c.wynik_procentowy||'', c.typ_rozmowy||'', c.akcja||'']);
    const csv = [h,...rows].map(r=>r.join(';')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `nowima_${format(new Date(),'yyyy-MM-dd')}.csv`; a.click();
  };

  const periodLabel = { day:'Dziś', yesterday:'Wczoraj', week:'Tydzień', month:'Miesiąc', all:'Wszystko', custom:'Własny' };

  const stageColor = { 'Contract':C.green, 'Finalization':C.green, 'Offer':C.amber, 'Demand':C.blue, 'Rezerwa na przyszłość':C.text3 };

  return (
    <div style={{ fontFamily:"'DM Sans',sans-serif", background:C.bg, minHeight:'100vh', color:C.text }}>
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=DM+Sans:wght@300;400;500&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet"/>

      {/* SIDEBAR */}
      {sidebarOpen && (
        <div style={{ position:'fixed', inset:0, zIndex:200 }} onClick={() => setSidebarOpen(false)}>
          <div style={{ position:'absolute', left:0, top:0, bottom:0, width:260, background:C.surface, borderRight:`1px solid ${C.border}`, boxShadow:'4px 0 24px rgba(0,0,0,0.12)', padding:'24px 0' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding:'0 20px 20px', borderBottom:`1px solid ${C.border}` }}>
              <div style={{ fontFamily:'Outfit', fontWeight:700, fontSize:13, color:C.brand, letterSpacing:1, marginBottom:16 }}>NOWIMA</div>
              <div style={{ fontSize:10, fontFamily:'DM Mono', textTransform:'uppercase', color:C.text3, marginBottom:10, letterSpacing:'0.08em' }}>Źródło danych</div>
              {[['all','📊 Wszystko','Rozmowy + Spotkania'],['calls','📞 Rozmowy','Tylko telefony'],['meetings','🎥 Spotkania','Tylko wideo']].map(([s,label,desc]) => (
                <div key={s} onClick={() => { setSource(s); setSidebarOpen(false); }} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', borderRadius:8, marginBottom:4, cursor:'pointer', background:source===s ? C.brandLight : 'transparent', border:`1px solid ${source===s ? C.brandBorder : 'transparent'}` }}>
                  <div style={{ fontSize:14 }}>{label.split(' ')[0]}</div>
                  <div>
                    <div style={{ fontSize:12, fontWeight:500, color:source===s ? C.brand : C.text }}>{label}</div>
                    <div style={{ fontSize:10, color:C.text3, fontFamily:'DM Mono' }}>{desc}</div>
                  </div>
                  {source===s && <div style={{ marginLeft:'auto', color:C.brand, fontSize:12 }}>✓</div>}
                </div>
              ))}
            </div>
            <div style={{ padding:'20px' }}>
              <div style={{ fontSize:10, fontFamily:'DM Mono', textTransform:'uppercase', color:C.text3, marginBottom:10, letterSpacing:'0.08em' }}>Widok</div>
              {[['calls','📞 Rozmowy'],['onboarding','⭐ TOP'],['portfolio','🏢 Portfel firm']].map(([v,label]) => (
                <div key={v} onClick={() => { setView(v); setSidebarOpen(false); }} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', borderRadius:8, marginBottom:4, cursor:'pointer', background:view===v ? C.brandLight : 'transparent', border:`1px solid ${view===v ? C.brandBorder : 'transparent'}` }}>
                  <div style={{ fontSize:12, fontWeight:500, color:view===v ? C.brand : C.text }}>{label}</div>
                  {view===v && <div style={{ marginLeft:'auto', color:C.brand, fontSize:12 }}>✓</div>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* HEADER */}
      <header style={{ background:C.brand, position:'sticky', top:0, zIndex:100, boxShadow:'0 2px 12px rgba(90,23,30,0.3)' }}>
        <div style={{ maxWidth:1440, margin:'0 auto', padding:'0 16px', minHeight:52, display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>

          {/* Sidebar toggle */}
          <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{ display:'flex', flexDirection:'column', gap:3.5, padding:'7px 8px', borderRadius:6, border:'1px solid rgba(255,255,255,0.2)', background:sidebarOpen?'rgba(209,233,37,0.15)':'transparent', cursor:'pointer' }}>
            <div style={{ width:16, height:2, background:C.lime, borderRadius:1 }}/>
            <div style={{ width:16, height:2, background:C.lime, borderRadius:1 }}/>
            <div style={{ width:16, height:2, background:C.lime, borderRadius:1 }}/>
          </button>

          <div style={{ fontFamily:'Outfit', fontWeight:800, fontSize:14, color:C.lime, letterSpacing:1 }}>NOWIMA</div>

          <div style={{ width:1, height:20, background:'rgba(255,255,255,0.15)', margin:'0 4px' }}/>

          {/* Manager filter */}
          <div style={{ display:'flex', gap:3 }}>
            {[['all','Wszyscy'],['beata','Beata'],['kamil','Kamil']].map(([m,l]) => (
              <button key={m} onClick={() => setMgr(m)} style={{ padding:'4px 12px', borderRadius:20, border:`1px solid`, cursor:'pointer', fontSize:11, fontFamily:'DM Mono', borderColor:mgr===m?C.lime:'rgba(255,255,255,0.2)', background:mgr===m?'rgba(209,233,37,0.15)':'transparent', color:mgr===m?C.lime:'rgba(255,255,255,0.65)' }}>{l}</button>
            ))}
          </div>

          <div style={{ width:1, height:20, background:'rgba(255,255,255,0.15)', margin:'0 4px' }}/>

          {/* Period filter */}
          <div style={{ display:'flex', gap:3, flexWrap:'wrap' }}>
            {[['day','Dziś'],['yesterday','Wczoraj'],['week','Tydzień'],['month','Miesiąc'],['all','Wszystko']].map(([p,l]) => (
              <button key={p} onClick={() => { setPeriod(p); setShowCalendar(false); }} style={{ padding:'4px 10px', borderRadius:20, border:'1px solid', cursor:'pointer', fontSize:11, fontFamily:'DM Mono', borderColor:period===p?C.lime:'rgba(255,255,255,0.2)', background:period===p?'rgba(209,233,37,0.15)':'transparent', color:period===p?C.lime:'rgba(255,255,255,0.65)' }}>{l}</button>
            ))}
            <div style={{ position:'relative' }}>
              <button onClick={() => { setPeriod('custom'); setShowCalendar(!showCalendar); }} style={{ padding:'4px 10px', borderRadius:20, border:'1px solid', cursor:'pointer', fontSize:11, fontFamily:'DM Mono', borderColor:period==='custom'?C.lime:'rgba(255,255,255,0.2)', background:period==='custom'?'rgba(209,233,37,0.15)':'transparent', color:period==='custom'?C.lime:'rgba(255,255,255,0.65)' }}>📅</button>
              {showCalendar && (
                <div style={{ position:'absolute', top:36, left:0, background:C.surface, border:`1px solid ${C.border}`, borderRadius:10, padding:16, zIndex:9999, boxShadow:'0 8px 24px rgba(0,0,0,0.15)', minWidth:260 }}>
                  <div style={{ fontSize:11, fontFamily:'DM Mono', color:C.text3, marginBottom:8, textTransform:'uppercase' }}>Zakres dat</div>
                  <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                    <div><div style={{ fontSize:11, color:C.text3, marginBottom:4 }}>Od:</div><input type="date" value={customStart} onChange={e=>setCustomStart(e.target.value)} style={{ width:'100%', padding:'8px 10px', borderRadius:6, border:`1px solid ${C.border}`, fontSize:13, outline:'none', boxSizing:'border-box' }}/></div>
                    <div><div style={{ fontSize:11, color:C.text3, marginBottom:4 }}>Do:</div><input type="date" value={customEnd} onChange={e=>setCustomEnd(e.target.value)} style={{ width:'100%', padding:'8px 10px', borderRadius:6, border:`1px solid ${C.border}`, fontSize:13, outline:'none', boxSizing:'border-box' }}/></div>
                    <button onClick={() => setShowCalendar(false)} style={{ padding:'8px', borderRadius:6, background:C.brand, color:'white', border:'none', cursor:'pointer', fontSize:12 }}>✓ Zastosuj</button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Compare toggle */}
          <button onClick={() => setCompareMode(!compareMode)} style={{ padding:'4px 10px', borderRadius:20, border:'1px solid', cursor:'pointer', fontSize:11, fontFamily:'DM Mono', borderColor:compareMode?C.lime:'rgba(255,255,255,0.2)', background:compareMode?'rgba(209,233,37,0.15)':'transparent', color:compareMode?C.lime:'rgba(255,255,255,0.65)' }}>
            {compareMode ? '⚡ Porównanie ON' : '⚡ Porównaj'}
          </button>

          <div style={{ marginLeft:'auto', display:'flex', gap:8, alignItems:'center' }}>
            {hot.length > 0 && <span style={{ fontSize:11, padding:'3px 8px', borderRadius:20, border:`1px solid ${C.lime}`, color:C.lime, background:'rgba(209,233,37,0.1)', fontFamily:'DM Mono' }}>🔥 {hot.length}</span>}
            {pilne.filter(c=>c.wynik!=='gorący lead').length > 0 && <span style={{ fontSize:11, padding:'3px 8px', borderRadius:20, border:'1px solid #F5D89A', color:'#C07A1A', background:'rgba(192,122,26,0.1)', fontFamily:'DM Mono' }}>⚠️ {pilne.filter(c=>c.wynik!=='gorący lead').length}</span>}
            <button onClick={exportCSV} style={{ padding:'4px 10px', borderRadius:20, border:'1px solid rgba(255,255,255,0.2)', background:'transparent', color:'rgba(255,255,255,0.6)', fontSize:11, fontFamily:'DM Mono', cursor:'pointer' }}>⬇ CSV</button>
            <span style={{ fontSize:10, color:'rgba(255,255,255,0.3)', fontFamily:'DM Mono' }}>↻ {format(lastUpdate,'HH:mm')}</span>
          </div>
        </div>
      </header>

      <div style={{ maxWidth:1440, margin:'0 auto', padding:'24px 16px 80px' }}>
        {loading ? (
          <div style={{ textAlign:'center', padding:80, color:C.text3, fontFamily:'DM Mono' }}>⏳ Ładowanie...</div>
        ) : (
          <>
            {/* ── CALLS VIEW ── */}
            {view === 'calls' && (
              <>
                {/* KPI row */}
                <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:12, marginBottom:24 }}>
                  <KpiCard label="Wszystkie rozmowy" value={phoneCalls.length} accent={C.brand} sub={`${bots.length} botów/niedozwon`}/>
                  <KpiCard label="Powyżej 60s" value={over60.length} accent={C.amber} sub={`${phoneCalls.length > 0 ? Math.round(over60.length/phoneCalls.length*100) : 0}% wszystkich`}/>
                  <KpiCard label="Z ŁPR" value={lprCalls.length} good accent={C.green} sub={`${over60.length > 0 ? Math.round(lprCalls.length/over60.length*100) : 0}% z rozmów 60s+`}/>
                  <KpiCard label="Gorące leady" value={hot.length} accent={C.red} sub="gorący lead" good={hot.length>0}/>
                  <KpiCard label="Śr. ocena" value={avgPct(phoneCalls) != null ? avgPct(phoneCalls)+'%' : '—'} accent={C.blue} sub="wynik procentowy"/>
                </div>

                {/* Manager comparison */}
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:24 }}>
                  <MgrSummary name="Beata Janoszka" calls={beataPhone} color={C.beata}/>
                  <MgrSummary name="Kamil Wisniewski" calls={kamilPhone} color={C.kamil}/>
                </div>

                {/* Type breakdown */}
                {typStats.length > 0 && (
                  <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, overflow:'hidden', marginBottom:24 }}>
                    <div style={{ padding:'14px 20px', borderBottom:`1px solid ${C.border}`, display:'flex', alignItems:'center', gap:8 }}>
                      <span style={{ fontFamily:'Outfit', fontWeight:700, fontSize:12, textTransform:'uppercase', letterSpacing:'0.1em', color:C.brand }}>Wg typu rozmowy</span>
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))' }}>
                      {typStats.map((t,i) => (
                        <div key={t.typ} style={{ padding:'16px 20px', borderRight:i<typStats.length-1?`1px solid ${C.border}`:'none' }}>
                          <div style={{ fontSize:11, fontFamily:'DM Mono', color:C.text3, marginBottom:6 }}>{t.label}</div>
                          <div style={{ fontFamily:'Outfit', fontWeight:700, fontSize:28, color:C.text, lineHeight:1 }}>{t.total}</div>
                          <div style={{ display:'flex', gap:8, marginTop:6, alignItems:'center' }}>
                            <span style={{ fontSize:10, fontFamily:'DM Mono', color:C.green }}>✓ {t.sukces}</span>
                            {t.avg != null && <span style={{ fontSize:10, fontFamily:'DM Mono', color:C.text3 }}>śr. {t.avg}%</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Repeated errors */}
                {repeatedErrors.length > 0 && (
                  <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, marginBottom:24, overflow:'hidden' }}>
                    <div style={{ padding:'14px 20px', borderBottom:`1px solid ${C.border}` }}>
                      <span style={{ fontFamily:'Outfit', fontWeight:700, fontSize:12, textTransform:'uppercase', letterSpacing:'0.1em', color:C.red }}>📉 Powtarzające się błędy</span>
                    </div>
                    <div style={{ padding:'4px 0' }}>
                      {repeatedErrors.map(([err, cnt]) => (
                        <div key={err} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 20px', borderBottom:`1px solid ${C.border}` }}>
                          <div style={{ background:C.redLight, color:C.red, border:`1px solid ${C.redBorder}`, borderRadius:20, padding:'2px 8px', fontSize:10, fontFamily:'DM Mono', minWidth:28, textAlign:'center' }}>{cnt}×</div>
                          <div style={{ fontSize:12, color:C.text2, flex:1 }}>{err}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Hot leads */}
                {[...hot, ...pilne.filter(c=>c.wynik!=='gorący lead')].length > 0 && (
                  <div style={{ marginBottom:24 }}>
                    <SectionHeader icon="🔥" title="Gorące leady i pilne działania" badge={[...hot,...pilne.filter(c=>c.wynik!=='gorący lead')].length}/>
                    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                      {[...hot,...pilne.filter(c=>c.wynik!=='gorący lead')].map(c => (
                        <LeadCard key={c.id} call={c} onOpen={() => setActiveCall(c.id)}/>
                      ))}
                    </div>
                  </div>
                )}

                {/* Meetings */}
                {meetings.length > 0 && (
                  <div style={{ marginBottom:24 }}>
                    <SectionHeader icon="🎥" title="Spotkania wideo" badge={meetings.length}/>
                    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                      {meetings.map(m => <MeetingCard key={m.id} meeting={m} isOpen={activeCall===m.id} onToggle={() => setActiveCall(activeCall===m.id?null:m.id)}/>)}
                    </div>
                  </div>
                )}

                {/* Call list */}
                <div>
                  <div style={{ display:'flex', gap:10, marginBottom:14, flexWrap:'wrap', alignItems:'center' }}>
                    <SectionHeader icon="📞" title="Lista rozmów" badge={filtered.length}/>
                    <div style={{ display:'flex', gap:6, marginLeft:'auto', flexWrap:'wrap' }}>
                      <input type="text" placeholder="🔍 Szukaj klienta..." value={search} onChange={e=>setSearch(e.target.value)} style={{ padding:'7px 14px', borderRadius:20, border:`1px solid ${C.border}`, background:C.surface, fontSize:12, fontFamily:'DM Sans', outline:'none', minWidth:200 }}/>
                      <select value={callTypeFilter} onChange={e=>setCallTypeFilter(e.target.value)} style={{ padding:'7px 12px', borderRadius:20, border:`1px solid ${C.border}`, background:C.surface, fontSize:12, fontFamily:'DM Mono', outline:'none', cursor:'pointer' }}>
                        <option value="all">Wszystkie typy</option>
                        <option value="hot">🔥 Gorące leady</option>
                        <option value="lpr">🎯 Z ŁPR</option>
                        <option value="pilne">⚠️ Pilne</option>
                        <option value="zimny_telefon">❄️ Zimne telefony</option>
                        <option value="sekretariat">📋 Sekretariat</option>
                        <option value="kontakt_z_lpr">🎯 Kontakt z ŁPR</option>
                        <option value="followup_po_materialach">📨 Follow-up z mat.</option>
                        <option value="followup_bez_materialow">🔄 Follow-up</option>
                        <option value="operacyjny">⚙️ Operacyjne</option>
                        <option value="bot_niedozwon">🤖 Bot/niedozwon</option>
                      </select>
                    </div>
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                    {filtered.map(call => (
                      call.sip === 'meeting'
                        ? <MeetingCard key={call.id} meeting={call} isOpen={activeCall===call.id} onToggle={() => setActiveCall(activeCall===call.id?null:call.id)}/>
                        : <CallDetail key={call.id} call={call} isOpen={activeCall===call.id} onToggle={() => setActiveCall(activeCall===call.id?null:call.id)}/>
                    ))}
                    {filtered.length === 0 && <div style={{ textAlign:'center', padding:40, color:C.text3, fontFamily:'DM Mono', fontSize:13 }}>Brak rozmów spełniających kryteria</div>}
                  </div>
                </div>
              </>
            )}

            {/* ── ONBOARDING VIEW ── */}
            {view === 'onboarding' && (
              <>
                <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:'20px',marginBottom:24}}>
                  <div style={{fontFamily:'Outfit',fontWeight:700,fontSize:13,textTransform:'uppercase',letterSpacing:'0.1em',color:C.brand,marginBottom:16}}>⭐ TOP + i TOP — najlepsze i najsłabsze rozmowy</div>
                  
                  {/* Type selector */}
                  <div style={{display:'flex',gap:8,marginBottom:16,flexWrap:'wrap'}}>
                    <button onClick={()=>setOnboardingType('best')} style={{padding:'8px 20px',borderRadius:8,border:`1px solid ${onboardingType==='best'?C.green:C.border}`,background:onboardingType==='best'?C.greenLight:C.surface,color:onboardingType==='best'?C.green:C.text2,cursor:'pointer',fontFamily:'DM Mono',fontSize:12,fontWeight:600}}>
                      ⭐ TOP +
                    </button>
                    <button onClick={()=>setOnboardingType('worst')} style={{padding:'8px 20px',borderRadius:8,border:`1px solid ${onboardingType==='worst'?C.red:C.border}`,background:onboardingType==='worst'?C.redLight:C.surface,color:onboardingType==='worst'?C.red:C.text2,cursor:'pointer',fontFamily:'DM Mono',fontSize:12,fontWeight:600}}>
                      📉 TOP —
                    </button>
                  </div>

                  {/* Filters */}
                  <div style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'flex-end'}}>
                    <div>
                      <div style={{fontSize:11,color:C.text3,fontFamily:'DM Mono',marginBottom:4}}>Od:</div>
                      <input type="date" value={onboardingStart} onChange={e=>setOnboardingStart(e.target.value)} style={{padding:'7px 10px',borderRadius:8,border:`1px solid ${C.border}`,fontSize:12,outline:'none',background:C.surface}}/>
                    </div>
                    <div>
                      <div style={{fontSize:11,color:C.text3,fontFamily:'DM Mono',marginBottom:4}}>Do:</div>
                      <input type="date" value={onboardingEnd} onChange={e=>setOnboardingEnd(e.target.value)} style={{padding:'7px 10px',borderRadius:8,border:`1px solid ${C.border}`,fontSize:12,outline:'none',background:C.surface}}/>
                    </div>
                    <div>
                      <div style={{fontSize:11,color:C.text3,fontFamily:'DM Mono',marginBottom:4}}>Liczba:</div>
                      <select value={onboardingLimit} onChange={e=>setOnboardingLimit(Number(e.target.value))} style={{padding:'7px 10px',borderRadius:8,border:`1px solid ${C.border}`,fontSize:12,outline:'none',background:C.surface,cursor:'pointer'}}>
                        {[5,10,15,20].map(n=><option key={n} value={n}>{n} rozmów</option>)}
                      </select>
                    </div>
                    <button onClick={()=>{setOnboardingStart('');setOnboardingEnd('');}} style={{padding:'7px 14px',borderRadius:8,border:`1px solid ${C.border}`,background:C.surface,color:C.text3,cursor:'pointer',fontSize:12,fontFamily:'DM Mono'}}>✕ Reset</button>
                    <button onClick={exportOnboardingCSV} style={{padding:'7px 16px',borderRadius:8,border:`1px solid ${C.brand}`,background:C.brandLight,color:C.brand,cursor:'pointer',fontSize:12,fontFamily:'DM Mono',fontWeight:600,marginLeft:'auto'}}>⬇ Eksportuj CSV</button>
                  </div>
                </div>

                {/* Results */}
                <div style={{marginBottom:12,display:'flex',alignItems:'center',gap:8}}>
                  <span style={{fontFamily:'Outfit',fontWeight:700,fontSize:11,textTransform:'uppercase',letterSpacing:'0.1em',color:onboardingType==='best'?C.green:C.red}}>
                    {onboardingType==='best'?'⭐ TOP +':'📉 TOP —'} {onboardingCalls.length} rozmów
                  </span>
                  {(onboardingStart||onboardingEnd)&&<span style={{fontSize:11,color:C.text3,fontFamily:'DM Mono'}}>{onboardingStart||'...'} — {onboardingEnd||'...'}</span>}
                </div>

                <div style={{display:'flex',flexDirection:'column',gap:8}}>
                  {onboardingCalls.map((call,i) => {
                    const pct = call.wynik_procentowy;
                    const mgr2 = call.sip==='123'||call.manager==='Beata Janoszka'?'Beata':'Kamil';
                    const mgrColor2 = mgr2==='Beata'?C.beata:C.kamil;
                    const typ = call.typ_rozmowy;
                    const typEmoji = {zimny_telefon:'❄️',sekretariat:'📋',kontakt_z_lpr:'🎯',followup_po_materialach:'📨',followup_bez_materialow:'🔄'}[typ]||'📞';
                    const pctColor = pct>=70?C.green:pct>=40?C.amber:C.red;
                    return(
                      <div key={call.id} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,overflow:'hidden',borderLeft:`4px solid ${pctColor}`}}>
                        <div style={{display:'grid',gridTemplateColumns:'32px 1fr auto auto auto',alignItems:'center',gap:10,padding:'12px 16px'}}>
                          <div style={{fontFamily:'Outfit',fontWeight:800,fontSize:18,color:pctColor,lineHeight:1}}>{i+1}</div>
                          <div>
                            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:3}}>
                              <span style={{fontSize:13,fontWeight:600}}>{call.klient||'—'}</span>
                              <span style={{fontSize:11,color:mgrColor2,fontFamily:'DM Mono',fontWeight:600}}>{mgr2}</span>
                              <span style={{fontSize:11,color:C.text3,fontFamily:'DM Mono'}}>{call.call_time?format(parseISO(call.call_time),'dd.MM.yyyy HH:mm'):''}</span>
                              <span style={{fontSize:11}}>{typEmoji} {typ?.replace(/_/g,' ')}</span>
                            </div>
                            {call.akcja&&<div style={{fontSize:12,color:onboardingType==='best'?C.green:C.red,lineHeight:1.4}}>→ {call.akcja}</div>}
                            {call.do_poprawy&&onboardingType==='worst'&&<div style={{fontSize:12,color:C.amber,lineHeight:1.4,marginTop:3}}>📈 {call.do_poprawy}</div>}
                          </div>
                          <div style={{textAlign:'center'}}>
                            <div style={{fontFamily:'Outfit',fontWeight:800,fontSize:24,color:pctColor,lineHeight:1}}>{pct}%</div>
                            <div style={{fontSize:10,color:C.text3,fontFamily:'DM Mono'}}>{call.wynik||''}</div>
                          </div>
                          <div style={{display:'flex',flexDirection:'column',gap:4,alignItems:'flex-end'}}>
                            {call.bitrix_url&&<a href={call.bitrix_url} target="_blank" rel="noreferrer" style={{fontSize:11,color:C.brand,fontFamily:'DM Mono',textDecoration:'none',padding:'3px 8px',borderRadius:4,border:`1px solid ${C.brandBorder}`,background:C.brandLight}}>Bitrix →</a>}
                          </div>
                          <div style={{color:C.text3,fontSize:12,cursor:'pointer'}} onClick={()=>setActiveCall(activeCall===call.id?null:call.id)}>▼</div>
                        </div>
                        {activeCall===call.id&&(
                          <div style={{borderTop:`1px solid ${C.border}`,padding:'14px 18px',background:C.surface2}}>
                            {call.cytat_klienta&&<div style={{fontSize:12,color:C.text2,fontStyle:'italic',marginBottom:8}}>💬 "{call.cytat_klienta}"</div>}
                            {call.obiekcja&&<div style={{fontSize:12,color:C.red,marginBottom:6}}>🛑 {call.obiekcja}</div>}
                            {call.powod_sukcesu&&<div style={{fontSize:12,color:C.text2,marginBottom:8,lineHeight:1.5}}>{call.powod_sukcesu}</div>}
                            {call.transcript&&(
                              <div style={{fontSize:11,color:C.text3,lineHeight:1.7,background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:'10px 14px',maxHeight:200,overflowY:'auto',fontFamily:'DM Mono',whiteSpace:'pre-wrap'}}>{(call.dialog||call.transcript).substring(0,600)}...</div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {onboardingCalls.length===0&&<div style={{textAlign:'center',padding:40,color:C.text3,fontFamily:'DM Mono'}}>Brak rozmów spełniających kryteria</div>}
                </div>
              </>
            )}

            {/* ── PORTFOLIO VIEW ── */}
            {view === 'portfolio' && (
              <>
                <div style={{ display:'flex', gap:8, marginBottom:20, flexWrap:'wrap', alignItems:'center' }}>
                  {[['all','👥 Wszyscy',companies.length],['Beata Janoszka','Beata',companies.filter(c=>c.manager==='Beata Janoszka').length],['Kamil Wiśniewski','Kamil',companies.filter(c=>c.manager==='Kamil Wiśniewski').length],['Monika Żukiewicz','Monika',companies.filter(c=>c.manager==='Monika Żukiewicz').length]].map(([m,l,cnt]) => (
                    <button key={m} onClick={() => setPortfolioMgr(m)} style={{ padding:'7px 14px', borderRadius:10, border:`1px solid ${portfolioMgr===m?C.brand:C.border}`, background:portfolioMgr===m?C.brandLight:C.surface, color:portfolioMgr===m?C.brand:C.text2, fontSize:12, cursor:'pointer', fontFamily:'DM Mono', display:'flex', alignItems:'center', gap:6 }}>
                      {l} <span style={{ fontSize:10, padding:'1px 6px', borderRadius:10, background:portfolioMgr===m?C.brand+'22':'#E8E4DC', color:portfolioMgr===m?C.brand:C.text3 }}>{cnt}</span>
                    </button>
                  ))}
                  <div style={{ marginLeft:'auto', display:'flex', gap:8 }}>
                    <input type="text" placeholder="🔍 Szukaj firmy..." value={portfolioSearch} onChange={e=>setPortfolioSearch(e.target.value)} style={{ padding:'7px 14px', borderRadius:20, border:`1px solid ${C.border}`, background:C.surface, fontSize:12, outline:'none', minWidth:200 }}/>
                    <select value={portfolioFilter} onChange={e=>setPortfolioFilter(e.target.value)} style={{ padding:'7px 12px', borderRadius:20, border:`1px solid ${C.border}`, background:C.surface, fontSize:12, fontFamily:'DM Mono', outline:'none', cursor:'pointer' }}>
                      <option value="all">Wszystkie</option>
                      <option value="wysoki">🟢 Wysoki</option>
                      <option value="średni">🟡 Średni</option>
                      <option value="niski">⚪ Niski</option>
                    </select>
                  </div>
                </div>

                <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:12, marginBottom:24 }}>
                  {[{stage:'Contract',col:C.green},{stage:'Finalization',col:C.green},{stage:'Offer',col:C.amber},{stage:'Demand',col:C.blue},{stage:'Rezerwa na przyszłość',col:C.text3,label:'Rezerwa'}].map(s => {
                    const base = portfolioMgr==='all'?companies:companies.filter(c=>c.manager===portfolioMgr);
                    return (
                      <div key={s.stage} style={{ background:C.surface, border:`1px solid ${C.border}`, borderTop:`3px solid ${s.col}`, borderRadius:12, padding:'14px 16px' }}>
                        <div style={{ fontSize:10, fontFamily:'DM Mono', textTransform:'uppercase', color:C.text3, marginBottom:6 }}>{s.label||s.stage}</div>
                        <div style={{ fontFamily:'Outfit', fontWeight:700, fontSize:28, color:s.col }}>{base.filter(c=>c.stage===s.stage).length}</div>
                      </div>
                    );
                  })}
                </div>

                {companiesLoading ? (
                  <div style={{ textAlign:'center', padding:40, color:C.text3, fontFamily:'DM Mono' }}>⏳ Ładowanie portfela...</div>
                ) : (
                  <>
                    <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, overflow:'hidden', marginBottom:12 }}>
                      <table style={{ width:'100%', borderCollapse:'collapse' }}>
                        <thead>
                          <tr style={{ background:C.surface2, borderBottom:`1px solid ${C.border}` }}>
                            {['#','Firma','Etap','Potencjał','Menedżer','Ostatnia aktywność',''].map(h => (
                              <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:10, fontFamily:'DM Mono', textTransform:'uppercase', letterSpacing:'0.07em', color:C.text3 }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {pagedCompanies.map((company, i) => (
                            <tr key={company.id} style={{ borderBottom:`1px solid ${C.border}`, background:i%2===0?C.surface:C.surface2 }}>
                              <td style={{ padding:'10px 14px', fontSize:11, color:C.text3, fontFamily:'DM Mono' }}>{portfolioPage*PAGE_SIZE+i+1}</td>
                              <td style={{ padding:'10px 14px' }}><div style={{ fontSize:13, fontWeight:500 }}>{company.nazwa}</div></td>
                              <td style={{ padding:'10px 14px' }}>
                                <span style={{ fontSize:10, padding:'2px 8px', borderRadius:20, fontFamily:'DM Mono', color:stageColor[company.stage]||C.text3, background:`${stageColor[company.stage]||C.text3}18`, border:`1px solid ${stageColor[company.stage]||C.text3}40` }}>{company.stage||'—'}</span>
                              </td>
                              <td style={{ padding:'10px 14px' }}>
                                <span style={{ fontSize:10, padding:'2px 8px', borderRadius:20, fontFamily:'DM Mono', color:company.potencjal==='wysoki'?C.green:company.potencjal==='średni'?C.amber:C.text3 }}>{company.potencjal||'—'}</span>
                              </td>
                              <td style={{ padding:'10px 14px', fontSize:11, color:company.manager==='Beata Janoszka'?C.beata:C.kamil, fontFamily:'DM Mono' }}>{company.manager?.split(' ')[0]||'—'}</td>
                              <td style={{ padding:'10px 14px', fontSize:11, color:C.text3, fontFamily:'DM Mono' }}>{company.ostatnia_aktywnosc?format(parseISO(company.ostatnia_aktywnosc),'dd.MM.yyyy'):'—'}</td>
                              <td style={{ padding:'10px 14px' }}>
                                {company.bitrix_url && <a href={company.bitrix_url} target="_blank" rel="noreferrer" style={{ fontSize:10, color:C.brand, fontFamily:'DM Mono', textDecoration:'none' }}>Bitrix →</a>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {totalPortfolioPages > 1 && (
                      <div style={{ display:'flex', gap:6, justifyContent:'center', alignItems:'center' }}>
                        <button onClick={() => setPortfolioPage(p=>Math.max(0,p-1))} disabled={portfolioPage===0} style={{ padding:'6px 14px', borderRadius:8, border:`1px solid ${C.border}`, background:C.surface, cursor:'pointer', fontSize:12 }}>‹</button>
                        {Array.from({length:Math.min(totalPortfolioPages,7)},(_,i)=>i).map(i => (
                          <button key={i} onClick={() => setPortfolioPage(i)} style={{ padding:'6px 10px', borderRadius:8, border:`1px solid ${portfolioPage===i?C.brand:C.border}`, background:portfolioPage===i?C.brandLight:C.surface, color:portfolioPage===i?C.brand:C.text, cursor:'pointer', fontSize:12, fontFamily:'DM Mono' }}>{i+1}</button>
                        ))}
                        <button onClick={() => setPortfolioPage(p=>Math.min(totalPortfolioPages-1,p+1))} disabled={portfolioPage>=totalPortfolioPages-1} style={{ padding:'6px 14px', borderRadius:8, border:`1px solid ${C.border}`, background:C.surface, cursor:'pointer', fontSize:12 }}>›</button>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </>
        )}
      </div>
      <footer style={{ textAlign:'center', fontSize:11, color:C.text3, fontFamily:'DM Mono', padding:'20px 0 40px', borderTop:`1px solid ${C.border}` }}>NOWIMA · Analytics · auto-refresh co 5 min</footer>
    </div>
  );
}

function SectionHeader({icon,title,badge}){
  return(
    <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12}}>
      <span style={{fontSize:14}}>{icon}</span>
      <span style={{fontFamily:'Outfit',fontWeight:700,fontSize:11,textTransform:'uppercase',letterSpacing:'0.12em',color:'#5A171E'}}>{title}</span>
      <div style={{flex:1,height:1,background:'#E8E4DC'}}/>
      {badge!=null&&<span style={{fontSize:10,fontFamily:'DM Mono',padding:'2px 8px',borderRadius:20,background:'#F4ECED',color:'#5A171E',border:'1px solid rgba(90,23,30,0.15)'}}>{badge}</span>}
    </div>
  );
}

function KpiCard({label,value,sub,accent,good}){
  return(
    <div style={{background:'#FFF',border:'1px solid #E8E4DC',borderTop:`3px solid ${accent}`,borderRadius:12,padding:'16px 18px'}}>
      <div style={{fontSize:10,fontFamily:'DM Mono',textTransform:'uppercase',letterSpacing:'0.08em',color:'#A09890',marginBottom:8}}>{label}</div>
      <div style={{fontFamily:'Outfit',fontWeight:700,fontSize:34,lineHeight:1,color:good?'#1A7A4A':'#1A1714'}}>{value}</div>
      <div style={{fontSize:11,fontFamily:'DM Mono',color:'#6B6560',marginTop:6}}>{sub}</div>
    </div>
  );
}

function MgrSummary({name,calls,color}){
  const short=name.split(' ')[0];
  const lpr=calls.filter(c=>c.lpr).length;
  const hot=calls.filter(c=>c.wynik==='gorący lead').length;
  const over60=calls.filter(c=>c.duration>60).length;
  const pcty=calls.filter(c=>c.wynik_procentowy!=null).map(c=>c.wynik_procentowy);
  const avg=pcty.length?Math.round(pcty.reduce((a,b)=>a+b,0)/pcty.length):null;
  const sukces=calls.filter(c=>c.sukces_wg_kryteriow).length;

  return(
    <div style={{background:'#FFF',border:'1px solid #E8E4DC',borderTop:`3px solid ${color}`,borderRadius:12,overflow:'hidden'}}>
      <div style={{padding:'12px 18px',borderBottom:'1px solid #E8E4DC',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div style={{fontFamily:'Outfit',fontWeight:700,fontSize:14,color}}>{short}</div>
        {avg!=null&&<div style={{fontFamily:'Outfit',fontWeight:700,fontSize:22,color}}>{avg}%<span style={{fontSize:11,color:'#A09890',fontWeight:400}}> śr.</span></div>}
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)'}}>
        {[{l:'Rozmów',v:calls.length},{l:'Powyżej 60s',v:over60},{l:'Z ŁPR',v:lpr},{l:'Sukces',v:sukces}].map((s,i)=>(
          <div key={i} style={{padding:'10px 14px',borderRight:i<3?'1px solid #E8E4DC':'none'}}>
            <div style={{fontFamily:'Outfit',fontWeight:700,fontSize:20,color}}>{s.v}</div>
            <div style={{fontSize:10,color:'#A09890',marginTop:2,fontFamily:'DM Mono'}}>{s.l}</div>
          </div>
        ))}
      </div>
      {hot>0&&<div style={{padding:'8px 18px',background:'#FEF2F0',borderTop:'1px solid #F5C0BB',fontSize:12,color:'#C0392B',fontFamily:'DM Mono'}}>🔥 {hot} gorących lead{hot>1?'ów':''}</div>}
    </div>
  );
}

function LeadCard({call,onOpen}){
  const isHot=call.wynik==='gorący lead';
  const isMeeting=call.sip==='meeting';
  const mgr=call.sip==='123'||call.manager==='Beata Janoszka'?'Beata':'Kamil';
  return(
    <div style={{background:'#FFF',border:'1px solid #E8E4DC',borderRadius:12,overflow:'hidden',display:'grid',gridTemplateColumns:'4px 1fr',cursor:'pointer'}} onClick={onOpen}>
      <div style={{background:isHot?'#C0392B':'#C07A1A'}}/>
      <div style={{padding:'12px 16px'}}>
        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6,flexWrap:'wrap'}}>
          <span style={{fontFamily:'Outfit',fontWeight:700,fontSize:13}}>{isHot?'🔥':'⚠️'} {call.klient||call.manager}</span>
          <span style={{fontSize:10,padding:'2px 8px',borderRadius:20,fontFamily:'DM Mono',background:isMeeting?'#EEF2FF':call.sip==='123'?'#F4ECED':'#E8F5EE',color:isMeeting?'#2B5BDB':call.sip==='123'?'#5A171E':'#2D6A4F',border:'1px solid rgba(0,0,0,0.08)'}}>{isMeeting?'🎥 Spotkanie':mgr}</span>
          <span style={{fontSize:10,color:'#A09890',fontFamily:'DM Mono'}}>{call.call_time?format(parseISO(call.call_time),'dd.MM HH:mm'):''}</span>
        </div>
        {call.akcja&&<div style={{marginTop:4,padding:'5px 10px',borderRadius:6,background:isHot?'#FEF2F0':'#FEF8EC',color:isHot?'#C0392B':'#C07A1A',fontSize:12,display:'inline-block',border:`1px solid ${isHot?'#F5C0BB':'#F5D89A'}`}}>→ {call.akcja}</div>}
      </div>
    </div>
  );
}

function MeetingCard({meeting,isOpen,onToggle}){
  const {useState:us}=React;
  const [showDialog,setShowDialog]=us(false);
  const pct=meeting.wynik_procentowy;
  const mgr=meeting.manager==='Beata Janoszka'?'Beata':'Kamil';
  const mgrColor=meeting.manager==='Beata Janoszka'?'#5A171E':'#2D6A4F';
  const sukces=meeting.sukces_poziom;
  const sukColor=sukces==='sukces'?'#1A7A4A':sukces==='czesciowy'?'#C07A1A':'#C0392B';
  const sukBg=sukces==='sukces'?'#EDF7F2':sukces==='czesciowy'?'#FEF8EC':'#FEF2F0';
  const checks=[
    {key:'checklist_spin_s',l:'SPIN S'},{key:'checklist_spin_p',l:'SPIN P'},
    {key:'checklist_spin_i',l:'SPIN I'},{key:'checklist_spin_n',l:'SPIN N'},
    {key:'checklist_nastepny_krok',l:'Następny krok'},{key:'checklist_zoom',l:'Zoom'},
    {key:'checklist_omowil_model',l:'Model'},{key:'checklist_zamknal_podsumowaniem',l:'Podsumowanie'},
  ];

  return(
    <div style={{background:'#FFF',border:'1px solid #E8E4DC',borderRadius:12,overflow:'hidden',borderLeft:'3px solid #2B5BDB'}}>
      <div onClick={onToggle} style={{display:'grid',gridTemplateColumns:'28px 70px 1fr auto auto auto 28px',alignItems:'center',gap:10,padding:'12px 16px',cursor:'pointer',background:isOpen?'#F9F8F5':'#FFF'}}>
        <div style={{fontSize:13}}>🎥</div>
        <div style={{fontSize:11,fontWeight:600,color:mgrColor}}>{mgr}</div>
        <div style={{fontSize:13,fontWeight:500}}>{meeting.klient||'—'}</div>
        <div style={{fontFamily:'DM Mono',fontSize:11,color:'#A09890'}}>{meeting.call_time?format(parseISO(meeting.call_time),'dd.MM HH:mm'):''}</div>
        {pct!=null&&<div style={{fontFamily:'DM Mono',fontWeight:700,fontSize:12,color:pct>=70?'#1A7A4A':pct>=40?'#C07A1A':'#C0392B'}}>{pct}%</div>}
        {sukces&&<span style={{fontSize:10,padding:'2px 8px',borderRadius:20,fontFamily:'DM Mono',background:sukBg,color:sukColor,border:`1px solid ${sukColor}30`}}>{sukses==='sukces'?'✓ Sukces':sukses==='czesciowy'?'⚠ Częściowy':'✗ Porażka'}</span>}
        <div style={{color:'#A09890',fontSize:12,textAlign:'center',transition:'transform 0.2s',transform:isOpen?'rotate(180deg)':'none'}}>▼</div>
      </div>
      {isOpen&&(
        <div style={{borderTop:'1px solid #E8E4DC',padding:'16px 20px',background:'#F9F8F5'}}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:14}}>
            <div>
              <div style={{fontSize:10,fontFamily:'DM Mono',textTransform:'uppercase',color:'#A09890',marginBottom:8}}>Checklist skryptu</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:5,marginBottom:12}}>
                {checks.map(c=>(<span key={c.key} style={{fontSize:10,padding:'3px 8px',borderRadius:4,fontFamily:'DM Mono',background:meeting[c.key]?'#EDF7F2':'#FEF2F0',color:meeting[c.key]?'#1A7A4A':'#C0392B',border:`1px solid ${meeting[c.key]?'#9AD5BC':'#F5C0BB'}`}}>{meeting[c.key]?'✓':'✗'} {c.l}</span>))}
              </div>
              {meeting.obiekcja&&<div style={{fontSize:12,color:'#6B6560',marginBottom:6}}><strong>Obiekcja:</strong> {meeting.obiekcja}</div>}
              {meeting.do_poprawy&&<div style={{fontSize:12,color:'#C0392B',lineHeight:1.5}}>📈 {meeting.do_poprawy}</div>}
            </div>
            <div>
              {meeting.akcja&&(<div style={{marginBottom:12}}>
                <div style={{fontSize:10,fontFamily:'DM Mono',textTransform:'uppercase',color:'#A09890',marginBottom:6}}>Następny krok</div>
                <div style={{fontSize:12,color:'#1A7A4A',lineHeight:1.6,paddingLeft:10,borderLeft:'2px solid #1A7A4A'}}>{meeting.akcja}</div>
              </div>)}
              {meeting.outcome&&<div style={{fontSize:12,color:'#6B6560',lineHeight:1.5,marginBottom:8}}><strong>Outcome:</strong> {meeting.outcome}</div>}
              {meeting.powod_sukcesu&&<div style={{fontSize:12,color:'#6B6560',lineHeight:1.5}}><strong>Ocena:</strong> {meeting.powod_sukcesu}</div>}
            </div>
          </div>
          {meeting.transcript&&(
            <div>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
                <div style={{fontSize:10,fontFamily:'DM Mono',textTransform:'uppercase',color:'#A09890'}}>Transkrypt</div>
                <button onClick={()=>setShowDialog(d=>!d)} style={{fontSize:11,padding:'4px 10px',borderRadius:6,border:`1px solid ${showDialog?'#5A171E':'#E8E4DC'}`,background:showDialog?'#F4ECED':'#FFF',color:showDialog?'#5A171E':'#6B6560',cursor:'pointer',fontFamily:'DM Mono'}}>
                  {showDialog?'✕ Ukryj':'💬 Pokaż dialog'}
                </button>
              </div>
              {showDialog?(
                <DialogView text={meeting.dialog||meeting.transcript} mgr={mgr}/>
              ):(
                <div style={{fontSize:12,color:'#6B6560',lineHeight:1.7,background:'#FFF',border:'1px solid #E8E4DC',borderRadius:8,padding:'12px 16px',maxHeight:200,overflowY:'auto',fontFamily:'DM Mono',whiteSpace:'pre-wrap'}}>{meeting.transcript.substring(0,400)}...</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DialogView({text,mgr}){
  const lines=(text||'').split('\n').filter(l=>l.trim());
  return(
    <div style={{background:'#FFF',border:'1px solid #E8E4DC',borderRadius:8,padding:'12px 16px',maxHeight:320,overflowY:'auto'}}>
      {lines.map((line,i)=>{
        const isManager=line.startsWith((mgr||'Handlowiec')+':');
        const isClient=line.startsWith('Klient:');
        const speaker=isManager?(mgr||'Handlowiec'):isClient?'Klient':null;
        const txt=speaker?line.substring(speaker.length+1).trim():line;
        if(!speaker)return<div key={i} style={{fontSize:11,color:'#A09890',fontFamily:'DM Mono',padding:'2px 0'}}>{line}</div>;
        return(
          <div key={i} style={{display:'flex',gap:8,marginBottom:6,flexDirection:isManager?'row':'row-reverse'}}>
            <div style={{fontSize:10,fontWeight:600,color:isManager?'#5A171E':'#2D6A4F',minWidth:42,textAlign:isManager?'left':'right',fontFamily:'DM Mono',paddingTop:3,flexShrink:0}}>{speaker}</div>
            <div style={{background:isManager?'#F4ECED':'#E8F5EE',borderRadius:8,padding:'6px 10px',fontSize:12,color:'#1A1714',lineHeight:1.5,maxWidth:'80%'}}>{txt}</div>
          </div>
        );
      })}
    </div>
  );
}

function CallDetail({call,isOpen,onToggle}){
  const {useState:us}=React;
  const [showDialog,setShowDialog]=us(false);
  const mgr=call.sip==='123'||call.manager==='Beata Janoszka'?'Beata':'Kamil';
  const mgrColor=mgr==='Beata'?'#5A171E':'#2D6A4F';
  const pct=call.wynik_procentowy;
  const sukces=call.sukces_poziom;
  const sukColor=sukces==='sukces'?'#1A7A4A':sukces==='czesciowy'?'#C07A1A':'#C0392B';
  const sukBg=sukces==='sukces'?'#EDF7F2':sukces==='czesciowy'?'#FEF8EC':'#FEF2F0';

  const typ=call.typ_rozmowy;
  const typEmoji={zimny_telefon:'❄️',sekretariat:'📋',kontakt_z_lpr:'🎯',followup_po_materialach:'📨',followup_bez_materialow:'🔄',operacyjny:'⚙️',bot_niedozwon:'🤖'}[typ]||'📞';
  const dur=call.duration;
  const durStr=`${Math.floor(dur/60)}:${String(dur%60).padStart(2,'0')}`;
  const isBotOrOp=typ==='bot_niedozwon'||typ==='operacyjny';

  return(
    <div style={{background:'#FFF',border:'1px solid #E8E4DC',borderRadius:10,overflow:'hidden',boxShadow:'0 1px 2px rgba(26,23,20,0.04)'}}>
      <div onClick={onToggle} style={{display:'grid',gridTemplateColumns:'24px 60px 70px 1fr auto auto auto 24px',alignItems:'center',gap:8,padding:'10px 14px',cursor:'pointer',background:isOpen?'#F9F8F5':'#FFF'}}>
        <div style={{fontSize:12}}>{typEmoji}</div>
        <div style={{fontFamily:'DM Mono',fontSize:11,color:'#6B6560'}}>{call.call_time?format(parseISO(call.call_time),'dd.MM HH:mm'):''}</div>
        <div style={{fontSize:11,fontWeight:600,color:mgrColor}}>{mgr}</div>
        <div style={{fontSize:13,fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{call.klient||'—'}</div>
        <div style={{fontFamily:'DM Mono',fontSize:11,color:'#A09890'}}>{durStr}</div>
        {!isBotOrOp&&pct!=null&&<div style={{fontFamily:'DM Mono',fontWeight:700,fontSize:12,color:pct>=70?'#1A7A4A':pct>=40?'#C07A1A':'#C0392B',minWidth:34,textAlign:'right'}}>{pct}%</div>}
        {!isBotOrOp&&sukces&&<span style={{fontSize:10,padding:'2px 8px',borderRadius:20,fontFamily:'DM Mono',background:sukBg,color:sukColor,border:`1px solid ${sukColor}30`}}>{sukses==='sukces'?'✓':sukses==='czesciowy'?'⚠':'✗'}</span>}
        {isBotOrOp&&<span style={{fontSize:10,padding:'2px 8px',borderRadius:20,fontFamily:'DM Mono',background:'#F9F8F5',color:'#A09890',border:'1px solid #E8E4DC'}}>{typ==='bot_niedozwon'?'bot':'op.'}</span>}
        <div style={{color:'#A09890',fontSize:11,textAlign:'center',transition:'transform 0.2s',transform:isOpen?'rotate(180deg)':'none'}}>▼</div>
      </div>

      {isOpen&&(
        <div style={{borderTop:'1px solid #E8E4DC',padding:'14px 18px',background:'#F9F8F5'}}>
          {isBotOrOp?(
            <div>
              {call.outcome&&<div style={{fontSize:12,color:'#6B6560',marginBottom:6}}>📌 {call.outcome}</div>}
              {call.akcja&&<div style={{fontSize:12,color:'#C07A1A'}}>→ {call.akcja}</div>}
            </div>
          ):(
            <>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginBottom:12}}>
                <div>
                  {call.cytat_klienta&&<div style={{fontSize:12,color:'#6B6560',lineHeight:1.5,marginBottom:8,fontStyle:'italic'}}>💬 "{call.cytat_klienta}"</div>}
                  {call.obiekcja&&<div style={{fontSize:12,color:'#C0392B',marginBottom:6}}>🛑 {call.obiekcja}</div>}
                  {call.outcome&&<div style={{fontSize:12,color:'#6B6560',marginBottom:6}}>📌 {call.outcome}</div>}
                  {call.do_poprawy&&<div style={{fontSize:12,color:'#C07A1A',lineHeight:1.5,marginTop:8,padding:'6px 10px',borderRadius:6,background:'#FEF8EC',border:'1px solid #F5D89A'}}>📈 {call.do_poprawy}</div>}
                </div>
                <div>
                  {call.akcja&&<div style={{marginBottom:10}}>
                    <div style={{fontSize:10,fontFamily:'DM Mono',textTransform:'uppercase',color:'#A09890',marginBottom:5}}>Akcja</div>
                    <div style={{fontSize:12,color:'#1A7A4A',lineHeight:1.5,paddingLeft:8,borderLeft:'2px solid #1A7A4A'}}>{call.akcja}</div>
                  </div>}
                  {call.powod_sukcesu&&<div style={{fontSize:11,color:'#6B6560',lineHeight:1.5,marginBottom:8}}>{call.powod_sukcesu}</div>}
                  {call.bitrix_url&&<a href={call.bitrix_url} target="_blank" rel="noreferrer" style={{fontSize:11,color:'#5A171E',fontFamily:'DM Mono',textDecoration:'none',display:'inline-block',marginTop:4}}>🔗 Bitrix →</a>}
                  {!call.bitrix_url&&call.lpr&&<div style={{fontSize:11,color:'#1A7A4A',fontFamily:'DM Mono'}}>✓ ŁPR</div>}
                </div>
              </div>

              {call.transcript&&(
                <div>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
                    <div style={{fontSize:10,fontFamily:'DM Mono',textTransform:'uppercase',color:'#A09890'}}>Transkrypt</div>
                    <button onClick={()=>setShowDialog(d=>!d)} style={{fontSize:11,padding:'4px 10px',borderRadius:6,border:`1px solid ${showDialog?'#5A171E':'#E8E4DC'}`,background:showDialog?'#F4ECED':'#FFF',color:showDialog?'#5A171E':'#6B6560',cursor:'pointer',fontFamily:'DM Mono'}}>
                      {showDialog?'✕ Ukryj':'💬 Dialog'}
                    </button>
                  </div>
                  {showDialog?(
                    <DialogView text={call.dialog||call.transcript} mgr={mgr}/>
                  ):(
                    <div style={{fontSize:12,color:'#6B6560',lineHeight:1.7,background:'#FFF',border:'1px solid #E8E4DC',borderRadius:8,padding:'10px 14px',maxHeight:160,overflowY:'auto',fontFamily:'DM Mono',whiteSpace:'pre-wrap'}}>{(call.transcript||'').substring(0,300)}...</div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
