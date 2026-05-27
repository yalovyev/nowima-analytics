import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, parseISO, subWeeks, subMonths } from 'date-fns';

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.REACT_APP_SUPABASE_KEY || '';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const C = {
  nowima:'#5A171E',lime:'#D1E925',limeDark:'#8A9C00',
  beata:'#5A171E',kamil:'#8A9C00',
  red:'#C0392B',redLight:'#FEF2F0',redBorder:'#F5C0BB',
  amber:'#C07A1A',amberLight:'#FEF8EC',amberBorder:'#F5D89A',
  green:'#1A7A4A',greenLight:'#EDF7F2',greenBorder:'#9AD5BC',
  bg:'#F5F3EF',surface:'#FFFFFF',surface2:'#F9F8F5',
  border:'#E8E4DC',text:'#1A1714',text2:'#6B6560',text3:'#A09890',
};

const PAGE_SIZE = 100;

export default function App() {
  const [allData,setAllData]=useState([]);
  const [prevData,setPrevData]=useState([]);
  const [companies,setCompanies]=useState([]);
  const [companiesLoading,setCompaniesLoading]=useState(false);
  const [loading,setLoading]=useState(true);
  const [period,setPeriod]=useState('day');
  const [customStart,setCustomStart]=useState('');
  const [customEnd,setCustomEnd]=useState('');
  const [showCalendar,setShowCalendar]=useState(false);
  const [mgr,setMgr]=useState('all');
  const [source,setSource]=useState('calls');
  const [lastUpdate,setLastUpdate]=useState(new Date());
  const [activeCall,setActiveCall]=useState(null);
  const [view,setView]=useState('dashboard');
  const [search,setSearch]=useState('');
  const [portfolioSearch,setPortfolioSearch]=useState('');
  const [portfolioFilter,setPortfolioFilter]=useState('all');
  const [portfolioMgr,setPortfolioMgr]=useState('all');
  const [portfolioPage,setPortfolioPage]=useState(0);
  const [notif,setNotif]=useState(null);
  const [showBurger,setShowBurger]=useState(false);

  const getRange=useCallback((offset=0)=>{
    const now=new Date();
    if(period==='custom'&&customStart&&customEnd){return{start:new Date(customStart),end:new Date(customEnd+'T23:59:59')};}
    switch(period){
      case 'yesterday':{const d=subDays(now,1+offset);const s=new Date(d);s.setHours(0,0,0,0);const e=new Date(d);e.setHours(23,59,59,999);return{start:s,end:e};}
      case 'day':{const d=subDays(now,offset);const s=new Date(d);s.setHours(0,0,0,0);const e=new Date(d);e.setHours(23,59,59,999);return{start:s,end:e};}
      case 'week':return{start:startOfWeek(offset===0?now:subWeeks(now,1),{weekStartsOn:1}),end:endOfWeek(offset===0?now:subWeeks(now,1),{weekStartsOn:1})};
      case 'month':return{start:startOfMonth(offset===0?now:subMonths(now,1)),end:endOfMonth(offset===0?now:subMonths(now,1))};
      default:return{start:new Date('2025-01-01'),end:now};
    }
  },[period,customStart,customEnd]);

  const fetchData=useCallback(async()=>{
    const{start,end}=getRange(0);const{start:ps,end:pe}=getRange(1);
    let q=supabase.from('calls').select('*').gte('call_time',start.toISOString()).lte('call_time',end.toISOString()).order('call_time',{ascending:false});
    if(mgr==='beata')q=q.eq('sip','123');
    if(mgr==='kamil')q=q.eq('sip','119');
    let pq=supabase.from('calls').select('*').gte('call_time',ps.toISOString()).lte('call_time',pe.toISOString());
    const[{data},{data:pd}]=await Promise.all([q,pq]);
    if(data){setAllData(data);setLastUpdate(new Date());}
    if(pd)setPrevData(pd);
    setLoading(false);
  },[getRange,mgr]);

  const fetchCompanies=useCallback(async()=>{
    setCompaniesLoading(true);
    const{data}=await supabase.from('companies').select('*').in('manager',['Beata Janoszka','Kamil Wiśniewski','Monika Żukiewicz']).order('synced_at',{ascending:false}).limit(5000);
    if(data)setCompanies(data);
    setCompaniesLoading(false);
  },[]);

  useEffect(()=>{fetchData();const i=setInterval(fetchData,5*60*1000);return()=>clearInterval(i);},[fetchData]);
  useEffect(()=>{if(view==='portfolio')fetchCompanies();},[view,fetchCompanies]);

  useEffect(()=>{
    const sub=supabase.channel('calls').on('postgres_changes',{event:'INSERT',schema:'public',table:'calls'},(p)=>{
      setAllData(prev=>[p.new,...prev]);setLastUpdate(new Date());
      const isMeeting=p.new.sip==='meeting';
      const m=isMeeting?`🎥 ${p.new.manager}`:(p.new.sip==='123'?'Beata':'Kamil');
      setNotif(`${isMeeting?'🎥':'📞'} ${m} · ${p.new.klient||''} · ${p.new.wynik||'—'}`);
      setTimeout(()=>setNotif(null),8000);
    }).subscribe();
    return()=>sub.unsubscribe();
  },[]);

  const calls=useMemo(()=>{
    if(source==='calls')return allData.filter(c=>c.sip!=='meeting');
    if(source==='meetings')return allData.filter(c=>c.sip==='meeting');
    return allData;
  },[allData,source]);

  const prevCalls=useMemo(()=>{
    if(source==='calls')return prevData.filter(c=>c.sip!=='meeting');
    if(source==='meetings')return prevData.filter(c=>c.sip==='meeting');
    return prevData;
  },[prevData,source]);

  const filtered=useMemo(()=>{
    if(!search)return calls;
    const s=search.toLowerCase();
    return calls.filter(c=>(c.klient||'').toLowerCase().includes(s)||(c.manager||'').toLowerCase().includes(s)||(c.co_powiedzial||'').toLowerCase().includes(s)||(c.wynik||'').toLowerCase().includes(s));
  },[calls,search]);

  const filteredCompanies=useMemo(()=>{
    let list=companies;
    if(portfolioMgr!=='all')list=list.filter(c=>c.manager===portfolioMgr);
    if(portfolioFilter!=='all')list=list.filter(c=>c.potencjal===portfolioFilter);
    if(portfolioSearch){
      const s=portfolioSearch.toLowerCase();
      list=list.filter(c=>(c.nazwa||'').toLowerCase().includes(s)||(c.stage||'').toLowerCase().includes(s)||(c.manager||'').toLowerCase().includes(s));
    }
    return list;
  },[companies,portfolioFilter,portfolioMgr,portfolioSearch]);

  // Reset page when filters change
  useEffect(()=>{setPortfolioPage(0);},[portfolioMgr,portfolioFilter,portfolioSearch]);

  const totalPages=Math.ceil(filteredCompanies.length/PAGE_SIZE);
  const pagedCompanies=filteredCompanies.slice(portfolioPage*PAGE_SIZE,(portfolioPage+1)*PAGE_SIZE);

  const portfolioStats=useMemo(()=>{
    const base=portfolioMgr==='all'?companies:companies.filter(c=>c.manager===portfolioMgr);
    const now=new Date();
    const weekAgo=new Date(now-7*24*60*60*1000);
    const monthAgo=new Date(now-30*24*60*60*1000);
    return{
      total:base.length,
      wysoki:base.filter(c=>c.potencjal==='wysoki').length,
      sredni:base.filter(c=>c.potencjal==='średni').length,
      niski:base.filter(c=>c.potencjal==='niski').length,
      newWeek:base.filter(c=>new Date(c.created_at)>weekAgo).length,
      newMonth:base.filter(c=>new Date(c.created_at)>monthAgo).length,
    };
  },[companies,portfolioMgr]);

  const portfolioTrend=useMemo(()=>{
    const base=portfolioMgr==='all'?companies:companies.filter(c=>c.manager===portfolioMgr);
    const months={};
    base.forEach(c=>{
      if(!c.created_at)return;
      const month=format(parseISO(c.created_at),'MM.yyyy');
      if(!months[month])months[month]={month,total:0,wysoki:0,sredni:0};
      months[month].total++;
      if(c.potencjal==='wysoki')months[month].wysoki++;
      if(c.potencjal==='średni')months[month].sredni++;
    });
    return Object.values(months).sort((a,b)=>a.month.localeCompare(b.month)).slice(-12);
  },[companies,portfolioMgr]);

  const phoneCalls=allData.filter(c=>c.sip!=='meeting');
  const videoMeetings=allData.filter(c=>c.sip==='meeting');
  const beata=phoneCalls.filter(c=>c.sip==='123');
  const kamil=phoneCalls.filter(c=>c.sip==='119');
  const over60=phoneCalls.filter(c=>c.duration>60);
  const over180=phoneCalls.filter(c=>c.duration>180);
  const lpr=phoneCalls.filter(c=>c.lpr);
  const hot=calls.filter(c=>c.wynik==='gorący lead');
  const pilne=calls.filter(c=>c.pilne);
  const meetingsZoom=phoneCalls.filter(c=>c.checklist_zoom);
  const bots=phoneCalls.filter(c=>c.wynik==='bot/automat'||c.wynik==='bot');
  const secs=phoneCalls.filter(c=>c.wynik==='sekretariat');
  const followup=phoneCalls.filter(c=>c.checklist_nastepny_krok);
  const lprConv=over60.length>0?Math.round(lpr.length/over60.length*100):0;
  const secConv=secs.length>0?Math.round(lpr.length/secs.length*100):0;
  const prevLpr=prevCalls.filter(c=>c.lpr).length;
  const prevHot=prevCalls.filter(c=>c.wynik==='gorący lead').length;

  const clientCounts=useMemo(()=>{
    const map={};
    calls.filter(c=>c.klient).forEach(c=>{
      if(!map[c.klient])map[c.klient]={count:0,hot:0,lastTime:'',manager:c.manager};
      map[c.klient].count++;
      if(c.wynik==='gorący lead')map[c.klient].hot++;
      if(!map[c.klient].lastTime||c.call_time>map[c.klient].lastTime)map[c.klient].lastTime=c.call_time;
    });
    return Object.entries(map).sort((a,b)=>b[1].count-a[1].count).slice(0,10);
  },[calls]);

  const trendData=useMemo(()=>{
    const days={};
    phoneCalls.forEach(c=>{
      if(!c.call_time)return;
      const day=format(parseISO(c.call_time),'dd.MM');
      if(!days[day])days[day]={day,total:0,lpr:0,hot:0,bots:0};
      days[day].total++;
      if(c.lpr)days[day].lpr++;
      if(c.wynik==='gorący lead')days[day].hot++;
      if(c.wynik==='bot/automat'||c.wynik==='bot')days[day].bots++;
    });
    return Object.values(days).sort((a,b)=>a.day.localeCompare(b.day));
  },[phoneCalls]);

  const scriptItems=[
    {key:'checklist_przedstawil',label:'Przedstawił się'},
    {key:'checklist_szukal_lpr',label:'Szukał ŁPR'},
    {key:'checklist_spin',label:'Pytania SPIN'},
    {key:'checklist_parametry',label:'Parametry projektu'},
    {key:'checklist_zoom',label:'Zaproponował Zoom'},
    {key:'checklist_nastepny_krok',label:'Następny krok'},
  ];

  const avgKnowledge=(calls,field)=>{
    const vals=calls.filter(c=>c[field]!=null&&c[field]>0).map(c=>c[field]);
    if(vals.length===0)return null;
    return Math.round(vals.reduce((a,b)=>a+b,0)/vals.length*10)/10;
  };

  const productKnowledge=useMemo(()=>[
    {category:'Elektrycy i elektromonterzy',items:[{label:'Wiedza o elektryk./elektromont.',field:'znanie_elektryka'},{label:'Certyfikaty VCA/SEP',field:'znanie_certyfikaty'}]},
    {category:'Spawacze i monterzy',items:[{label:'Metody spawania (MIG/MAG/TIG)',field:'znanie_spawanie'},{label:'Monterzy / rysunki techniczne',field:'znanie_monterzy'}]},
  ].map(cat=>({...cat,items:cat.items.map(item=>({...item,beata:avgKnowledge(beata,item.field)||0,kamil:avgKnowledge(kamil,item.field)||0,beataCount:beata.filter(c=>c[item.field]!=null&&c[item.field]>0).length,kamilCount:kamil.filter(c=>c[item.field]!=null&&c[item.field]>0).length}))})),[beata,kamil]);

  const exportCSV=()=>{
    const h=['Data','Menedżer','Klient','Czas','LPR','Wynik','Ocena','Akcja'];
    const rows=calls.map(c=>[c.call_time?format(parseISO(c.call_time),'dd.MM.yyyy HH:mm'):'',c.manager,c.klient||'',c.duration,c.lpr?'TAK':'NIE',c.wynik||'',c.ocena||'',c.akcja||'']);
    const csv=[h,...rows].map(r=>r.join(';')).join('\n');
    const blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8;'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`nowima_${format(new Date(),'yyyy-MM-dd')}.csv`;a.click();
  };

  const exportPortfolioCSV=()=>{
    const h=['Firma','Etap','Potencjał','Menedżer','Ostatnia aktywność','Link Bitrix'];
    const rows=filteredCompanies.map(c=>[c.nazwa,c.stage||'',c.potencjal||'',c.manager||'',c.ostatnia_aktywnosc?format(parseISO(c.ostatnia_aktywnosc),'dd.MM.yyyy'):'',c.bitrix_url||'']);
    const csv=[h,...rows].map(r=>r.join(';')).join('\n');
    const blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8;'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`nowima_portfel_${format(new Date(),'yyyy-MM-dd')}.csv`;a.click();
  };

  const delta=(curr,prev)=>{if(prev===0)return null;const d=curr-prev;return{value:Math.abs(d),up:d>=0};};
  const btnStyle=(active)=>({padding:'4px 10px',borderRadius:20,border:'1px solid',cursor:'pointer',fontSize:11,fontFamily:'DM Mono',borderColor:active?C.lime:'rgba(255,255,255,0.2)',background:active?'rgba(209,233,37,0.15)':'transparent',color:active?C.lime:'rgba(255,255,255,0.65)'});
  const periodLabel={day:'Dziś',yesterday:'Wczoraj',week:'Tydzień',month:'Miesiąc',all:'Wszystko',custom:'📅 Własny'};
  const sourceLabel={all:'📊 Wszystko',calls:'📞 Rozmowy',meetings:'🎥 Spotkania'};
  const getActivePeriodLabel=()=>{if(period==='custom'&&customStart&&customEnd)return`${customStart} — ${customEnd}`;return periodLabel[period]||'—';};
  const potencjalColor={wysoki:C.green,średni:C.amber,niski:C.text3};
  const potencjalBg={wysoki:C.greenLight,średni:C.amberLight,niski:C.surface2};
  const stageColor={'Contract':C.green,'Finalization':C.green,'Offer':C.amber,'Demand':'#3B5BDB','Rezerwa na przyszłość':C.text3};
  const mgrColor={'Beata Janoszka':C.beata,'Kamil Wiśniewski':C.kamil,'Monika Żukiewicz':'#7B5EA7'};

  const pbtn=(active)=>({padding:'8px 14px',borderRadius:10,border:`1px solid ${active?C.nowima:C.border}`,background:active?'#F4ECED':C.surface,color:active?C.nowima:C.text2,fontSize:12,cursor:'pointer',fontFamily:'DM Mono'});

  return(
    <div style={{fontFamily:"'DM Sans',sans-serif",background:C.bg,minHeight:'100vh',color:C.text}}>
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=DM+Sans:wght@300;400;500&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet"/>
      {notif&&<div style={{position:'fixed',top:70,right:20,zIndex:1000,background:C.nowima,color:'white',padding:'12px 20px',borderRadius:10,boxShadow:'0 4px 20px rgba(90,23,30,0.4)',fontSize:13,fontFamily:'DM Mono',maxWidth:360,borderLeft:`4px solid ${C.lime}`}}>{notif}</div>}

      <header style={{background:C.nowima,position:'sticky',top:0,zIndex:100,boxShadow:'0 2px 12px rgba(90,23,30,0.3)',borderBottom:'2px solid rgba(209,233,37,0.3)'}}>
        <div style={{maxWidth:1440,margin:'0 auto',padding:'0 20px',minHeight:56,display:'flex',alignItems:'center',gap:10,flexWrap:'wrap',paddingTop:8,paddingBottom:8}}>
          <div style={{display:'flex',alignItems:'center',gap:10,marginRight:4}}>
            <div style={{background:'rgba(209,233,37,0.15)',border:'1px solid rgba(209,233,37,0.3)',borderRadius:6,padding:'4px 10px',fontFamily:'Outfit',fontWeight:700,fontSize:15,color:C.lime,letterSpacing:1}}>NOWIMA</div>
            <span style={{fontSize:11,color:'rgba(255,255,255,0.5)',fontFamily:'DM Mono'}}>Analytics</span>
          </div>
          <div style={{display:'flex',gap:4}}>
            {[['dashboard','📊 Dashboard'],['calls','📞 Rozmowy'],['trends','📈 Trendy'],['portfolio','🏢 Portfel']].map(([v,l])=>(
              <button key={v} onClick={()=>setView(v)} style={btnStyle(view===v)}>{l}</button>
            ))}
          </div>
          {view!=='portfolio'&&(
            <>
              <div style={{position:'relative'}}>
                <button onClick={()=>setShowBurger(!showBurger)} style={{display:'flex',flexDirection:'column',gap:4,padding:'8px 10px',borderRadius:8,border:'1px solid rgba(255,255,255,0.2)',background:showBurger?'rgba(209,233,37,0.15)':'transparent',cursor:'pointer',alignItems:'center'}}>
                  <div style={{width:16,height:2,background:source!=='all'?C.lime:'rgba(255,255,255,0.7)',borderRadius:1}}/>
                  <div style={{width:16,height:2,background:source!=='all'?C.lime:'rgba(255,255,255,0.7)',borderRadius:1}}/>
                  <div style={{width:16,height:2,background:source!=='all'?C.lime:'rgba(255,255,255,0.7)',borderRadius:1}}/>
                </button>
                {showBurger&&(
                  <div style={{position:'absolute',top:44,left:0,background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,overflow:'hidden',zIndex:9999,boxShadow:'0 8px 24px rgba(0,0,0,0.15)',minWidth:180}}>
                    <div style={{padding:'8px 14px',fontSize:10,fontFamily:'DM Mono',textTransform:'uppercase',color:C.text3,letterSpacing:'0.08em',borderBottom:`1px solid ${C.border}`}}>Źródło danych</div>
                    {[['all','📊 Wszystko','Rozmowy + Spotkania'],['calls','📞 Rozmowy','Tylko telefony'],['meetings','🎥 Spotkania','Tylko wideo']].map(([s,icon,desc])=>(
                      <div key={s} onClick={()=>{setSource(s);setShowBurger(false);}} style={{padding:'10px 14px',cursor:'pointer',display:'flex',alignItems:'center',gap:10,background:source===s?'#F4ECED':'transparent',borderBottom:`1px solid ${C.border}`}}>
                        <div style={{fontSize:16}}>{icon.split(' ')[0]}</div>
                        <div><div style={{fontSize:12,fontWeight:500,color:source===s?C.nowima:C.text}}>{icon}</div><div style={{fontSize:10,color:C.text3,fontFamily:'DM Mono'}}>{desc}</div></div>
                        {source===s&&<div style={{marginLeft:'auto',color:C.nowima,fontSize:14}}>✓</div>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                {[['yesterday','Wczoraj'],['day','Dziś'],['week','Tydzień'],['month','Miesiąc'],['all','Wszystko']].map(([p,l])=>(
                  <button key={p} onClick={()=>{setPeriod(p);setShowCalendar(false);}} style={btnStyle(period===p)}>{l}</button>
                ))}
                <div style={{position:'relative'}}>
                  <button onClick={()=>{setPeriod('custom');setShowCalendar(!showCalendar);}} style={btnStyle(period==='custom')}>📅</button>
                  {showCalendar&&(
                    <div style={{position:'absolute',top:36,left:0,background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:16,zIndex:9999,boxShadow:'0 8px 24px rgba(0,0,0,0.15)',minWidth:280}}>
                      <div style={{fontSize:11,fontFamily:'DM Mono',color:C.text3,marginBottom:8,textTransform:'uppercase'}}>Wybierz zakres dat</div>
                      <div style={{display:'flex',flexDirection:'column',gap:8}}>
                        <div><div style={{fontSize:11,color:C.text3,marginBottom:4}}>Od:</div><input type="date" value={customStart} onChange={e=>setCustomStart(e.target.value)} style={{width:'100%',padding:'8px 10px',borderRadius:6,border:'1px solid #E8E4DC',fontSize:13,outline:'none',boxSizing:'border-box',background:'#FFF',color:'#1A1714',cursor:'pointer'}}/></div>
                        <div><div style={{fontSize:11,color:C.text3,marginBottom:4}}>Do:</div><input type="date" value={customEnd} onChange={e=>setCustomEnd(e.target.value)} style={{width:'100%',padding:'8px 10px',borderRadius:6,border:'1px solid #E8E4DC',fontSize:13,outline:'none',boxSizing:'border-box',background:'#FFF',color:'#1A1714',cursor:'pointer'}}/></div>
                        <button onClick={()=>setShowCalendar(false)} style={{padding:'8px',borderRadius:6,background:C.nowima,color:'white',border:'none',cursor:'pointer',fontSize:12,fontFamily:'DM Mono'}}>✓ Zastosuj</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div style={{display:'flex',gap:4}}>
                {[['all','Wszyscy'],['beata','Beata'],['kamil','Kamil']].map(([m,l])=>(
                  <button key={m} onClick={()=>setMgr(m)} style={btnStyle(mgr===m)}>{l}</button>
                ))}
              </div>
            </>
          )}
          <div style={{marginLeft:'auto',display:'flex',gap:8,alignItems:'center'}}>
            {view!=='portfolio'&&<span style={{fontSize:11,padding:'3px 10px',borderRadius:20,border:'1px solid rgba(255,255,255,0.25)',color:'rgba(255,255,255,0.85)',background:'rgba(255,255,255,0.08)',fontFamily:'DM Mono'}}><span style={{opacity:0.6}}>📅</span> {getActivePeriodLabel()} · {sourceLabel[source]}</span>}
            {view==='portfolio'&&<span style={{fontSize:11,padding:'3px 10px',borderRadius:20,border:`1px solid ${C.lime}`,color:C.lime,background:'rgba(209,233,37,0.1)',fontFamily:'DM Mono'}}>🏢 {portfolioStats.total} firm</span>}
            {hot.length>0&&view!=='portfolio'&&<span style={{fontSize:11,padding:'3px 10px',borderRadius:20,border:`1px solid ${C.lime}`,color:C.lime,background:'rgba(209,233,37,0.1)',fontFamily:'DM Mono'}}>🔥 {hot.length}</span>}
            {bots.length>0&&view!=='portfolio'&&<span style={{fontSize:11,padding:'3px 10px',borderRadius:20,border:'1px solid #F5D89A',color:'#C07A1A',background:'rgba(192,122,26,0.1)',fontFamily:'DM Mono'}}>🤖 {bots.length}</span>}
            <button onClick={view==='portfolio'?exportPortfolioCSV:exportCSV} style={{padding:'4px 10px',borderRadius:20,border:'1px solid rgba(255,255,255,0.2)',background:'transparent',color:'rgba(255,255,255,0.6)',fontSize:11,fontFamily:'DM Mono',cursor:'pointer'}}>⬇ CSV</button>
            <span style={{fontSize:10,color:'rgba(255,255,255,0.3)',fontFamily:'DM Mono'}}>↻ {format(lastUpdate,'HH:mm')}</span>
          </div>
        </div>
      </header>

      <div style={{maxWidth:1440,margin:'0 auto',padding:'24px 20px 80px'}}>
        {loading?(
          <div style={{textAlign:'center',padding:80,color:C.text3,fontFamily:'DM Mono'}}>⏳ Ładowanie danych...</div>
        ):(
          <>
            {view==='portfolio'&&(
              <>
                {/* Manager filter tabs */}
                <div style={{display:'flex',gap:8,marginBottom:20,flexWrap:'wrap',alignItems:'center'}}>
                  {[['all','👥 Wszyscy',companies.length],['Beata Janoszka','Beata',companies.filter(c=>c.manager==='Beata Janoszka').length],['Kamil Wiśniewski','Kamil',companies.filter(c=>c.manager==='Kamil Wiśniewski').length],['Monika Żukiewicz','Monika',companies.filter(c=>c.manager==='Monika Żukiewicz').length]].map(([m,l,cnt])=>(
                    <button key={m} onClick={()=>setPortfolioMgr(m)} style={{...pbtn(portfolioMgr===m),display:'flex',alignItems:'center',gap:6}}>
                      {l}
                      <span style={{fontSize:10,padding:'1px 6px',borderRadius:10,background:portfolioMgr===m?C.nowima+'22':'#E8E4DC',color:portfolioMgr===m?C.nowima:C.text3,fontFamily:'DM Mono'}}>{cnt}</span>
                    </button>
                  ))}
                </div>

                <Sec icon="🏢" title={`Portfel firm — ${portfolioMgr==='all'?'wszyscy menedżerowie':portfolioMgr}`}/>
                <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:12,marginBottom:24}}>
                  <KpiCard label="Wszystkie firmy" value={portfolioStats.total} sub="w portfelu" accent={C.nowima}/>
                  <KpiCard label="Wysoki potencjał" value={portfolioStats.wysoki} sub="Offer + Contract + Finalization" accent={C.green} good/>
                  <KpiCard label="Średni potencjał" value={portfolioStats.sredni} sub="Demand" accent={C.amber}/>
                  <KpiCard label="Nowe w tym tygodniu" value={portfolioStats.newWeek} sub="dodane w ciągu 7 dni" accent={C.kamil}/>
                  <KpiCard label="Nowe w tym miesiącu" value={portfolioStats.newMonth} sub="dodane w ciągu 30 dni" accent={C.kamil}/>
                </div>

                <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:10,marginBottom:24}}>
                  {[{stage:'Contract',label:'Contract',col:C.green},{stage:'Finalization',label:'Finalization',col:C.green},{stage:'Offer',label:'Offer',col:C.amber},{stage:'Demand',label:'Demand',col:'#3B5BDB'},{stage:'Rezerwa na przyszłość',label:'Rezerwa',col:C.text3}].map(s=>{
                    const base=portfolioMgr==='all'?companies:companies.filter(c=>c.manager===portfolioMgr);
                    return(<div key={s.stage} style={{background:C.surface,border:`1px solid ${C.border}`,borderTop:`3px solid ${s.col}`,borderRadius:12,padding:'14px 16px'}}><div style={{fontSize:10,fontFamily:'DM Mono',textTransform:'uppercase',color:C.text3,marginBottom:6}}>{s.label}</div><div style={{fontFamily:'Outfit',fontWeight:700,fontSize:26,color:s.col}}>{base.filter(c=>c.stage===s.stage).length}</div></div>);
                  })}
                </div>

                {portfolioTrend.length>1&&(
                  <>
                    <Sec icon="📈" title="Wzrost portfela w czasie"/>
                    <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:'18px 20px',marginBottom:24}}>
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={portfolioTrend}>
                          <XAxis dataKey="month" tick={{fontSize:10,fontFamily:'DM Mono',fill:C.text3}}/>
                          <YAxis tick={{fontSize:10,fontFamily:'DM Mono',fill:C.text3}}/>
                          <Tooltip contentStyle={{fontFamily:'DM Mono',fontSize:11}}/>
                          <Bar dataKey="wysoki" fill={C.green} radius={[4,4,0,0]} name="Wysoki" stackId="a"/>
                          <Bar dataKey="sredni" fill={C.amber} radius={[0,0,0,0]} name="Średni" stackId="a"/>
                          <Bar dataKey="total" fill={C.nowima} fillOpacity={0.2} radius={[4,4,0,0]} name="Łącznie"/>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </>
                )}

                <Sec icon="📋" title="Lista firm w portfelu" badge={`${filteredCompanies.length} z ${portfolioStats.total}`}/>
                <div style={{display:'flex',gap:10,marginBottom:14,flexWrap:'wrap'}}>
                  <input type="text" placeholder="🔍 Szukaj firmy..." value={portfolioSearch} onChange={e=>setPortfolioSearch(e.target.value)}
                    style={{flex:1,minWidth:200,padding:'10px 16px',borderRadius:10,border:`1px solid ${C.border}`,background:C.surface,fontSize:13,fontFamily:'DM Sans',outline:'none'}}/>
                  <div style={{display:'flex',gap:6}}>
                    {[['all','Wszystkie'],['wysoki','🟢 Wysoki'],['średni','🟡 Średni'],['niski','⚪ Niski']].map(([f,l])=>(
                      <button key={f} onClick={()=>setPortfolioFilter(f)} style={pbtn(portfolioFilter===f)}>{l}</button>
                    ))}
                  </div>
                </div>

                {companiesLoading?(
                  <div style={{textAlign:'center',padding:40,color:C.text3,fontFamily:'DM Mono'}}>⏳ Ładowanie portfela...</div>
                ):(
                  <>
                    <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,overflow:'hidden',marginBottom:12}}>
                      <table style={{width:'100%',borderCollapse:'collapse'}}>
                        <thead>
                          <tr style={{background:C.surface2,borderBottom:`1px solid ${C.border}`}}>
                            {['#','Firma','Etap','Potencjał','Menedżer','Ostatnia aktywność',''].map(h=>(
                              <th key={h} style={{padding:'10px 14px',textAlign:'left',fontSize:10,fontFamily:'DM Mono',textTransform:'uppercase',letterSpacing:'0.07em',color:C.text3}}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {pagedCompanies.map((company,i)=>(
                            <tr key={company.id} style={{borderBottom:`1px solid ${C.border}`,background:i%2===0?C.surface:C.surface2}}>
                              <td style={{padding:'10px 14px',fontSize:11,color:C.text3,fontFamily:'DM Mono'}}>{portfolioPage*PAGE_SIZE+i+1}</td>
                              <td style={{padding:'10px 14px'}}><div style={{fontSize:13,fontWeight:500,color:C.text}}>{company.nazwa}</div></td>
                              <td style={{padding:'10px 14px'}}>
                                <span style={{fontSize:10,padding:'2px 8px',borderRadius:20,fontFamily:'DM Mono',color:stageColor[company.stage]||C.text3,background:`${stageColor[company.stage]||C.text3}18`,border:`1px solid ${stageColor[company.stage]||C.text3}40`}}>{company.stage||'—'}</span>
                              </td>
                              <td style={{padding:'10px 14px'}}>
                                <span style={{fontSize:11,padding:'2px 8px',borderRadius:20,fontFamily:'DM Mono',color:potencjalColor[company.potencjal]||C.text3,background:potencjalBg[company.potencjal]||C.surface2,border:`1px solid ${potencjalColor[company.potencjal]||C.text3}30`}}>
                                  {company.potencjal==='wysoki'?'🟢':company.potencjal==='średni'?'🟡':'⚪'} {company.potencjal||'—'}
                                </span>
                              </td>
                              <td style={{padding:'10px 14px',fontSize:12,color:mgrColor[company.manager]||C.text2,fontWeight:500}}>{company.manager?.split(' ')[0]||'—'}</td>
                              <td style={{padding:'10px 14px',fontSize:11,color:C.text3,fontFamily:'DM Mono'}}>{company.ostatnia_aktywnosc?format(parseISO(company.ostatnia_aktywnosc),'dd.MM.yyyy'):'—'}</td>
                              <td style={{padding:'10px 14px'}}>
                                {company.bitrix_url&&<a href={company.bitrix_url} target="_blank" rel="noopener noreferrer" style={{fontSize:11,color:C.nowima,fontFamily:'DM Mono',textDecoration:'none',padding:'3px 8px',border:`1px solid ${C.nowima}30`,borderRadius:6,background:'#F4ECED'}}>→ Bitrix</a>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {filteredCompanies.length===0&&<div style={{textAlign:'center',padding:40,color:C.text3,fontFamily:'DM Mono'}}>Brak firm spełniających kryteria</div>}
                    </div>

                    {/* Pagination */}
                    {totalPages>1&&(
                      <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:8,marginBottom:24}}>
                        <button onClick={()=>setPortfolioPage(0)} disabled={portfolioPage===0} style={{padding:'6px 12px',borderRadius:8,border:`1px solid ${C.border}`,background:C.surface,cursor:portfolioPage===0?'not-allowed':'pointer',fontSize:12,fontFamily:'DM Mono',color:portfolioPage===0?C.text3:C.text,opacity:portfolioPage===0?0.4:1}}>«</button>
                        <button onClick={()=>setPortfolioPage(p=>Math.max(0,p-1))} disabled={portfolioPage===0} style={{padding:'6px 12px',borderRadius:8,border:`1px solid ${C.border}`,background:C.surface,cursor:portfolioPage===0?'not-allowed':'pointer',fontSize:12,fontFamily:'DM Mono',color:portfolioPage===0?C.text3:C.text,opacity:portfolioPage===0?0.4:1}}>‹</button>
                        {Array.from({length:totalPages},(_,i)=>i).filter(i=>Math.abs(i-portfolioPage)<=2).map(i=>(
                          <button key={i} onClick={()=>setPortfolioPage(i)} style={{padding:'6px 12px',borderRadius:8,border:`1px solid ${i===portfolioPage?C.nowima:C.border}`,background:i===portfolioPage?'#F4ECED':C.surface,cursor:'pointer',fontSize:12,fontFamily:'DM Mono',color:i===portfolioPage?C.nowima:C.text,fontWeight:i===portfolioPage?700:400}}>{i+1}</button>
                        ))}
                        <button onClick={()=>setPortfolioPage(p=>Math.min(totalPages-1,p+1))} disabled={portfolioPage===totalPages-1} style={{padding:'6px 12px',borderRadius:8,border:`1px solid ${C.border}`,background:C.surface,cursor:portfolioPage===totalPages-1?'not-allowed':'pointer',fontSize:12,fontFamily:'DM Mono',color:portfolioPage===totalPages-1?C.text3:C.text,opacity:portfolioPage===totalPages-1?0.4:1}}>›</button>
                        <button onClick={()=>setPortfolioPage(totalPages-1)} disabled={portfolioPage===totalPages-1} style={{padding:'6px 12px',borderRadius:8,border:`1px solid ${C.border}`,background:C.surface,cursor:portfolioPage===totalPages-1?'not-allowed':'pointer',fontSize:12,fontFamily:'DM Mono',color:portfolioPage===totalPages-1?C.text3:C.text,opacity:portfolioPage===totalPages-1?0.4:1}}>»</button>
                        <span style={{fontSize:11,color:C.text3,fontFamily:'DM Mono',marginLeft:8}}>Strona {portfolioPage+1} z {totalPages} · {filteredCompanies.length} firm</span>
                      </div>
                    )}
                  </>
                )}
              </>
            )}

            {view==='dashboard'&&(
              <>
                {meetingsZoom.length===0&&phoneCalls.length>0&&source!=='meetings'&&(<Alert color={C.red} border={C.redBorder} bg={C.redLight}>🚨 <strong>Krytyczna luka:</strong> Brak umówionych spotkań online. Bez spotkania nie ma oferty.</Alert>)}
                {bots.length>0&&phoneCalls.length>0&&bots.length/phoneCalls.length>0.2&&(<Alert color={C.amber} border={C.amberBorder} bg={C.amberLight}>🤖 <strong>Boty/automaty:</strong> {bots.length} połączeń ({Math.round(bots.length/phoneCalls.length*100)}%) to automaty.</Alert>)}
                <Sec icon="📊" title={`Kluczowe wskaźniki · ${periodLabel[period]||'Własny'}`}/>
                {source!=='meetings'&&(
                  <>
                    <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:8}}><span style={{fontSize:11,fontFamily:'DM Mono',color:C.text3,textTransform:'uppercase',letterSpacing:'0.08em'}}>📞 Rozmowy telefoniczne</span></div>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:12}}>
                      <KpiCard label="Wszystkie rozmowy" value={phoneCalls.length} sub={`B: ${beata.length} · K: ${kamil.length}`} accent={C.nowima} d={delta(phoneCalls.length,prevData.filter(c=>c.sip!=='meeting').length)}/>
                      <KpiCard label="Rozmowy powyżej 60s" value={over60.length} sub={`B: ${beata.filter(c=>c.duration>60).length} · K: ${kamil.filter(c=>c.duration>60).length}`} accent={C.nowima}/>
                      <KpiCard label="Kontakty z ŁPR" value={lpr.length} sub={`B: ${beata.filter(c=>c.lpr).length} · K: ${kamil.filter(c=>c.lpr).length}`} accent={C.green} good d={delta(lpr.length,prevLpr)}/>
                      <KpiCard label="Konwersja ŁPR z >60s" value={`${lprConv}%`} sub={`${lpr.length} z ${over60.length} rozmów`} accent={C.green} good/>
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(6,1fr)',gap:10,marginBottom:24}}>
                      <KpiSm label="Powyżej 180s" value={over180.length} sub={`B:${beata.filter(c=>c.duration>180).length} K:${kamil.filter(c=>c.duration>180).length}`}/>
                      <KpiSm label="Follow-up" value={followup.length} sub={`B:${beata.filter(c=>c.checklist_nastepny_krok).length} K:${kamil.filter(c=>c.checklist_nastepny_krok).length}`}/>
                      <KpiSm label="Konw. follow-up" value={over60.length>0?`${Math.round(followup.length/over60.length*100)}%`:'—'} sub={`${followup.length} z ${over60.length}`} good/>
                      <KpiSm label="Sekretariat" value={secs.length} sub={`B:${beata.filter(c=>c.wynik==='sekretariat').length} K:${kamil.filter(c=>c.wynik==='sekretariat').length}`}/>
                      <KpiSm label="Konw. od sekr." value={`${secConv}%`} sub={`${lpr.length} przełączeń`} good/>
                      <KpiSm label="Bot/automat" value={bots.length} sub={`${phoneCalls.length>0?Math.round(bots.length/phoneCalls.length*100):0}% wszystkich`} danger={bots.length/Math.max(phoneCalls.length,1)>0.15}/>
                    </div>
                  </>
                )}
                {source!=='calls'&&videoMeetings.length>0&&(
                  <>
                    <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:8}}><span style={{fontSize:11,fontFamily:'DM Mono',color:C.text3,textTransform:'uppercase',letterSpacing:'0.08em'}}>🎥 Spotkania wideo</span></div>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:24}}>
                      <KpiCard label="Spotkania łącznie" value={videoMeetings.length} sub={`B: ${videoMeetings.filter(c=>c.manager==='Beata Janoszka').length} · K: ${videoMeetings.filter(c=>c.manager==='Kamil Wisniewski').length}`} accent={C.kamil}/>
                      <KpiCard label="Wysoki potencjał" value={videoMeetings.filter(c=>c.wynik==='wysoki'||c.wynik==='sukces'||c.wynik==='częściowy sukces').length} sub="sukces lub częściowy sukces" accent={C.green} good/>
                      <KpiCard label="Gorące leady" value={videoMeetings.filter(c=>c.wynik==='gorący lead').length} sub="z videorozmów" accent={C.red}/>
                      <KpiCard label="Śr. ocena spotkań" value={videoMeetings.length>0?(videoMeetings.reduce((s,c)=>s+(c.ocena||0),0)/videoMeetings.length).toFixed(1):'—'} sub="z 5 możliwych" accent={C.amber}/>
                    </div>
                    <Sec icon="🎥" title="Spotkania wideo z klientami" badge={videoMeetings.length}/>
                    <div style={{display:'flex',flexDirection:'column',gap:8,marginBottom:24}}>
                      {videoMeetings.slice(0,10).map(c=>(<MeetingCard key={c.id} meeting={c} isOpen={activeCall===c.id} onToggle={()=>setActiveCall(activeCall===c.id?null:c.id)}/>))}
                    </div>
                  </>
                )}
                {source!=='meetings'&&(
                  <>
                    <Sec icon="🔽" title="Lejek sprzedażowy"/>
                    <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,overflow:'hidden',marginBottom:16}}>
                      <div style={{display:'flex'}}>
                        {[{l:'Rozmowy',v:phoneCalls.length,p:'100%',col:C.nowima},{l:'Z ŁPR',v:lpr.length,p:phoneCalls.length>0?`${Math.round(lpr.length/phoneCalls.length*100)}%`:'—',col:C.text},{l:'Zainteresowani',v:phoneCalls.filter(c=>c.wynik==='zainteresowany').length,p:'—',col:C.nowima,bg:'#F4ECED'},{l:'Gorące leady',v:hot.length,p:'—',col:C.red,bg:C.redLight},{l:'Spotkanie',v:meetingsZoom.length,p:'—',col:C.text3,dim:meetingsZoom.length===0},{l:'Oferta',v:0,p:'—',col:C.text3,dim:true}].map((s,i)=>(
                          <div key={i} style={{flex:1,padding:'14px 10px',textAlign:'center',borderRight:i<5?`1px solid ${C.border}`:'none',background:s.bg||C.surface,opacity:s.dim?0.4:1}}>
                            <div style={{fontFamily:'Outfit',fontWeight:700,fontSize:26,color:s.col}}>{s.v}</div>
                            <div style={{fontSize:9,textTransform:'uppercase',letterSpacing:'0.08em',color:C.text3,margin:'4px 0',fontFamily:'DM Mono'}}>{s.l}</div>
                            <div style={{fontSize:10,color:C.text2}}>{s.p}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
                {hot.length>0&&(<><Sec icon="🔥" title="Gorące leady i pilne działania" badge={hot.length}/><div style={{display:'flex',flexDirection:'column',gap:10,marginBottom:24}}>{[...hot,...pilne.filter(c=>c.wynik!=='gorący lead')].map(c=>(<LeadCard key={c.id} call={c} onOpen={()=>{setActiveCall(c.id);setView('calls');}}/>))}</div></>)}
                {source!=='meetings'&&(
                  <>
                    <Sec icon="👥" title="Porównanie menedżerów"/>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginBottom:24}}>
                      <MgrCard manager="Beata Janoszka" sip="123" calls={beata} color={C.beata}/>
                      <MgrCard manager="Kamil Wisniewski" sip="119" calls={kamil} color={C.kamil}/>
                    </div>
                    <Sec icon="📋" title="Realizacja skryptu NOWIMA + SPIN"/>
                    <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,overflow:'hidden',marginBottom:24}}>
                      <div style={{display:'grid',gridTemplateColumns:'28px 1fr 100px 100px',background:C.surface2,padding:'10px 14px',borderBottom:`1px solid ${C.border}`}}>
                        <div/><div style={{fontSize:10,fontFamily:'DM Mono',textTransform:'uppercase',letterSpacing:'0.08em',color:C.text3}}>Krok skryptu</div>
                        <div style={{fontSize:10,fontFamily:'DM Mono',color:C.beata,textAlign:'center'}}>Beata</div>
                        <div style={{fontSize:10,fontFamily:'DM Mono',color:C.kamil,textAlign:'center'}}>Kamil</div>
                      </div>
                      {scriptItems.map(item=>{
                        const bp=beata.length>0?Math.round(beata.filter(c=>c[item.key]).length/beata.length*100):0;
                        const kp=kamil.length>0?Math.round(kamil.filter(c=>c[item.key]).length/kamil.length*100):0;
                        return(<div key={item.key} style={{display:'grid',gridTemplateColumns:'28px 1fr 100px 100px',borderBottom:`1px solid ${C.border}`,alignItems:'center'}}><div style={{textAlign:'center',padding:'12px 8px',fontSize:13}}>{bp>=70&&kp>=70?'✅':bp<40||kp<40?'🔴':'⚠️'}</div><div style={{padding:'12px 14px',fontSize:12,color:C.text2}}>{item.label}</div><div style={{padding:'10px 8px',textAlign:'center'}}><div style={{fontSize:13,color:bp>=70?C.green:C.red}}>{bp>=70?'✓':'✗'}</div><div style={{fontSize:10,fontFamily:'DM Mono',color:C.beata}}>{bp}%</div></div><div style={{padding:'10px 8px',textAlign:'center'}}><div style={{fontSize:13,color:kp>=70?C.green:C.red}}>{kp>=70?'✓':'✗'}</div><div style={{fontSize:10,fontFamily:'DM Mono',color:C.kamil}}>{kp}%</div></div></div>);
                      })}
                    </div>
                    <Sec icon="🏗️" title="Znajomość produktu NOWIMA"/>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginBottom:24}}>
                      {productKnowledge.map(cat=>(<div key={cat.category} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:'18px 20px'}}><div style={{fontFamily:'Outfit',fontWeight:700,fontSize:13,marginBottom:14}}>{cat.category}</div>{cat.items.map(item=>(<div key={item.label} style={{marginBottom:12}}><div style={{fontSize:12,color:C.text2,marginBottom:5}}>{item.label}</div>{[{name:'Beata',val:item.beata,count:item.beataCount,color:C.beata},{name:'Kamil',val:item.kamil,count:item.kamilCount,color:C.kamil}].map(m=>(<div key={m.name} style={{display:'flex',alignItems:'center',gap:8,marginBottom:3}}><div style={{fontSize:10,fontFamily:'DM Mono',fontWeight:500,width:38,color:m.color}}>{m.name}</div><div style={{flex:1,background:C.bg,borderRadius:4,height:7,overflow:'hidden'}}><div style={{width:`${m.val*10}%`,height:'100%',background:m.val>0?m.color:'#E8E4DC',borderRadius:4}}/></div><div style={{fontSize:11,fontFamily:'DM Mono',width:48,textAlign:'right',color:m.val>0?m.color:C.text3}}>{m.val>0?`${m.val}/10`:'—'}</div><div style={{fontSize:9,color:C.text3,fontFamily:'DM Mono'}}>{m.count>0?`(${m.count})`:'brak'}</div></div>))}</div>))}</div>))}
                    </div>
                  </>
                )}
                {clientCounts.length>0&&(<><Sec icon="🏆" title="Top klienci" badge={clientCounts.length}/><div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,overflow:'hidden',marginBottom:24}}><table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr style={{background:C.surface2,borderBottom:`1px solid ${C.border}`}}>{['#','Klient','Menedżer','Kontaktów','Hot','Ostatni kontakt'].map(h=>(<th key={h} style={{padding:'9px 14px',textAlign:'left',fontSize:10,fontFamily:'DM Mono',textTransform:'uppercase',letterSpacing:'0.07em',color:C.text3}}>{h}</th>))}</tr></thead><tbody>{clientCounts.map(([name,data],i)=>(<tr key={name} style={{borderBottom:`1px solid ${C.border}`}}><td style={{padding:'10px 14px',fontSize:12,color:C.text3,fontFamily:'DM Mono'}}>#{i+1}</td><td style={{padding:'10px 14px',fontSize:13,fontWeight:500}}>{name}</td><td style={{padding:'10px 14px',fontSize:11,color:data.manager==='Beata Janoszka'?C.beata:C.kamil}}>{data.manager==='Beata Janoszka'?'Beata':'Kamil'}</td><td style={{padding:'10px 14px',fontSize:13,fontFamily:'DM Mono'}}>{data.count}</td><td style={{padding:'10px 14px'}}>{data.hot>0&&<span style={{background:C.redLight,color:C.red,border:`1px solid ${C.redBorder}`,borderRadius:20,padding:'2px 8px',fontSize:10,fontFamily:'DM Mono'}}>🔥 {data.hot}</span>}</td><td style={{padding:'10px 14px',fontSize:11,color:C.text3,fontFamily:'DM Mono'}}>{data.lastTime?format(parseISO(data.lastTime),'dd.MM HH:mm'):'—'}</td></tr>))}</tbody></table></div></>)}
                <Sec icon="💡" title="Co działa / co wymaga poprawy"/>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginBottom:24}}>
                  <div style={{background:C.surface,border:`1px solid ${C.border}`,borderLeft:`4px solid ${C.green}`,borderRadius:12,padding:'18px 20px'}}><div style={{fontFamily:'Outfit',fontWeight:700,fontSize:13,marginBottom:10}}>✅ Co działa dobrze</div><div style={{fontSize:12,color:C.text2,lineHeight:1.7}}>{beata.length>0&&`Beata: ${Math.round(beata.filter(c=>c.lpr).length/beata.length*100)}% konwersji do ŁPR. `}{kamil.length>0&&`Kamil: ${Math.round(kamil.filter(c=>c.lpr).length/kamil.length*100)}% konwersji do ŁPR. `}{lpr.length>0&&`Łącznie ${lpr.length} kontaktów z ŁPR.`}{videoMeetings.length>0&&` ${videoMeetings.length} spotkań wideo.`}{calls.length===0&&'Brak danych za wybrany okres.'}</div></div>
                  <div style={{background:C.surface,border:`1px solid ${C.border}`,borderLeft:`4px solid ${C.red}`,borderRadius:12,padding:'18px 20px'}}><div style={{fontFamily:'Outfit',fontWeight:700,fontSize:13,marginBottom:10}}>🔴 Co wymaga poprawy</div><div style={{fontSize:12,color:C.text2,lineHeight:1.7}}>{meetingsZoom.length===0&&phoneCalls.length>0&&'Zero spotkań online z rozmów — krytyczna luka. '}{lprConv<20&&phoneCalls.length>0&&`Niska konwersja ŁPR (${lprConv}%). `}{bots.length>0&&phoneCalls.length>0&&`${Math.round(bots.length/phoneCalls.length*100)}% rozmów to boty/automaty. `}{calls.length===0&&'Brak danych za wybrany okres.'}</div></div>
                </div>
              </>
            )}

            {view==='calls'&&(
              <>
                <Sec icon="📞" title="Wszystkie kontakty" badge={filtered.length}/>
                <div style={{marginBottom:14}}><input type="text" placeholder="🔍 Szukaj po kliencie, wyniku, menedżerze..." value={search} onChange={e=>setSearch(e.target.value)} style={{width:'100%',padding:'10px 16px',borderRadius:10,border:`1px solid ${C.border}`,background:C.surface,fontSize:13,fontFamily:'DM Sans',outline:'none',boxSizing:'border-box'}}/></div>
                <div style={{display:'flex',flexDirection:'column',gap:8}}>
                  {filtered.map(call=>(call.sip==='meeting'?<MeetingCard key={call.id} meeting={call} isOpen={activeCall===call.id} onToggle={()=>setActiveCall(activeCall===call.id?null:call.id)}/>:<CallDetail key={call.id} call={call} isOpen={activeCall===call.id} onToggle={()=>setActiveCall(activeCall===call.id?null:call.id)}/>))}
                  {filtered.length===0&&<div style={{textAlign:'center',padding:40,color:C.text3,fontFamily:'DM Mono'}}>Brak kontaktów spełniających kryteria</div>}
                </div>
              </>
            )}

            {view==='trends'&&(
              <>
                <Sec icon="📈" title="Trendy i analiza"/>
                {trendData.length>1?(
                  <>
                    <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:'18px 20px',marginBottom:14}}>
                      <div style={{fontSize:10,fontFamily:'DM Mono',textTransform:'uppercase',color:C.text3,marginBottom:14}}>Liczba rozmów według dni</div>
                      <ResponsiveContainer width="100%" height={220}><AreaChart data={trendData}><XAxis dataKey="day" tick={{fontSize:10,fontFamily:'DM Mono',fill:C.text3}}/><YAxis tick={{fontSize:10,fontFamily:'DM Mono',fill:C.text3}}/><Tooltip contentStyle={{fontFamily:'DM Mono',fontSize:11}}/><Area type="monotone" dataKey="total" stroke={C.nowima} fill={C.nowima} fillOpacity={0.1} name="Rozmowy"/><Area type="monotone" dataKey="lpr" stroke={C.green} fill={C.green} fillOpacity={0.1} name="ŁPR"/><Area type="monotone" dataKey="hot" stroke={C.red} fill={C.red} fillOpacity={0.1} name="Hot leady"/><Area type="monotone" dataKey="bots" stroke={C.amber} fill={C.amber} fillOpacity={0.1} name="Boty"/></AreaChart></ResponsiveContainer>
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
                      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:'18px 20px'}}><div style={{fontSize:10,fontFamily:'DM Mono',textTransform:'uppercase',color:C.text3,marginBottom:14}}>Boty według dni</div><ResponsiveContainer width="100%" height={180}><BarChart data={trendData}><XAxis dataKey="day" tick={{fontSize:10,fontFamily:'DM Mono',fill:C.text3}}/><YAxis tick={{fontSize:10,fontFamily:'DM Mono',fill:C.text3}}/><Tooltip contentStyle={{fontFamily:'DM Mono',fontSize:11}}/><Bar dataKey="bots" fill={C.amber} radius={[4,4,0,0]} name="Boty"/></BarChart></ResponsiveContainer></div>
                      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:'18px 20px'}}><div style={{fontSize:10,fontFamily:'DM Mono',textTransform:'uppercase',color:C.text3,marginBottom:14}}>Porównanie z poprzednim okresem</div><div style={{display:'flex',flexDirection:'column',gap:10,marginTop:8}}>{[{label:'Rozmowy telefoniczne',curr:phoneCalls.length,prev:prevData.filter(c=>c.sip!=='meeting').length},{label:'Kontakty ŁPR',curr:lpr.length,prev:prevLpr},{label:'Gorące leady',curr:hot.length,prev:prevHot},{label:'Boty/automaty',curr:bots.length,prev:prevData.filter(c=>c.wynik==='bot/automat'||c.wynik==='bot').length},{label:'Spotkania wideo',curr:videoMeetings.length,prev:prevData.filter(c=>c.sip==='meeting').length}].map(row=>{const d=row.curr-row.prev;const pct=row.prev>0?Math.round(Math.abs(d)/row.prev*100):null;const isNegativeGood=row.label==='Boty/automaty';const isGood=isNegativeGood?d<=0:d>=0;return(<div key={row.label} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0',borderBottom:`1px solid ${C.border}`}}><span style={{fontSize:12,color:C.text2}}>{row.label}</span><div style={{display:'flex',gap:8,alignItems:'center'}}><span style={{fontFamily:'DM Mono',fontSize:13,fontWeight:500}}>{row.curr}</span>{pct!==null&&<span style={{fontSize:11,fontFamily:'DM Mono',color:isGood?C.green:C.red,background:isGood?C.greenLight:C.redLight,padding:'2px 6px',borderRadius:4}}>{d>=0?'↑':'↓'}{pct}%</span>}</div></div>);})}</div></div>
                    </div>
                  </>
                ):(
                  <div style={{textAlign:'center',padding:60,color:C.text3,fontFamily:'DM Mono',background:C.surface,borderRadius:12,border:`1px solid ${C.border}`}}>📊 Trendy pojawią się gdy zbiorą się dane z kilku dni.</div>
                )}
              </>
            )}
          </>
        )}
      </div>
      <footer style={{textAlign:'center',fontSize:11,color:C.text3,fontFamily:'DM Mono',padding:'20px 0 40px',borderTop:`1px solid ${C.border}`}}>NOWIMA · Analytics Platform · dane na żywo z Supabase · auto-refresh co 5 min</footer>
    </div>
  );
}

function Alert({color,border,bg,children}){return(<div style={{background:bg,border:`1px solid ${border}`,borderRadius:10,padding:'12px 18px',fontSize:12,color,marginBottom:12,display:'flex',gap:10}}>{children}</div>);}
function Sec({icon,title,badge}){return(<div style={{display:'flex',alignItems:'center',gap:12,margin:'0 0 14px'}}><span style={{fontSize:15}}>{icon}</span><span style={{fontFamily:'Outfit',fontWeight:700,fontSize:11,textTransform:'uppercase',letterSpacing:'0.12em',color:'#5A171E'}}>{title}</span><div style={{flex:1,height:1,background:'#E8E4DC'}}/>{badge&&<span style={{fontSize:10,fontFamily:'DM Mono',padding:'2px 8px',borderRadius:20,background:'#F4ECED',color:'#5A171E',border:'1px solid rgba(90,23,30,0.15)'}}>{badge}</span>}</div>);}
function KpiCard({label,value,sub,accent,good,d}){return(<div style={{background:'#FFF',border:'1px solid #E8E4DC',borderTop:`3px solid ${accent}`,borderRadius:12,padding:'18px 20px',boxShadow:'0 2px 8px rgba(26,23,20,0.08)'}}><div style={{fontSize:10,fontFamily:'DM Mono',textTransform:'uppercase',letterSpacing:'0.08em',color:'#A09890',marginBottom:8}}>{label}</div><div style={{display:'flex',alignItems:'flex-end',gap:8}}><div style={{fontFamily:'Outfit',fontWeight:700,fontSize:38,lineHeight:1,color:good?'#1A7A4A':'#1A1714'}}>{value}</div>{d&&<span style={{fontSize:11,fontFamily:'DM Mono',color:d.up?'#1A7A4A':'#C0392B',marginBottom:6}}>{d.up?'↑':'↓'}{d.value}</span>}</div><div style={{fontSize:11,fontFamily:'DM Mono',color:'#6B6560',marginTop:8}}>{sub}</div></div>);}
function KpiSm({label,value,sub,good,danger}){return(<div style={{background:danger?'#FEF2F0':'#FFF',border:`1px solid ${danger?'#F5C0BB':'#E8E4DC'}`,borderTop:`3px solid ${danger?'#C0392B':good?'#1A7A4A':'#E8E4DC'}`,borderRadius:12,padding:'14px 16px'}}><div style={{fontSize:10,fontFamily:'DM Mono',textTransform:'uppercase',letterSpacing:'0.08em',color:'#A09890',marginBottom:6}}>{label}</div><div style={{fontFamily:'Outfit',fontWeight:700,fontSize:26,lineHeight:1,color:danger?'#C0392B':good?'#1A7A4A':'#1A1714'}}>{value}</div><div style={{fontSize:10,fontFamily:'DM Mono',color:'#6B6560',marginTop:5}}>{sub}</div></div>);}
function MgrCard({manager,sip,calls,color}){const lpr=calls.filter(c=>c.lpr).length;const hot=calls.filter(c=>c.wynik==='gorący lead').length;const zoom=calls.filter(c=>c.checklist_zoom).length;const over60=calls.filter(c=>c.duration>60).length;const avg=calls.length>0?(calls.reduce((s,c)=>s+(c.ocena||0),0)/calls.length).toFixed(1):'—';return(<div style={{background:'#FFF',border:'1px solid #E8E4DC',borderTop:`3px solid ${color}`,borderRadius:12,overflow:'hidden'}}><div style={{padding:'14px 20px',borderBottom:'1px solid #E8E4DC',display:'flex',justifyContent:'space-between',alignItems:'center'}}><div><div style={{fontFamily:'Outfit',fontWeight:700,fontSize:15,color}}>{manager}</div><div style={{fontSize:11,color:'#A09890',fontFamily:'DM Mono',marginTop:2}}>SIP {sip}</div></div><div style={{textAlign:'right'}}><div style={{fontFamily:'Outfit',fontWeight:700,fontSize:22,color}}>{avg}<span style={{fontSize:13,color:'#A09890'}}>/5</span></div><div style={{fontSize:10,color:'#A09890'}}>śr. ocena</div></div></div><div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)'}}>{[{l:'Rozmów',v:calls.length},{l:'Z ŁPR',v:lpr},{l:'Hot leady',v:hot},{l:'Zoom%',v:`${over60>0?Math.round(zoom/over60*100):0}%`}].map((s,i)=>(<div key={i} style={{padding:'12px 16px',borderRight:i<3?'1px solid #E8E4DC':'none'}}><div style={{fontFamily:'Outfit',fontWeight:700,fontSize:20,color}}>{s.v}</div><div style={{fontSize:10,color:'#A09890',marginTop:2,fontFamily:'DM Mono'}}>{s.l}</div></div>))}</div></div>);}
function LeadCard({call,onOpen}){const isHot=call.wynik==='gorący lead';const isMeeting=call.sip==='meeting';return(<div style={{background:'#FFF',border:'1px solid #E8E4DC',borderRadius:12,overflow:'hidden',display:'grid',gridTemplateColumns:'4px 1fr',cursor:'pointer'}} onClick={onOpen}><div style={{background:isHot?'#C0392B':'#C07A1A'}}/><div style={{padding:'14px 18px'}}><div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8,flexWrap:'wrap'}}><span style={{fontFamily:'Outfit',fontWeight:700,fontSize:14}}>{isHot?'🔥':'⚠️'} {call.klient||call.manager}</span><span style={{fontSize:10,padding:'2px 8px',borderRadius:20,fontFamily:'DM Mono',background:isMeeting?'#F0F4FF':call.sip==='123'?'#F4ECED':'#F7FAE6',color:isMeeting?'#3B5BDB':call.sip==='123'?'#5A171E':'#8A9C00',border:'1px solid rgba(0,0,0,0.08)'}}>{isMeeting?'🎥 Spotkanie':call.sip==='123'?'Beata':'Kamil'}</span><span style={{fontSize:10,color:'#A09890',fontFamily:'DM Mono'}}>{call.call_time?format(parseISO(call.call_time),'dd.MM HH:mm'):''}</span><span style={{fontSize:10,color:isHot?'#C0392B':'#C07A1A',marginLeft:'auto',fontFamily:'DM Mono'}}>→ Otwórz</span></div>{call.co_powiedzial&&<div style={{fontSize:12,color:'#6B6560',marginBottom:4}}><strong>Klient:</strong> {call.co_powiedzial}</div>}{call.akcja&&<div style={{marginTop:6,padding:'7px 12px',borderRadius:8,background:isHot?'#FEF2F0':'#FEF8EC',color:isHot?'#C0392B':'#C07A1A',fontSize:12,fontWeight:500,display:'inline-flex',border:`1px solid ${isHot?'#F5C0BB':'#F5D89A'}`}}>→ {call.akcja}</div>}</div></div>);}
function MeetingCard({meeting,isOpen,onToggle}){const stars='★'.repeat(meeting.ocena||0)+'☆'.repeat(5-(meeting.ocena||0));const wc=meeting.wynik==='sukces'?'#1A7A4A':meeting.wynik==='częściowy sukces'?'#C07A1A':'#A09890';const wb=meeting.wynik==='sukces'?'#EDF7F2':meeting.wynik==='częściowy sukces'?'#FEF8EC':'#F9F8F5';const mgr=meeting.manager==='Beata Janoszka'?'Beata':'Kamil';const mgrColor=meeting.manager==='Beata Janoszka'?'#5A171E':'#8A9C00';return(<div style={{background:'#FFF',border:'1px solid #E8E4DC',borderRadius:12,overflow:'hidden',borderLeft:'3px solid #3B5BDB'}}><div onClick={onToggle} style={{display:'grid',gridTemplateColumns:'28px 80px 1fr auto auto auto 28px',alignItems:'center',gap:10,padding:'12px 16px',cursor:'pointer',background:isOpen?'#F9F8F5':'#FFF'}}><div style={{fontSize:14}}>🎥</div><div style={{fontSize:11,fontWeight:500,color:mgrColor}}>{mgr}</div><div style={{fontSize:13,fontWeight:500}}>{meeting.klient||'—'}</div><div style={{fontFamily:'DM Mono',fontSize:11,color:'#A09890'}}>{meeting.call_time?format(parseISO(meeting.call_time),'dd.MM HH:mm'):''}</div><div style={{color:'#C07A1A',fontSize:12}}>{stars}</div><div><span style={{fontSize:10,padding:'2px 8px',borderRadius:20,fontFamily:'DM Mono',background:wb,color:wc,border:`1px solid ${wc}30`}}>{meeting.wynik||'—'}</span></div><div style={{color:'#A09890',fontSize:12,textAlign:'center',transition:'transform 0.2s',transform:isOpen?'rotate(180deg)':'none'}}>▼</div></div>{isOpen&&(<div style={{borderTop:'1px solid #E8E4DC',padding:'16px 20px',background:'#F9F8F5'}}><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:14}}><div>{meeting.co_powiedzial&&<div style={{fontSize:12,color:'#6B6560',lineHeight:1.6,marginBottom:8}}><strong>Temat:</strong> {meeting.co_powiedzial}</div>}{meeting.obiekcja&&<div style={{fontSize:12,color:'#6B6560',lineHeight:1.6,marginBottom:8}}><strong>Obiekcje:</strong> {meeting.obiekcja}</div>}{meeting.co_przeoczono&&<div style={{fontSize:12,color:'#6B6560',lineHeight:1.6}}><strong>Do poprawy:</strong> {meeting.co_przeoczono}</div>}</div><div>{meeting.akcja&&(<div style={{marginBottom:12}}><div style={{fontSize:10,fontFamily:'DM Mono',textTransform:'uppercase',color:'#A09890',marginBottom:8}}>Następny krok</div><div style={{fontSize:12,color:'#1A7A4A',lineHeight:1.6,paddingLeft:10,borderLeft:'2px solid #1A7A4A'}}>{meeting.akcja}</div></div>)}</div></div>{meeting.transcript&&(<div><div style={{fontSize:10,fontFamily:'DM Mono',textTransform:'uppercase',color:'#A09890',marginBottom:8}}>Fragment transkryptu</div><div style={{fontSize:12,color:'#6B6560',lineHeight:1.7,background:'#FFF',border:'1px solid #E8E4DC',borderRadius:8,padding:'12px 16px',maxHeight:200,overflowY:'auto',fontFamily:'DM Mono',whiteSpace:'pre-wrap'}}>{meeting.transcript}</div></div>)}</div>)}</div>);}
function CallDetail({call,isOpen,onToggle}){const checks=[{key:'checklist_przedstawil',l:'Przedstawił'},{key:'checklist_szukal_lpr',l:'ŁPR'},{key:'checklist_spin',l:'SPIN'},{key:'checklist_parametry',l:'Parametry'},{key:'checklist_zoom',l:'Zoom'},{key:'checklist_nastepny_krok',l:'Następny krok'}];const stars='★'.repeat(call.ocena||0)+'☆'.repeat(5-(call.ocena||0));const wc=call.wynik==='gorący lead'?'#C0392B':call.wynik==='zainteresowany'?'#1A7A4A':'#A09890';const wb=call.wynik==='gorący lead'?'#FEF2F0':call.wynik==='zainteresowany'?'#EDF7F2':'#F9F8F5';return(<div style={{background:'#FFF',border:'1px solid #E8E4DC',borderRadius:12,overflow:'hidden',boxShadow:'0 1px 3px rgba(26,23,20,0.06)'}}><div onClick={onToggle} style={{display:'grid',gridTemplateColumns:'80px 80px 1fr auto auto auto 28px',alignItems:'center',gap:10,padding:'12px 16px',cursor:'pointer',background:isOpen?'#F9F8F5':'#FFF'}}><div style={{fontFamily:'DM Mono',fontSize:11,color:'#6B6560'}}>{call.call_time?format(parseISO(call.call_time),'dd.MM HH:mm'):''}</div><div style={{fontSize:11,fontWeight:500,color:call.sip==='123'?'#5A171E':'#8A9C00'}}>{call.sip==='123'?'Beata':'Kamil'}</div><div style={{fontSize:13,fontWeight:500}}>{call.klient||'—'}</div><div style={{fontFamily:'DM Mono',fontSize:11,color:'#A09890'}}>{call.duration}s</div><div style={{color:'#C07A1A',fontSize:12}}>{stars}</div><div><span style={{fontSize:10,padding:'2px 8px',borderRadius:20,fontFamily:'DM Mono',background:wb,color:wc,border:`1px solid ${wc}30`}}>{call.wynik||'—'}</span></div><div style={{color:'#A09890',fontSize:12,textAlign:'center',transition:'transform 0.2s',transform:isOpen?'rotate(180deg)':'none'}}>▼</div></div>{isOpen&&(<div style={{borderTop:'1px solid #E8E4DC',padding:'16px 20px',background:'#F9F8F5'}}><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:14}}><div><div style={{fontSize:10,fontFamily:'DM Mono',textTransform:'uppercase',color:'#A09890',marginBottom:8}}>Checklist skryptu</div><div style={{display:'flex',flexWrap:'wrap',gap:5,marginBottom:10}}>{checks.map(c=>(<span key={c.key} style={{fontSize:10,padding:'3px 8px',borderRadius:4,fontFamily:'DM Mono',background:call[c.key]?'#EDF7F2':'#FEF2F0',color:call[c.key]?'#1A7A4A':'#C0392B',border:`1px solid ${call[c.key]?'#9AD5BC':'#F5C0BB'}`}}>{call[c.key]?'✓':'✗'} {c.l}</span>))}</div>{call.co_powiedzial&&<div style={{fontSize:12,color:'#6B6560',lineHeight:1.6,marginBottom:6}}><strong>Klient:</strong> {call.co_powiedzial}</div>}{call.co_przeoczono&&<div style={{fontSize:12,color:'#6B6560',lineHeight:1.6}}><strong>Przeoczono:</strong> {call.co_przeoczono}</div>}</div><div>{call.akcja&&(<div style={{marginBottom:12}}><div style={{fontSize:10,fontFamily:'DM Mono',textTransform:'uppercase',color:'#A09890',marginBottom:8}}>Rekomendacja</div><div style={{fontSize:12,color:'#1A7A4A',lineHeight:1.6,paddingLeft:10,borderLeft:'2px solid #1A7A4A'}}>{call.akcja}</div></div>)}<div style={{display:'flex',gap:16}}><div style={{textAlign:'center'}}><div style={{fontSize:18,color:call.lpr?'#1A7A4A':'#C0392B'}}>{call.lpr?'✓':'✗'}</div><div style={{fontSize:10,color:'#A09890',fontFamily:'DM Mono'}}>ŁPR</div></div><div style={{textAlign:'center'}}><div style={{fontSize:14,color:'#C07A1A'}}>{stars}</div><div style={{fontSize:10,color:'#A09890',fontFamily:'DM Mono'}}>Ocena</div></div></div></div></div>{call.transcript&&(<div><div style={{fontSize:10,fontFamily:'DM Mono',textTransform:'uppercase',color:'#A09890',marginBottom:8}}>Pełny transkrypt</div><div style={{fontSize:12,color:'#6B6560',lineHeight:1.7,background:'#FFF',border:'1px solid #E8E4DC',borderRadius:8,padding:'12px 16px',maxHeight:200,overflowY:'auto',fontFamily:'DM Mono',whiteSpace:'pre-wrap'}}>{call.transcript}</div></div>)}</div>)}</div>);}
