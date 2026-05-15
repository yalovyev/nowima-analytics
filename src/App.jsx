import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, parseISO, isWithinInterval } from 'date-fns';
import { pl } from 'date-fns/locale';

// Supabase config - replace with your values
const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.REACT_APP_SUPABASE_KEY || '';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Brand colors
const COLORS = {
  nowima: '#5A171E',
  lime: '#D1E925',
  limeDark: '#8A9C00',
  beata: '#5A171E',
  kamil: '#8A9C00',
  red: '#C0392B',
  amber: '#C07A1A',
  green: '#1A7A4A',
  bg: '#F5F3EF',
  surface: '#FFFFFF',
  border: '#E8E4DC',
  text: '#1A1714',
  text2: '#6B6560',
  text3: '#A09890',
};

const PIE_COLORS = ['#C0392B', '#C07A1A', '#1A7A4A', '#A09890', '#E8E4DC'];

export default function App() {
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('day'); // day, week, month, all
  const [selectedManager, setSelectedManager] = useState('all'); // all, beata, kamil
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [activeCall, setActiveCall] = useState(null);

  const getDateRange = useCallback(() => {
    const now = new Date();
    switch (period) {
case 'day': {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return { start: today, end: now };
}
        return { start: subDays(now, 1), end: now };
      case 'week':
        return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
      case 'month':
        return { start: startOfMonth(now), end: endOfMonth(now) };
      default:
        return { start: new Date('2025-01-01'), end: now };
    }
  }, [period]);

  const fetchCalls = useCallback(async () => {
    const { start, end } = getDateRange();
    let query = supabase
      .from('calls')
      .select('*')
      .gte('call_time', start.toISOString())
      .lte('call_time', end.toISOString())
      .order('call_time', { ascending: false });

    if (selectedManager === 'beata') query = query.eq('sip', '123');
    if (selectedManager === 'kamil') query = query.eq('sip', '119');

    const { data, error } = await query;
    if (!error && data) {
      setCalls(data);
      setLastUpdate(new Date());
    }
    setLoading(false);
  }, [getDateRange, selectedManager]);

  useEffect(() => {
    fetchCalls();
    const interval = setInterval(fetchCalls, 5 * 60 * 1000); // co 5 minut
    return () => clearInterval(interval);
  }, [fetchCalls]);

  // Real-time subscription
  useEffect(() => {
    const subscription = supabase
      .channel('calls')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'calls' }, (payload) => {
        setCalls(prev => [payload.new, ...prev]);
        setLastUpdate(new Date());
      })
      .subscribe();
    return () => subscription.unsubscribe();
  }, []);

  // Stats
  const beata = calls.filter(c => c.sip === '123');
  const kamil = calls.filter(c => c.sip === '119');
  const over60 = calls.filter(c => c.duration > 60);
  const over180 = calls.filter(c => c.duration > 180);
  const lprCalls = calls.filter(c => c.lpr);
  const hotLeads = calls.filter(c => c.wynik === 'gorący lead');
  const pilne = calls.filter(c => c.pilne);
  const meetings = calls.filter(c => c.checklist_zoom);
  const bots = calls.filter(c => c.wynik === 'bot/automat');
  const secretariat = calls.filter(c => c.wynik === 'sekretariat');
  const followups = calls.filter(c => c.checklist_nastepny_krok);

  const lprConversion = over60.length > 0 ? Math.round(lprCalls.length / over60.length * 100) : 0;
  const secretariatConversion = secretariat.length > 0 ? Math.round((lprCalls.length / secretariat.length) * 100) : 0;

  // Chart data - calls by hour
  const hourlyData = Array.from({ length: 9 }, (_, i) => {
    const hour = i + 8;
    return {
      hour: `${hour}:00`,
      Beata: beata.filter(c => new Date(c.call_time).getHours() === hour).length,
      Kamil: kamil.filter(c => new Date(c.call_time).getHours() === hour).length,
    };
  });

  // Results distribution
  const resultsData = [
    { name: 'Gorący lead', value: hotLeads.length },
    { name: 'Zainteresowany', value: calls.filter(c => c.wynik === 'zainteresowany').length },
    { name: 'Follow-up', value: calls.filter(c => c.wynik === 'follow-up').length },
    { name: 'Odmowa', value: calls.filter(c => c.wynik === 'odmowa').length },
    { name: 'Sekretariat/Bot', value: secretariat.length + bots.length },
  ].filter(d => d.value > 0);

  // Script compliance
  const scriptItems = [
    { key: 'checklist_przedstawil', label: 'Przedstawił się' },
    { key: 'checklist_szukal_lpr', label: 'Szukał ŁPR' },
    { key: 'checklist_spin', label: 'Pytania SPIN' },
    { key: 'checklist_parametry', label: 'Parametry projektu' },
    { key: 'checklist_zoom', label: 'Zaproponował Zoom' },
    { key: 'checklist_nastepny_krok', label: 'Następny krok' },
  ];

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", background: COLORS.bg, minHeight: '100vh', color: COLORS.text }}>
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=DM+Sans:wght@300;400;500&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />

      {/* HEADER */}
      <header style={{
        background: COLORS.nowima, position: 'sticky', top: 0, zIndex: 100,
        borderBottom: `2px solid rgba(209,233,37,0.3)`,
        boxShadow: '0 2px 12px rgba(90,23,30,0.3)'
      }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', padding: '0 24px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ background: 'rgba(209,233,37,0.15)', border: '1px solid rgba(209,233,37,0.3)', borderRadius: 6, padding: '4px 10px', fontFamily: 'Outfit', fontWeight: 700, fontSize: 16, color: COLORS.lime, letterSpacing: 1 }}>
              NOWIMA
            </div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', fontFamily: 'DM Mono' }}>
              Analytics · dane na żywo
            </div>
          </div>

          {/* Period selector */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {['day', 'week', 'month', 'all'].map(p => (
              <button key={p} onClick={() => setPeriod(p)} style={{
                padding: '4px 12px', borderRadius: 20, border: '1px solid',
                borderColor: period === p ? COLORS.lime : 'rgba(255,255,255,0.2)',
                background: period === p ? 'rgba(209,233,37,0.15)' : 'transparent',
                color: period === p ? COLORS.lime : 'rgba(255,255,255,0.7)',
                fontSize: 11, fontFamily: 'DM Mono', cursor: 'pointer'
              }}>
                {p === 'day' ? 'Dziś' : p === 'week' ? 'Tydzień' : p === 'month' ? 'Miesiąc' : 'Wszystko'}
              </button>
            ))}
          </div>

          {/* Manager filter */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {[['all', 'Wszyscy'], ['beata', 'Beata'], ['kamil', 'Kamil']].map(([key, label]) => (
              <button key={key} onClick={() => setSelectedManager(key)} style={{
                padding: '4px 12px', borderRadius: 20, border: '1px solid',
                borderColor: selectedManager === key ? COLORS.lime : 'rgba(255,255,255,0.2)',
                background: selectedManager === key ? 'rgba(209,233,37,0.15)' : 'transparent',
                color: selectedManager === key ? COLORS.lime : 'rgba(255,255,255,0.7)',
                fontSize: 11, fontFamily: 'DM Mono', cursor: 'pointer'
              }}>
                {label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {hotLeads.length > 0 && (
              <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, border: `1px solid ${COLORS.lime}`, color: COLORS.lime, background: 'rgba(209,233,37,0.1)', fontFamily: 'DM Mono' }}>
                🔥 {hotLeads.length} gorących
              </span>
            )}
            {meetings.length === 0 && (
              <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, border: '1px solid #F5C0BB', color: '#F5C0BB', background: 'rgba(192,57,43,0.15)', fontFamily: 'DM Mono' }}>
                ⚠️ 0 spotkań
              </span>
            )}
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontFamily: 'DM Mono', alignSelf: 'center' }}>
              ↻ {format(lastUpdate, 'HH:mm')}
            </span>
          </div>
        </div>
      </header>

      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '24px 24px 80px' }}>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 80, color: COLORS.text3, fontFamily: 'DM Mono' }}>
            ⏳ Ładowanie danych...
          </div>
        ) : (
          <>
            {/* KPI ROW 1 */}
            <SectionHeader icon="📊" title="Kluczowe wskaźniki" />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 12 }}>
              <KpiCard label="Wszystkie rozmowy" value={calls.length} sub={`B: ${beata.length} · K: ${kamil.length}`} accent={COLORS.nowima} />
              <KpiCard label="Rozmowy powyżej 60s" value={over60.length} sub={`B: ${beata.filter(c=>c.duration>60).length} · K: ${kamil.filter(c=>c.duration>60).length}`} accent={COLORS.nowima} />
              <KpiCard label="Kontakty z ŁPR" value={lprCalls.length} sub={`B: ${beata.filter(c=>c.lpr).length} · K: ${kamil.filter(c=>c.lpr).length}`} accent={COLORS.green} good />
              <KpiCard label="Konwersja ŁPR z >60s" value={`${lprConversion}%`} sub={`${lprCalls.length} z ${over60.length} rozmów`} accent={COLORS.green} good />
            </div>

            {/* KPI ROW 2 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10, marginBottom: 24 }}>
              <KpiSmall label="Powyżej 180s" value={over180.length} sub={`B:${beata.filter(c=>c.duration>180).length} K:${kamil.filter(c=>c.duration>180).length}`} />
              <KpiSmall label="Follow-up" value={followups.length} sub={`B:${beata.filter(c=>c.checklist_nastepny_krok).length} K:${kamil.filter(c=>c.checklist_nastepny_krok).length}`} />
              <KpiSmall label="Konw. follow-up" value={over60.length > 0 ? `${Math.round(followups.length/over60.length*100)}%` : '—'} sub={`${followups.length} z ${over60.length}`} good />
              <KpiSmall label="Sekretariat" value={secretariat.length} sub={`B:${beata.filter(c=>c.wynik==='sekretariat').length} K:${kamil.filter(c=>c.wynik==='sekretariat').length}`} />
              <KpiSmall label="Konw. sekretariat" value={`${secretariatConversion}%`} sub={`${lprCalls.length} przełączeń`} good />
              <KpiSmall label="Bot/automat" value={bots.length} sub={`${calls.length > 0 ? Math.round(bots.length/calls.length*100) : 0}% wszystkich`} danger={bots.length / calls.length > 0.15} />
            </div>

            {/* FUNNEL */}
            <SectionHeader icon="🔽" title="Lejek sprzedażowy" />
            <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 12, overflow: 'hidden', marginBottom: 24, boxShadow: '0 2px 8px rgba(26,23,20,0.08)' }}>
              <div style={{ display: 'flex' }}>
                {[
                  { label: 'Rozmowy', value: calls.length, pct: '100%', color: COLORS.nowima },
                  { label: 'Rozmowa z ŁPR', value: lprCalls.length, pct: calls.length > 0 ? `${Math.round(lprCalls.length/calls.length*100)}%` : '—', color: COLORS.text },
                  { label: 'Zainteresowani', value: calls.filter(c=>c.wynik==='zainteresowany').length, pct: lprCalls.length > 0 ? `${Math.round(calls.filter(c=>c.wynik==='zainteresowany').length/lprCalls.length*100)}%` : '—', color: COLORS.nowima, active: true },
                  { label: 'Gorące leady', value: hotLeads.length, pct: '—', color: COLORS.red, hot: true },
                  { label: 'Spotkanie', value: meetings.length, pct: '—', color: COLORS.text3, dim: meetings.length === 0 },
                  { label: 'Oferta', value: 0, pct: '—', color: COLORS.text3, dim: true },
                ].map((step, i) => (
                  <div key={i} style={{
                    flex: 1, padding: '16px 12px', textAlign: 'center',
                    borderRight: i < 5 ? `1px solid ${COLORS.border}` : 'none',
                    background: step.active ? '#F4ECED' : step.hot ? '#FEF2F0' : COLORS.surface,
                    opacity: step.dim ? 0.4 : 1
                  }}>
                    <div style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: 28, color: step.color }}>{step.value}</div>
                    <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', color: COLORS.text3, margin: '4px 0', fontFamily: 'DM Mono' }}>{step.label}</div>
                    <div style={{ fontSize: 11, color: COLORS.text2 }}>{step.pct}</div>
                  </div>
                ))}
              </div>
              {meetings.length === 0 && (
                <div style={{ background: '#FEF2F0', borderTop: `1px solid #F5C0BB`, padding: '10px 18px', fontSize: 12, color: COLORS.red, display: 'flex', gap: 8 }}>
                  <span>🚨</span>
                  <span><strong>Krytyczna luka:</strong> Brak umówionych spotkań online. Bez spotkania nie ma oferty — bez oferty nie ma kontraktu.</span>
                </div>
              )}
            </div>

            {/* CHARTS */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 24 }}>
              <ChartCard title="Aktywność według godzin">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={hourlyData}>
                    <XAxis dataKey="hour" tick={{ fontSize: 10, fontFamily: 'DM Mono', fill: COLORS.text3 }} />
                    <YAxis tick={{ fontSize: 10, fontFamily: 'DM Mono', fill: COLORS.text3 }} />
                    <Tooltip contentStyle={{ fontFamily: 'DM Mono', fontSize: 11 }} />
                    <Bar dataKey="Beata" fill={COLORS.beata} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Kamil" fill={COLORS.kamil} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title="Rozkład wyników rozmów">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={resultsData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, value }) => `${name}: ${value}`} labelLine={false} fontSize={10}>
                      {resultsData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ fontFamily: 'DM Mono', fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>

            {/* HOT LEADS */}
            {hotLeads.length > 0 && (
              <>
                <SectionHeader icon="🔥" title="Gorące leady i pilne działania" badge={hotLeads.length} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
                  {hotLeads.map(call => (
                    <LeadCard key={call.id} call={call} type="hot" />
                  ))}
                  {pilne.filter(c => c.wynik !== 'gorący lead').map(call => (
                    <LeadCard key={call.id} call={call} type="amber" />
                  ))}
                </div>
              </>
            )}

            {/* MANAGER COMPARISON */}
            <SectionHeader icon="👥" title="Porównanie menedżerów" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 24 }}>
              <ManagerCard manager="Beata Janoszka" sip="123" calls={beata} allCalls={calls} color={COLORS.beata} />
              <ManagerCard manager="Kamil Wisniewski" sip="119" calls={kamil} allCalls={calls} color={COLORS.kamil} />
            </div>

            {/* SCRIPT COMPLIANCE */}
            <SectionHeader icon="📋" title="Realizacja skryptu NOWIMA" />
            <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 12, overflow: 'hidden', marginBottom: 24, boxShadow: '0 2px 8px rgba(26,23,20,0.08)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr 100px 100px', background: '#F9F8F5', padding: '10px 14px', borderBottom: `1px solid ${COLORS.border}` }}>
                <div></div>
                <div style={{ fontSize: 10, fontFamily: 'DM Mono', textTransform: 'uppercase', letterSpacing: '0.08em', color: COLORS.text3 }}>Krok skryptu</div>
                <div style={{ fontSize: 10, fontFamily: 'DM Mono', color: COLORS.beata, textAlign: 'center' }}>Beata</div>
                <div style={{ fontSize: 10, fontFamily: 'DM Mono', color: COLORS.kamil, textAlign: 'center' }}>Kamil</div>
              </div>
              {scriptItems.map(item => {
                const beataOk = beata.filter(c => c[item.key]).length;
                const kamilOk = kamil.filter(c => c[item.key]).length;
                const beataPct = beata.length > 0 ? Math.round(beataOk / beata.length * 100) : 0;
                const kamilPct = kamil.length > 0 ? Math.round(kamilOk / kamil.length * 100) : 0;
                const isGood = (pct) => pct >= 70;
                return (
                  <div key={item.key} style={{ display: 'grid', gridTemplateColumns: '28px 1fr 100px 100px', borderBottom: `1px solid ${COLORS.border}`, alignItems: 'center' }}>
                    <div style={{ textAlign: 'center', padding: '12px 8px', fontSize: 13 }}>
                      {beataPct >= 70 && kamilPct >= 70 ? '✅' : beataPct < 40 || kamilPct < 40 ? '🔴' : '⚠️'}
                    </div>
                    <div style={{ padding: '12px 14px', fontSize: 12, color: COLORS.text2 }}>{item.label}</div>
                    <div style={{ padding: '10px 8px', textAlign: 'center' }}>
                      <div style={{ fontSize: 13, color: isGood(beataPct) ? COLORS.green : COLORS.red }}>
                        {isGood(beataPct) ? '✓' : '✗'}
                      </div>
                      <div style={{ fontSize: 10, fontFamily: 'DM Mono', color: COLORS.beata }}>{beataPct}%</div>
                    </div>
                    <div style={{ padding: '10px 8px', textAlign: 'center' }}>
                      <div style={{ fontSize: 13, color: isGood(kamilPct) ? COLORS.green : COLORS.red }}>
                        {isGood(kamilPct) ? '✓' : '✗'}
                      </div>
                      <div style={{ fontSize: 10, fontFamily: 'DM Mono', color: COLORS.kamil }}>{kamilPct}%</div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* CALLS ACCORDION */}
            <SectionHeader icon="📞" title="Szczegółowy rozbiór rozmów" badge="kliknij aby rozwinąć" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
              {calls
                .filter(c => c.duration > 120 || c.wynik === 'gorący lead')
                .slice(0, 20)
                .map(call => (
                  <CallAccordion
                    key={call.id}
                    call={call}
                    isOpen={activeCall === call.id}
                    onToggle={() => setActiveCall(activeCall === call.id ? null : call.id)}
                  />
                ))}
            </div>
          </>
        )}
      </div>

      <footer style={{ textAlign: 'center', fontSize: 11, color: COLORS.text3, fontFamily: 'DM Mono', padding: '20px 0 40px', borderTop: `1px solid ${COLORS.border}` }}>
        NOWIMA · Analytics Platform · dane na żywo z Supabase · auto-refresh co 5 min
      </footer>
    </div>
  );
}

// ── COMPONENTS ────────────────────────────────────────────────

function SectionHeader({ icon, title, badge }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '0 0 16px' }}>
      <span style={{ fontSize: 16 }}>{icon}</span>
      <span style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#5A171E' }}>{title}</span>
      <div style={{ flex: 1, height: 1, background: '#E8E4DC' }}></div>
      {badge && <span style={{ fontSize: 10, fontFamily: 'DM Mono', padding: '2px 8px', borderRadius: 20, background: '#F4ECED', color: '#5A171E', border: '1px solid rgba(90,23,30,0.15)' }}>{badge}</span>}
    </div>
  );
}

function KpiCard({ label, value, sub, accent, good }) {
  return (
    <div style={{
      background: '#FFFFFF', border: `1px solid #E8E4DC`,
      borderTop: `3px solid ${accent}`,
      borderRadius: 12, padding: '18px 20px',
      boxShadow: '0 2px 8px rgba(26,23,20,0.08)'
    }}>
      <div style={{ fontSize: 10, fontFamily: 'DM Mono', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#A09890', marginBottom: 8 }}>{label}</div>
      <div style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: 38, lineHeight: 1, color: good ? '#1A7A4A' : '#1A1714' }}>{value}</div>
      <div style={{ fontSize: 11, fontFamily: 'DM Mono', color: '#6B6560', marginTop: 8 }}>{sub}</div>
    </div>
  );
}

function KpiSmall({ label, value, sub, good, danger }) {
  return (
    <div style={{
      background: danger ? '#FEF2F0' : '#FFFFFF',
      border: `1px solid ${danger ? '#F5C0BB' : '#E8E4DC'}`,
      borderTop: `3px solid ${danger ? '#C0392B' : good ? '#1A7A4A' : '#E8E4DC'}`,
      borderRadius: 12, padding: '14px 16px',
      boxShadow: '0 1px 3px rgba(26,23,20,0.06)'
    }}>
      <div style={{ fontSize: 10, fontFamily: 'DM Mono', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#A09890', marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: 26, lineHeight: 1, color: danger ? '#C0392B' : good ? '#1A7A4A' : '#1A1714' }}>{value}</div>
      <div style={{ fontSize: 10, fontFamily: 'DM Mono', color: '#6B6560', marginTop: 5 }}>{sub}</div>
    </div>
  );
}

function ChartCard({ title, children }) {
  return (
    <div style={{ background: '#FFFFFF', border: '1px solid #E8E4DC', borderRadius: 12, padding: '18px 20px', boxShadow: '0 2px 8px rgba(26,23,20,0.08)' }}>
      <div style={{ fontSize: 10, fontFamily: 'DM Mono', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#A09890', marginBottom: 14 }}>{title}</div>
      {children}
    </div>
  );
}

function LeadCard({ call, type }) {
  const isHot = type === 'hot';
  return (
    <div style={{
      background: '#FFFFFF', border: '1px solid #E8E4DC', borderRadius: 12,
      overflow: 'hidden', boxShadow: '0 2px 8px rgba(26,23,20,0.08)',
      display: 'grid', gridTemplateColumns: '4px 1fr'
    }}>
      <div style={{ background: isHot ? '#C0392B' : '#C07A1A' }}></div>
      <div style={{ padding: '14px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: 14 }}>
            {isHot ? '🔥' : '⚠️'} {call.klient || call.manager}
          </span>
          <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, fontFamily: 'DM Mono', background: call.sip === '123' ? '#F4ECED' : '#F7FAE6', color: call.sip === '123' ? '#5A171E' : '#8A9C00', border: `1px solid ${call.sip === '123' ? 'rgba(90,23,30,0.15)' : 'rgba(138,156,0,0.2)'}` }}>
            {call.sip === '123' ? 'Beata' : 'Kamil'}
          </span>
          <span style={{ fontSize: 10, fontFamily: 'DM Mono', color: '#A09890' }}>{call.call_time ? format(parseISO(call.call_time), 'dd.MM HH:mm') : ''} · {call.duration}s</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {call.co_powiedzial && (
            <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: 8, fontSize: 12 }}>
              <div style={{ color: '#A09890', fontFamily: 'DM Mono', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', paddingTop: 1 }}>Co powiedział</div>
              <div style={{ color: '#6B6560' }}>{call.co_powiedzial}</div>
            </div>
          )}
          {call.co_przeoczono && (
            <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: 8, fontSize: 12 }}>
              <div style={{ color: '#A09890', fontFamily: 'DM Mono', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', paddingTop: 1 }}>Przeoczono</div>
              <div style={{ color: '#6B6560' }}>{call.co_przeoczono}</div>
            </div>
          )}
        </div>
        {call.akcja && (
          <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 8, background: isHot ? '#FEF2F0' : '#FEF8EC', color: isHot ? '#C0392B' : '#C07A1A', fontSize: 12, fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 6, border: `1px solid ${isHot ? '#F5C0BB' : '#F5D89A'}` }}>
            → {call.akcja}
          </div>
        )}
      </div>
    </div>
  );
}

function ManagerCard({ manager, sip, calls, allCalls, color }) {
  const lpr = calls.filter(c => c.lpr).length;
  const hot = calls.filter(c => c.wynik === 'gorący lead').length;
  const zoom = calls.filter(c => c.checklist_zoom).length;
  const over60 = calls.filter(c => c.duration > 60).length;
  const avgScore = calls.length > 0 ? (calls.reduce((s, c) => s + (c.ocena || 0), 0) / calls.length).toFixed(1) : '—';

  return (
    <div style={{ background: '#FFFFFF', border: `1px solid #E8E4DC`, borderRadius: 12, overflow: 'hidden', boxShadow: '0 2px 8px rgba(26,23,20,0.08)' }}>
      <div style={{ padding: '14px 20px', borderBottom: '1px solid #E8E4DC', borderTop: `3px solid ${color}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: 15, color }}>{manager}</div>
          <div style={{ fontSize: 11, color: '#A09890', fontFamily: 'DM Mono', marginTop: 2 }}>SIP {sip}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: 22, color }}>{avgScore}<span style={{ fontSize: 13, color: '#A09890' }}>/5</span></div>
          <div style={{ fontSize: 10, color: '#A09890' }}>śr. ocena</div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {[
          { label: 'Rozmów', value: calls.length },
          { label: 'Z ŁPR', value: lpr },
          { label: 'Hot leady', value: hot },
          { label: 'Zoom prop.', value: `${over60 > 0 ? Math.round(zoom/over60*100) : 0}%` },
        ].map((stat, i) => (
          <div key={i} style={{ padding: '12px 16px', borderRight: i < 3 ? '1px solid #E8E4DC' : 'none' }}>
            <div style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: 20, color }}>{stat.value}</div>
            <div style={{ fontSize: 10, color: '#A09890', marginTop: 2, fontFamily: 'DM Mono' }}>{stat.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CallAccordion({ call, isOpen, onToggle }) {
  const checklist = [
    { key: 'checklist_przedstawil', label: 'Przedstawił' },
    { key: 'checklist_szukal_lpr', label: 'ŁPR' },
    { key: 'checklist_spin', label: 'SPIN' },
    { key: 'checklist_parametry', label: 'Parametry' },
    { key: 'checklist_zoom', label: 'Zoom' },
    { key: 'checklist_nastepny_krok', label: 'Następny krok' },
  ];

  const stars = '★'.repeat(call.ocena || 0) + '☆'.repeat(5 - (call.ocena || 0));

  return (
    <div style={{ background: '#FFFFFF', border: '1px solid #E8E4DC', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(26,23,20,0.06)' }}>
      <div onClick={onToggle} style={{
        display: 'grid', gridTemplateColumns: '80px 90px 1fr auto auto auto 100px',
        alignItems: 'center', gap: 10, padding: '12px 16px', cursor: 'pointer',
        background: isOpen ? '#F9F8F5' : '#FFFFFF'
      }}>
        <div style={{ fontFamily: 'DM Mono', fontSize: 12, color: '#6B6560' }}>
          {call.call_time ? format(parseISO(call.call_time), 'dd.MM HH:mm') : ''}
        </div>
        <div style={{ fontSize: 11, fontWeight: 500, color: call.sip === '123' ? '#5A171E' : '#8A9C00' }}>
          {call.sip === '123' ? 'Beata' : 'Kamil'}
        </div>
        <div style={{ fontSize: 13, fontWeight: 500 }}>{call.klient || '—'}</div>
        <div style={{ fontFamily: 'DM Mono', fontSize: 11, color: '#A09890' }}>{call.duration}s</div>
        <div style={{ color: '#C07A1A', fontSize: 12 }}>{stars}</div>
        <div>
          <span style={{
            fontSize: 10, padding: '2px 8px', borderRadius: 20, fontFamily: 'DM Mono',
            background: call.wynik === 'gorący lead' ? '#FEF2F0' : call.wynik === 'zainteresowany' ? '#EDF7F2' : '#F9F8F5',
            color: call.wynik === 'gorący lead' ? '#C0392B' : call.wynik === 'zainteresowany' ? '#1A7A4A' : '#A09890',
            border: `1px solid ${call.wynik === 'gorący lead' ? '#F5C0BB' : call.wynik === 'zainteresowany' ? '#9AD5BC' : '#E8E4DC'}`
          }}>
            {call.wynik || '—'}
          </span>
        </div>
        <div style={{ color: '#A09890', fontSize: 12, textAlign: 'center', transition: 'transform 0.2s', transform: isOpen ? 'rotate(180deg)' : 'none' }}>▼</div>
      </div>

      {isOpen && (
        <div style={{ borderTop: '1px solid #E8E4DC', padding: '16px 20px', background: '#F9F8F5' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <div style={{ fontSize: 10, fontFamily: 'DM Mono', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#A09890', marginBottom: 8 }}>Checklist skryptu</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                {checklist.map(item => (
                  <span key={item.key} style={{
                    fontSize: 10, padding: '3px 8px', borderRadius: 4, fontFamily: 'DM Mono',
                    background: call[item.key] ? '#EDF7F2' : '#FEF2F0',
                    color: call[item.key] ? '#1A7A4A' : '#C0392B',
                    border: `1px solid ${call[item.key] ? '#9AD5BC' : '#F5C0BB'}`
                  }}>
                    {call[item.key] ? '✓' : '✗'} {item.label}
                  </span>
                ))}
              </div>
              {call.co_powiedzial && <div style={{ fontSize: 12, color: '#6B6560', lineHeight: 1.6 }}><strong>Klient:</strong> {call.co_powiedzial}</div>}
            </div>
            <div>
              {call.co_przeoczono && (
                <div style={{ fontSize: 12, color: '#6B6560', lineHeight: 1.6, marginBottom: 8 }}>
                  <strong>Przeoczono:</strong> {call.co_przeoczono}
                </div>
              )}
              {call.akcja && (
                <div style={{ fontSize: 12, color: '#1A7A4A', lineHeight: 1.6, paddingLeft: 10, borderLeft: '2px solid #1A7A4A' }}>
                  {call.akcja}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
