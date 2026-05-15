import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
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

export default function App() {
  const [calls,setCalls]=useState([]);
  const [prevCalls,setPrevCalls]=useState([]);
  const [loading,setLoading]=useState(true);
  const [period,setPeriod]=useState('day');
  const [customStart,setCustomStart]=useState('');
  const [customEnd,setCustomEnd]=useState('');
  const [mgr,setMgr]=useState('all');
  const [lastUpdate,setLastUpdate]=useState(new Date());
  const [activeCall,setActiveCall]=useState(null);
  const [view,setView]=useState('dashboard');
  const [search,setSearch]=useState('');
  const [notif,setNotif]=useState(null);

  const getRange=useCallback((offset=0)=>{
    const now=new Date();
    if(period==='custom'&&customStart&&customEnd){
      return{start:new Date(customStart),end:new Date(customEnd+'T23:59:59')};
    }
    switch(period){
      case 'day':{
        const d=subDays(now,offset);
        const s=new Date(d);s.setHours(0,0,0,0);
        const e=new Date(d);e.setHours(23,59,59,999);
        return{start:s,end:e};
      }
      case 'week':return{
        start:startOfWeek(offset===0?now:subWeeks(now,1),{weekStartsOn:1}),
        end:endOfWeek(offset===0?now:subWeeks(now,1),{weekStartsOn:1})
      };
      case 'month':return{
        start:startOfMonth(offset===0?now:subMonths(now,1)),
        end:endOfMonth(offset===0?now:subMonths(now,1))
      };
      default:return{start:new Date('2025-01-01'),end:now};
    }
  },[period,customStart,customEnd]);

  const fetchData=useCallback(async()=>{
    const{start,end}=getRange(0);
    const{start:ps,end:pe}=getRange(1);
    let q=supabase.from('calls').select('*')
      .gte('call_time',start.toISOString())
      .lte('call_time',end.toISOString())
      .order('call_time',{ascending:false});
    if(mgr==='beata')q=q.eq('sip','123');
    if(mgr==='kamil')q=q.eq('sip','119');
    let pq=supabase.from('calls').select('*')
      .gte('call_time',ps.toISOString())
      .lte('call_time',pe.toISOString());
    const[{data},{data:pd}]=await Promise.all([q,pq]);
    if(data){setCalls(data);setLastUpdate(new Date());}
    if(pd)setPrevCalls(pd);
    setLoading(false);
  },[getRange,mgr]);

  useEffect(()=>{fetchData();const i=setInterval(fetchData,5*60*1000);return()=>clearInterval(i);},[fetchData]);

  useEffect(()=>{
    const sub=supabase.channel('calls')
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'calls'},(p)=>{
        setCalls(prev=>[p.new,...prev]);
        setLastUpdate(new Date());
        const m=p.new.sip==='123'?'Beata':'Kamil';
        setNotif(`Nowa rozmowa: ${m} · ${p.new.duration}s · ${p.new.wynik||'—'}`);
        setTimeout(()=>setNotif(null),8000);
      }).subscribe();
    return()=>sub.unsubscribe();
  },[]);

  const filtered=useMemo(()=>{
    if(!search)return calls;
    const s=search.toLowerCase();
    return calls.filter(c=>
      (c.klient||'').toLowerCase().includes(s)||
      (c.manager||'').toLowerCase().includes(s)||
      (c.co_powiedzial||'').toLowerCase().includes(s)||
      (c.wynik||'').toLowerCase().includes(s)
    );
  },[calls,search]);

  const beata=calls.filter(c=>c.sip==='123');
  const kamil=calls.filter(c=>c.sip==='119');
  const over60=calls.filter(c=>c.duration>60);
  const over180=calls.filter(c=>c.duration>180);
  const lpr=calls.filter(c=>c.lpr);
  const hot=calls.filter(c=>c.wynik==='gorący lead');
  const pilne=calls.filter(c=>c.pilne);
  const meetings=calls.filter(c=>c.checklist_zoom);
  const bots=calls.filter(c=>c.wynik==='bot/automat');
  const secs=calls.filter(c=>c.wynik==='sekretariat');
  const followup=calls.filter(c=>c.checklist_nastepny_krok);
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
    calls.forEach(c=>{
      if(!c.call_time)return;
      const day=format(parseISO(c.call_time),'dd.MM');
      if(!days[day])days[day]={day,total:0,lpr:0,hot:0,meetings:0};
      days[day].total++;
      if(c.lpr)days[day].lpr++;
      if(c.wynik==='gorący lead')days[day].hot++;
      if(c.checklist_zoom)days[day].meetings++;
    });
    return Object.values(days).sort((a,b)=>a.day.localeCompare(b.day));
  },[calls]);

  const scriptItems=[
    {key:'checklist_przedstawil',label:'Przedstawił się'},
    {key:'checklist_szukal_lpr',label:'Szukał ŁPR'},
    {key:'checklist_spin',label:'Pytania SPIN'},
    {key:'checklist_parametry',label:'Parametry projektu'},
    {key:'checklist_zoom',label:'Zaproponował Zoom'},
    {key:'checklist_nastepny_krok',label:'Następny krok'},
  ];

  const productKnowledge=[
    {category:'Elektrycy i elektromonterzy',items:[
      {label:'Typy specjalistów (miesz./przem.)',beata:7,kamil:5},
      {label:'Certyfikaty VCA/SEP',beata:6,kamil:4},
      {label:'Elektryk vs elektromonter',beata:5,kamil:3},
    ]},
    {category:'Spawacze i monterzy',items:[
      {label:'Metody MIG/MAG/TIG/MMA',beata:6,kamil:5},
      {label:'Certyfikaty ISO 9606-1, VCA',beata:7,kamil:6},
      {label:'Monterzy: rysunki techniczne',beata:5,kamil:4},
    ]},
  ];

  const exportCSV=()=>{
    const h=['Data','Menedżer','Klient','Czas','LPR','Wynik','Ocena','Akcja'];
    const rows=calls.map(c=>[
      c.call_time?format(parseISO(c.call_time),'dd.MM.yyyy HH:mm'):'',
      c.manager,c.klient||'',c.duration,c.lpr?'TAK':'NIE',c.wynik||'',c.ocena||'',c.akcja||''
    ]);
    const csv=[h,...rows].map(r=>r.join(';')).join('\n');
    const blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8;'});
    const a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    a.download=`nowima_${format(new Date(),'yyyy-MM-dd')}.csv`;
    a.click();
  };

  const delta=(curr,prev)=>{
    if(prev===0)return null;
    const d=curr-prev;
    return{value:Math.abs(d),up:d>=0};
  };

  const btnStyle=(active)=>({
    padding:'4px 10px',borderRadius:20,border:'1px solid',cursor:'pointer',fontSize:11,fontFamily:'DM Mono',
    borderColor:active?C.lime:'rgba(255,255,255,0.2)',
    background:active?'rgba(209,233,37,0.15)':'transparent',
    color:active?C.lime:'rgba(255,255,255,0.65)',
  });

  return(
    <div style={{fontFamily:"'DM Sans',sans-serif",background:C.bg,minHeight:'100vh',color:C.text}}>
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=DM+Sans:wght@300;400;500&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet"/>

      {notif&&(
        <div style={{position:'fixed',top:70,right:20,zIndex:1000,background:C.nowima,color:'white',padding:'12px 20px',borderRadius:10,boxShadow:'0 4px 20px rgba(90,23,30,0.4)',fontSize:13,fontFamily:'DM Mono',maxWidth:360,borderLeft:`4px solid ${C.lime}`}}>
          📞 {notif}
        </div>
      )}

      <header style={{background:C.nowima,position:'sticky',top:0,zIndex:100,boxShadow:'0 2px 12px rgba(90,23,30,0.3)',borderBottom:'2px solid rgba(209,233,37,0.3)'}}>
        <div style={{maxWidth:1440,margin:'0 auto',padding:'0 20px',height:56,display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
          <div style={{display:'flex',alignItems:'center',gap:10,marginRight:4}}>
            <div style={{background:'rgba(209,233,37,0.15)',border:'1px solid rgba(209,233,37,0.3)',borderRadius:6,padding:'4px 10px',fontFamily:'Outfit',fontWeight:700,fontSize:15,color:C.lime,letterSpacing:1}}>NOWIMA</div>
            <span style={{fontSize:11,color:'rgba(255,255,255,0.5)',fontFamily:'DM Mono'}}>Analytics</span>
          </div>
          <div style={{display:'flex',gap:4}}>
            {[['dashboard','📊 Dashboard'],['calls','📞 Rozmowy'],['trends','📈 Trendy']].map(([v,l])=>(
              <button key={v} onClick={()=>setView(v)} style={btnStyle(view===v)}>{l}</button>
            ))}
          </div>
          <div style={{display:'flex',gap:4}}>
            {[['day','Dziś'],['week','Tydzień'],['month','Miesiąc'],['all','Wszystko'],['custom','📅']].map(([p,l])=>(
              <button key={p} onClick={()=>setPeriod(p)} style={btnStyle(period===p)}>{l}</button>
            ))}
            {period==='custom'&&(
              <>
                <input type="date" value={customStart} onChange={e=>setCustomStart(e.target.value)} style={{padding:'3px 8px',borderRadius:6,border:'1px solid rgba(255,255,255,0.3)',background:'rgba(255,255,255,0.1)',color:'white',fontSize:11,fontFamily:'DM Mono'}}/>
                <span style={{color:'rgba(255,255,255,0.4)',alignSelf:'center'}}>—</span>
                <input type="date" value={customEnd} onChange={e=>setCustomEnd(e.target.value)} style={{padding:'3px 8px',borderRadius:6,border:'1px solid rgba(255,255,255,0.3)',background:'rgba(255,255,255,0.1)',color:'white',fontSize:11,fontFamily:'DM Mono'}}/>
              </>
            )}
          </div>
          <div style={{display:'flex',gap:4}}>
            {[['all','Wszyscy'],['beata','Beata'],['kamil','Kamil']].map(([m,l])=>(
              <button key={m} onClick={()=>setMgr(m)} style={btnStyle(mgr===m)}>{l}</button>
            ))}
          </div>
          <div style={{marginLeft:'auto',display:'flex',gap:8,alignItems:'center'}}>
            {hot.length>0&&<span style={{fontSize:11,padding:'3px 10px',borderRadius:20,border:`1px solid ${C.lime}`,color:C.lime,background:'rgba(209,233,37,0.1)',fontFamily:'DM Mono'}}>🔥 {hot.length} gorących</span>}
            {meetings.length===0&&calls.length>0&&<span style={{fontSize:11,padding:'3px 10px',borderRadius:20,border:'1px solid #F5C0BB',color:'#F5C0BB',background:'rgba(192,57,43,0.15)',fontFamily:'DM Mono'}}>⚠️ 0 spotkań</span>}
            <button onClick={exportCSV} style={{padding:'4px 10px',borderRadius:20,border:'1px solid rgba(255,255,255,0.2)',background:'transparent',color:'rgba(255,255,255,0.6)',fontSize:11,fontFamily:'DM Mono',cursor:'pointer'}}>⬇ CSV</button>
            <span style={{fontSize:10,color:'rgba(255,255,255,0.3)',fontFamily:'DM Mono'}}>↻ {format(lastUpdate,'HH:mm')}</span>
          </div>
        </div>
      </header>

      <div style={{maxWidth:1440,margin:'0 auto',padding:'24px 20px 80px'}}>
        {loading?(
          <div style={{textAlign:'center',padding:80,color:C.text3,fontFamily:'DM Mono'}}>⏳ Ładowanie danych...</div>
        ):(
          <>
            {view==='dashboard'&&(
              <>
                {meetings.length===0&&calls.length>0&&(
                  <Alert color={C.red} border={C.redBorder} bg={C.redLight}>
                    🚨 <strong>Krytyczna luka:</strong> Brak umówionych spotkań online. Bez spotkania nie ma oferty.
                  </Alert>
                )}
                {bots.length/Math.max(calls.length,1)>0.25&&(
                  <Alert color={C.amber} border={C.amberBorder} bg={C.amberLight}>
                    ⚠️ <strong>Wysoki % botów:</strong> {Math.round(bots.length/calls.length*100)}% rozmów to automaty.
                  </Alert>
                )}

                <Sec icon="📊" title="Kluczowe wskaźniki"/>
                <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:12}}>
                  <KpiCard label="Wszystkie rozmowy" value={calls.length} sub={`B: ${beata.length} · K: ${kamil.length}`} accent={C.nowima} d={delta(calls.length,prevCalls.length)}/>
                  <KpiCard label="Rozmowy powyżej 60s" value={over60.length} sub={`B: ${beata.filter(c=>c.duration>60).length} · K: ${kamil.filter(c=>c.duration>60).length}`} accent={C.nowima} d={delta(over60.length,prevCalls.filter(c=>c.duration>60).length)}/>
                  <KpiCard label="Kontakty z ŁPR" value={lpr.length} sub={`B: ${beata.filter(c=>c.lpr).length} · K: ${kamil.filter(c=>c.lpr).length}`} accent={C.green} good d={delta(lpr.length,prevLpr)}/>
                  <KpiCard label="Konwersja ŁPR z >60s" value={`${lprConv}%`} sub={`${lpr.length} z ${over60.length} rozmów`} accent={C.green} good/>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(6,1fr)',gap:10,marginBottom:24}}>
                  <KpiSm label="Powyżej 180s" value={over180.length} sub={`B:${beata.filter(c=>c.duration>180).length} K:${kamil.filter(c=>c.duration>180).length}`}/>
                  <KpiSm label="Follow-up" value={followup.length} sub={`B:${beata.filter(c=>c.checklist_nastepny_krok).length} K:${kamil.filter(c=>c.checklist_nastepny_krok).length}`}/>
                  <KpiSm label="Konw. follow-up" value={over60.length>0?`${Math.round(followup.length/over60.length*100)}%`:'—'} sub={`${followup.length} z ${over60.length}`} good/>
                  <KpiSm label="Sekretariat" value={secs.length} sub={`B:${beata.filter(c=>c.wynik==='sekretariat').length} K:${kamil.filter(c=>c.wynik==='sekretariat').length}`}/>
                  <KpiSm label="Konw. od sekr." value={`${secConv}%`} sub={`${lpr.length} przełączeń`} good/>
                  <KpiSm label="Bot/automat" value={bots.length} sub={`${calls.length>0?Math.round(bots.length/calls.length*100):0}% wszystkich`} danger={bots.length/Math.max(calls.length,1)>0.15}/>
                </div>

                <Sec icon="🔽" title="Lejek sprzedażowy"/>
                <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,overflow:'hidden',marginBottom:16}}>
                  <div style={{display:'flex'}}>
                    {[
                      {l:'Rozmowy',v:calls.length,p:'100%',col:C.nowima},
                      {l:'Z ŁPR',v:lpr.length,p:calls.length>0?`${Math.round(lpr.length/calls.length*100)}%`:'—',col:C.text},
                      {l:'Zainteresowani',v:calls.filter(c=>c.wynik==='zainteresowany').length,p:'—',col:C.nowima,bg:'#F4ECED'},
                      {l:'Gorące leady',v:hot.length,p:'—',col:C.red,bg:C.redLight},
                      {l:'Spotkanie',v:meetings.length,p:'—',col:C.text3,dim:meetings.length===0},
                      {l:'Oferta',v:0,p:'—',col:C.text3,dim:true},
                    ].map((s,i)=>(
                      <div key={i} style={{flex:1,padding:'14px 10px',textAlign:'center',borderRight:i<5?`1px solid ${C.border}`:'none',background:s.bg||C.surface,opacity:s.dim?0.4:1}}>
                        <div style={{fontFamily:'Outfit',fontWeight:700,fontSize:26,color:s.col}}>{s.v}</div>
                        <div style={{fontSize:9,textTransform:'uppercase',letterSpacing:'0.08em',color:C.text3,margin:'4px 0',fontFamily:'DM Mono'}}>{s.l}</div>
                        <div style={{fontSize:10,color:C.text2}}>{s.p}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {hot.length>0&&(
                  <>
                    <Sec icon="🔥" title="Gorące leady i pilne działania" badge={hot.length}/>
                    <div style={{display:'flex',flexDirection:'column',gap:10,marginBottom:24}}>
                      {[...hot,...pilne.filter(c=>c.wynik!=='gorący lead')].map(c=>(
                        <LeadCard key={c.id} call={c} onOpen={()=>{setActiveCall(c.id);setView('calls');}}/>
                      ))}
                    </div>
                  </>
                )}

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
                    return(
                      <div key={item.key} style={{display:'grid',gridTemplateColumns:'28px 1fr 100px 100px',borderBottom:`1px solid ${C.border}`,alignItems:'center'}}>
                        <div style={{textAlign:'center',padding:'12px 8px',fontSize:13}}>{bp>=70&&kp>=70?'✅':bp<40||kp<40?'🔴':'⚠️'}</div>
                        <div style={{padding:'12px 14px',fontSize:12,color:C.text2}}>{item.label}</div>
                        <div style={{padding:'10px 8px',textAlign:'center'}}>
                          <div style={{fontSize:13,color:bp>=70?C.green:C.red}}>{bp>=70?'✓':'✗'}</div>
                          <div style={{fontSize:10,fontFamily:'DM Mono',color:C.beata}}>{bp}%</div>
                        </div>
                        <div style={{padding:'10px 8px',textAlign:'center'}}>
                          <div style={{fontSize:13,color:kp>=70?C.green:C.red}}>{kp>=70?'✓':'✗'}</div>
                          <div style={{fontSize:10,fontFamily:'DM Mono',color:C.kamil}}>{kp}%</div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <Sec icon="🏗️" title="Znajomość produktu NOWIMA"/>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginBottom:24}}>
                  {productKnowledge.map(cat=>(
                    <div key={cat.category} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:'18px 20px'}}>
                      <div style={{fontFamily:'Outfit',fontWeight:700,fontSize:13,marginBottom:14}}>{cat.category}</div>
                      {cat.items.map(item=>(
                        <div key={item.label} style={{marginBottom:12}}>
                          <div style={{fontSize:12,color:C.text2,marginBottom:5}}>{item.label}</div>
                          {[{name:'Beata',val:item.beata,color:C.beata},{name:'Kamil',val:item.kamil,color:C.kamil}].map(m=>(
                            <div key={m.name} style={{display:'flex',alignItems:'center',gap:8,marginBottom:3}}>
                              <div style={{fontSize:10,fontFamily:'DM Mono',fontWeight:500,width:38,color:m.color}}>{m.name}</div>
                              <div style={{flex:1,background:C.bg,borderRadius:4,height:7,overflow:'hidden'}}>
                                <div style={{width:`${m.val*10}%`,height:'100%',background:m.color,borderRadius:4}}/>
                              </div>
                              <div style={{fontSize:11,fontFamily:'DM Mono',width:32,textAlign:'right',color:m.color}}>{m.val}/10</div>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>

                {clientCounts.length>0&&(
                  <>
                    <Sec icon="🏆" title="Top klienci" badge={clientCounts.length}/>
                    <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,overflow:'hidden',marginBottom:24}}>
                      <table style={{width:'100%',borderCollapse:'collapse'}}>
                        <thead>
                          <tr style={{background:C.surface2,borderBottom:`1px solid ${C.border}`}}>
                            {['#','Klient','Menedżer','Rozmów','Hot leady','Ostatni kontakt'].map(h=>(
                              <th key={h} style={{padding:'9px 14px',textAlign:'left',fontSize:10,fontFamily:'DM Mono',textTransform:'uppercase',letterSpacing:'0.07em',color:C.text3}}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {clientCounts.map(([name,data],i)=>(
                            <tr key={name} style={{borderBottom:`1px solid ${C.border}`}}>
                              <td style={{padding:'10px 14px',fontSize:12,color:C.text3,fontFamily:'DM Mono'}}>#{i+1}</td>
                              <td style={{padding:'10px 14px',fontSize:13,fontWeight:500}}>{name}</td>
                              <td style={{padding:'10px 14px',fontSize:11,color:data.manager==='Beata Janoszka'?C.beata:C.kamil}}>{data.manager==='Beata Janoszka'?'Beata':'Kamil'}</td>
                              <td style={{padding:'10px 14px',fontSize:13,fontFamily:'DM Mono'}}>{data.count}</td>
                              <td style={{padding:'10px 14px'}}>{data.hot>0&&<span style={{background:C.redLight,color:C.red,border:`1px solid ${C.redBorder}`,borderRadius:20,padding:'2px 8px',fontSize:10,fontFamily:'DM Mono'}}>🔥 {data.hot}</span>}</td>
                              <td style={{padding:'10px 14px',fontSize:11,color:C.text3,fontFamily:'DM Mono'}}>{data.lastTime?format(parseISO(data.lastTime),'dd.MM HH:mm'):'—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}

                <Sec icon="💡" title="Co działa / co wymaga poprawy"/>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginBottom:24}}>
                  <div style={{background:C.surface,border:`1px solid ${C.border}`,borderLeft:`4px solid ${C.green}`,borderRadius:12,padding:'18px 20px'}}>
                    <div style={{fontFamily:'Outfit',fontWeight:700,fontSize:13,marginBottom:10}}>✅ Co działa dobrze</div>
                    <div style={{fontSize:12,color:C.text2,lineHeight:1.7}}>
                      {beata.length>0&&`Beata: ${Math.round(beata.filter(c=>c.lpr).length/beata.length*100)}% konwersji do ŁPR. `}
                      {kamil.length>0&&`Kamil: ${Math.round(kamil.filter(c=>c.lpr).length/kamil.length*100)}% konwersji do ŁPR. `}
                      {lpr.length>0&&`Łącznie ${lpr.length} kontaktów z ŁPR.`}
                      {calls.length===0&&'Brak danych za wybrany okres.'}
                    </div>
                  </div>
                  <div style={{background:C.surface,border:`1px solid ${C.border}`,borderLeft:`4px solid ${C.red}`,borderRadius:12,padding:'18px 20px'}}>
                    <div style={{fontFamily:'Outfit',fontWeight:700,fontSize:13,marginBottom:10}}>🔴 Co wymaga poprawy</div>
                    <div style={{fontSize:12,color:C.text2,lineHeight:1.7}}>
                      {meetings.length===0&&calls.length>0&&'Zero spotkań online — krytyczna luka. '}
                      {lprConv<20&&calls.length>0&&`Niska konwersja ŁPR (${lprConv}%). `}
                      {calls.filter(c=>c.checklist_spin).length/Math.max(lpr.length,1)<0.5&&calls.length>0&&'Za mało pytań SPIN przy ŁPR.'}
                      {calls.length===0&&'Brak danych za wybrany okres.'}
                    </div>
                  </div>
                </div>
              </>
            )}

            {view==='calls'&&(
              <>
                <Sec icon="📞" title="Wszystkie rozmowy" badge={filtered.length}/>
                <div style={{marginBottom:14}}>
                  <input type="text" placeholder="🔍 Szukaj po kliencie, wyniku, menedżerze..." value={search} onChange={e=>setSearch(e.target.value)}
                    style={{width:'100%',padding:'10px 16px',borderRadius:10,border:`1px solid ${C.border}`,background:C.surface,fontSize:13,fontFamily:'DM Sans',outline:'none',boxSizing:'border-box'}}/>
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:8}}>
                  {filtered.map(call=>(
                    <CallDetail key={call.id} call={call} isOpen={activeCall===call.id} onToggle={()=>setActiveCall(activeCall===call.id?null:call.id)}/>
                  ))}
                  {filtered.length===0&&<div style={{textAlign:'center',padding:40,color:C.text3,fontFamily:'DM Mono'}}>Brak rozmów spełniających kryteria</div>}
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
                      <ResponsiveContainer width="100%" height={220}>
                        <AreaChart data={trendData}>
                          <XAxis dataKey="day" tick={{fontSize:10,fontFamily:'DM Mono',fill:C.text3}}/>
                          <YAxis tick={{fontSize:10,fontFamily:'DM Mono',fill:C.text3}}/>
                          <Tooltip contentStyle={{fontFamily:'DM Mono',fontSize:11}}/>
                          <Area type="monotone" dataKey="total" stroke={C.nowima} fill={C.nowima} fillOpacity={0.1} name="Rozmowy"/>
                          <Area type="monotone" dataKey="lpr" stroke={C.green} fill={C.green} fillOpacity={0.1} name="ŁPR"/>
                          <Area type="monotone" dataKey="hot" stroke={C.red} fill={C.red} fillOpacity={0.1} name="Hot leady"/>
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
                      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:'18px 20px'}}>
                        <div style={{fontSize:10,fontFamily:'DM Mono',textTransform:'uppercase',color:C.text3,marginBottom:14}}>Spotkania online według dni</div>
                        <ResponsiveContainer width="100%" height={180}>
                          <BarChart data={trendData}>
                            <XAxis dataKey="day" tick={{fontSize:10,fontFamily:'DM Mono',fill:C.text3}}/>
                            <YAxis tick={{fontSize:10,fontFamily:'DM Mono',fill:C.text3}}/>
                            <Tooltip contentStyle={{fontFamily:'DM Mono',fontSize:11}}/>
                            <Bar dataKey="meetings" fill={C.green} radius={[4,4,0,0]} name="Spotkania"/>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:'18px 20px'}}>
                        <div style={{fontSize:10,fontFamily:'DM Mono',textTransform:'uppercase',color:C.text3,marginBottom:14}}>Porównanie z poprzednim okresem</div>
                        <div style={{display:'flex',flexDirection:'column',gap:10,marginTop:8}}>
                          {[
                            {label:'Rozmowy',curr:calls.length,prev:prevCalls.length},
                            {label:'Kontakty ŁPR',curr:lpr.length,prev:prevLpr},
                            {label:'Gorące leady',curr:hot.length,prev:prevHot},
                            {label:'Spotkania online',curr:meetings.length,prev:prevCalls.filter(c=>c.checklist_zoom).length},
                          ].map(row=>{
                            const d=row.curr-row.prev;
                            const pct=row.prev>0?Math.round(Math.abs(d)/row.prev*100):null;
                            return(
                              <div key={row.label} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0',borderBottom:`1px solid ${C.border}`}}>
                                <span style={{fontSize:12,color:C.text2}}>{row.label}</span>
                                <div style={{display:'flex',gap:8,alignItems:'center'}}>
                                  <span style={{fontFamily:'DM Mono',fontSize:13,fontWeight:500}}>{row.curr}</span>
                                  {pct!==null&&<span style={{fontSize:11,fontFamily:'DM Mono',color:d>=0?C.green:C.red,background:d>=0?C.greenLight:C.redLight,padding:'2px 6px',borderRadius:4}}>{d>=0?'↑':'↓'}{pct}%</span>}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </>
                ):(
                  <div style={{textAlign:'center',padding:60,color:C.text3,fontFamily:'DM Mono',background:C.surface,borderRadius:12,border:`1px solid ${C.border}`}}>
                    📊 Trendy pojawią się gdy zbiorą się dane z kilku dni.<br/>
                    <span style={{fontSize:12,marginTop:8,display:'block'}}>Aktualnie: {trendData.length} {trendData.length===1?'dzień':'dni'} danych</span>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
      <footer style={{textAlign:'center',fontSize:11,color:C.text3,fontFamily:'DM Mono',padding:'20px 0 40px',borderTop:`1px solid ${C.border}`}}>
        NOWIMA · Analytics Platform · dane na żywo z Supabase · auto-refresh co 5 min
      </footer>
    </div>
  );
}

function Alert({color,border,bg,children}){
  return(
    <div style={{background:bg,border:`1px solid ${border}`,borderRadius:10,padding:'12px 18px',fontSize:12,color,marginBottom:12,display:'flex',gap:10}}>
      {children}
    </div>
  );
}

function Sec({icon,title,badge}){
  return(
    <div style={{display:'flex',alignItems:'center',gap:12,margin:'0 0 14px'}}>
      <span style={{fontSize:15}}>{icon}</span>
      <span style={{fontFamily:'Outfit',fontWeight:700,fontSize:11,textTransform:'uppercase',letterSpacing:'0.12em',color:'#5A171E'}}>{title}</span>
      <div style={{flex:1,height:1,background:'#E8E4DC'}}/>
      {badge&&<span style={{fontSize:10,fontFamily:'DM Mono',padding:'2px 8px',borderRadius:20,background:'#F4ECED',color:'#5A171E',border:'1px solid rgba(90,23,30,0.15)'}}>{badge}</span>}
    </div>
  );
}

function KpiCard({label,value,sub,accent,good,d}){
  return(
    <div style={{background:'#FFF',border:'1px solid #E8E4DC',borderTop:`3px solid ${accent}`,borderRadius:12,padding:'18px 20px',boxShadow:'0 2px 8px rgba(26,23,20,0.08)'}}>
      <div style={{fontSize:10,fontFamily:'DM Mono',textTransform:'uppercase',letterSpacing:'0.08em',color:'#A09890',marginBottom:8}}>{label}</div>
      <div style={{display:'flex',alignItems:'flex-end',gap:8}}>
        <div style={{fontFamily:'Outfit',fontWeight:700,fontSize:38,lineHeight:1,color:good?'#1A7A4A':'#1A1714'}}>{value}</div>
        {d&&<span style={{fontSize:11,fontFamily:'DM Mono',color:d.up?'#1A7A4A':'#C0392B',marginBottom:6}}>{d.up?'↑':'↓'}{d.value}</span>}
      </div>
      <div style={{fontSize:11,fontFamily:'DM Mono',color:'#6B6560',marginTop:8}}>{sub}</div>
    </div>
  );
}

function KpiSm({label,value,sub,good,danger}){
  return(
    <div style={{background:danger?'#FEF2F0':'#FFF',border:`1px solid ${danger?'#F5C0BB':'#E8E4DC'}`,borderTop:`3px solid ${danger?'#C0392B':good?'#1A7A4A':'#E8E4DC'}`,borderRadius:12,padding:'14px 16px'}}>
      <div style={{fontSize:10,fontFamily:'DM Mono',textTransform:'uppercase',letterSpacing:'0.08em',color:'#A09890',marginBottom:6}}>{label}</div>
      <div style={{fontFamily:'Outfit',fontWeight:700,fontSize:26,lineHeight:1,color:danger?'#C0392B':good?'#1A7A4A':'#1A1714'}}>{value}</div>
      <div style={{fontSize:10,fontFamily:'DM Mono',color:'#6B6560',marginTop:5}}>{sub}</div>
    </div>
  );
}

function MgrCard({manager,sip,calls,color}){
  const lpr=calls.filter(c=>c.lpr).length;
  const hot=calls.filter(c=>c.wynik==='gorący lead').length;
  const zoom=calls.filter(c=>c.checklist_zoom).length;
  const over60=calls.filter(c=>c.duration>60).length;
  const avg=calls.length>0?(calls.reduce((s,c)=>s+(c.ocena||0),0)/calls.length).toFixed(1):'—';
  return(
    <div style={{background:'#FFF',border:'1px solid #E8E4DC',borderTop:`3px solid ${color}`,borderRadius:12,overflow:'hidden'}}>
      <div style={{padding:'14px 20px',borderBottom:'1px solid #E8E4DC',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div>
          <div style={{fontFamily:'Outfit',fontWeight:700,fontSize:15,color}}>{manager}</div>
          <div style={{fontSize:11,color:'#A09890',fontFamily:'DM Mono',marginTop:2}}>SIP {sip}</div>
        </div>
        <div style={{textAlign:'right'}}>
          <div style={{fontFamily:'Outfit',fontWeight:700,fontSize:22,color}}>{avg}<span style={{fontSize:13,color:'#A09890'}}>/5</span></div>
          <div style={{fontSize:10,color:'#A09890'}}>śr. ocena</div>
        </div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)'}}>
        {[{l:'Rozmów',v:calls.length},{l:'Z ŁPR',v:lpr},{l:'Hot leady',v:hot},{l:'Zoom%',v:`${over60>0?Math.round(zoom/over60*100):0}%`}].map((s,i)=>(
          <div key={i} style={{padding:'12px 16px',borderRight:i<3?'1px solid #E8E4DC':'none'}}>
            <div style={{fontFamily:'Outfit',fontWeight:700,fontSize:20,color}}>{s.v}</div>
            <div style={{fontSize:10,color:'#A09890',marginTop:2,fontFamily:'DM Mono'}}>{s.l}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LeadCard({call,onOpen}){
  const isHot=call.wynik==='gorący lead';
  return(
    <div style={{background:'#FFF',border:'1px solid #E8E4DC',borderRadius:12,overflow:'hidden',display:'grid',gridTemplateColumns:'4px 1fr',cursor:'pointer'}} onClick={onOpen}>
      <div style={{background:isHot?'#C0392B':'#C07A1A'}}/>
      <div style={{padding:'14px 18px'}}>
        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8,flexWrap:'wrap'}}>
          <span style={{fontFamily:'Outfit',fontWeight:700,fontSize:14}}>{isHot?'🔥':'⚠️'} {call.klient||call.manager}</span>
          <span style={{fontSize:10,padding:'2px 8px',borderRadius:20,fontFamily:'DM Mono',background:call.sip==='123'?'#F4ECED':'#F7FAE6',color:call.sip==='123'?'#5A171E':'#8A9C00',border:`1px solid ${call.sip==='123'?'rgba(90,23,30,0.15)':'rgba(138,156,0,0.2)'}`}}>
            {call.sip==='123'?'Beata':'Kamil'}
          </span>
          <span style={{fontSize:10,color:'#A09890',fontFamily:'DM Mono'}}>{call.call_time?format(parseISO(call.call_time),'dd.MM HH:mm'):''} · {call.duration}s</span>
          <span style={{fontSize:10,color:isHot?'#C0392B':'#C07A1A',marginLeft:'auto',fontFamily:'DM Mono'}}>→ Otwórz szczegóły</span>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:4}}>
          {call.co_powiedzial&&<div style={{fontSize:12,color:'#6B6560'}}><strong>Klient:</strong> {call.co_powiedzial}</div>}
          {call.co_przeoczono&&<div style={{fontSize:12,color:'#6B6560'}}><strong>Przeoczono:</strong> {call.co_przeoczono}</div>}
          {call.akcja&&<div style={{marginTop:6,padding:'7px 12px',borderRadius:8,background:isHot?'#FEF2F0':'#FEF8EC',color:isHot?'#C0392B':'#C07A1A',fontSize:12,fontWeight:500,display:'inline-flex',border:`1px solid ${isHot?'#F5C0BB':'#F5D89A'}`}}>→ {call.akcja}</div>}
        </div>
      </div>
    </div>
  );
}

function CallDetail({call,isOpen,onToggle}){
  const checks=[
    {key:'checklist_przedstawil',l:'Przedstawił'},
    {key:'checklist_szukal_lpr',l:'ŁPR'},
    {key:'checklist_spin',l:'SPIN'},
    {key:'checklist_parametry',l:'Parametry'},
    {key:'checklist_zoom',l:'Zoom'},
    {key:'checklist_nastepny_krok',l:'Następny krok'},
  ];
  const stars='★'.repeat(call.ocena||0)+'☆'.repeat(5-(call.ocena||0));
  const wc=call.wynik==='gorący lead'?'#C0392B':call.wynik==='zainteresowany'?'#1A7A4A':'#A09890';
  const wb=call.wynik==='gorący lead'?'#FEF2F0':call.wynik==='zainteresowany'?'#EDF7F2':'#F9F8F5';
  return(
    <div style={{background:'#FFF',border:'1px solid #E8E4DC',borderRadius:12,overflow:'hidden',boxShadow:'0 1px 3px rgba(26,23,20,0.06)'}}>
      <div onClick={onToggle} style={{display:'grid',gridTemplateColumns:'80px 80px 1fr auto auto auto 28px',alignItems:'center',gap:10,padding:'12px 16px',cursor:'pointer',background:isOpen?'#F9F8F5':'#FFF'}}>
        <div style={{fontFamily:'DM Mono',fontSize:11,color:'#6B6560'}}>{call.call_time?format(parseISO(call.call_time),'dd.MM HH:mm'):''}</div>
        <div style={{fontSize:11,fontWeight:500,color:call.sip==='123'?'#5A171E':'#8A9C00'}}>{call.sip==='123'?'Beata':'Kamil'}</div>
        <div style={{fontSize:13,fontWeight:500}}>{call.klient||'—'}</div>
        <div style={{fontFamily:'DM Mono',fontSize:11,color:'#A09890'}}>{call.duration}s</div>
        <div style={{color:'#C07A1A',fontSize:12}}>{stars}</div>
        <div><span style={{fontSize:10,padding:'2px 8px',borderRadius:20,fontFamily:'DM Mono',background:wb,color:wc,border:`1px solid ${wc}30`}}>{call.wynik||'—'}</span></div>
        <div style={{color:'#A09890',fontSize:12,textAlign:'center',transition:'transform 0.2s',transform:isOpen?'rotate(180deg)':'none'}}>▼</div>
      </div>
      {isOpen&&(
        <div style={{borderTop:'1px solid #E8E4DC',padding:'16px 20px',background:'#F9F8F5'}}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:14}}>
            <div>
              <div style={{fontSize:10,fontFamily:'DM Mono',textTransform:'uppercase',color:'#A09890',marginBottom:8}}>Checklist skryptu</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:5,marginBottom:10}}>
                {checks.map(c=>(
                  <span key={c.key} style={{fontSize:10,padding:'3px 8px',borderRadius:4,fontFamily:'DM Mono',background:call[c.key]?'#EDF7F2':'#FEF2F0',color:call[c.key]?'#1A7A4A':'#C0392B',border:`1px solid ${call[c.key]?'#9AD5BC':'#F5C0BB'}`}}>
                    {call[c.key]?'✓':'✗'} {c.l}
                  </span>
                ))}
              </div>
              {call.co_powiedzial&&<div style={{fontSize:12,color:'#6B6560',lineHeight:1.6,marginBottom:6}}><strong>Klient powiedział:</strong> {call.co_powiedzial}</div>}
              {call.co_przeoczono&&<div style={{fontSize:12,color:'#6B6560',lineHeight:1.6}}><strong>Przeoczono:</strong> {call.co_przeoczono}</div>}
            </div>
            <div>
              {call.akcja&&(
                <div style={{marginBottom:12}}>
                  <div style={{fontSize:10,fontFamily:'DM Mono',textTransform:'uppercase',color:'#A09890',marginBottom:8}}>Rekomendacja</div>
                  <div style={{fontSize:12,color:'#1A7A4A',lineHeight:1.6,paddingLeft:10,borderLeft:'2px solid #1A7A4A'}}>{call.akcja}</div>
                </div>
              )}
              <div style={{display:'flex',gap:16}}>
                <div style={{textAlign:'center'}}>
                  <div style={{fontSize:18,color:call.lpr?'#1A7A4A':'#C0392B'}}>{call.lpr?'✓':'✗'}</div>
                  <div style={{fontSize:10,color:'#A09890',fontFamily:'DM Mono'}}>ŁPR</div>
                </div>
                <div style={{textAlign:'center'}}>
                  <div style={{fontSize:14,color:'#C07A1A'}}>{stars}</div>
                  <div style={{fontSize:10,color:'#A09890',fontFamily:'DM Mono'}}>Ocena</div>
                </div>
              </div>
            </div>
          </div>
          {call.transcript&&(
            <div>
              <div style={{fontSize:10,fontFamily:'DM Mono',textTransform:'uppercase',color:'#A09890',marginBottom:8}}>Pełny transkrypt</div>
              <div style={{fontSize:12,color:'#6B6560',lineHeight:1.7,background:'#FFF',border:'1px solid #E8E4DC',borderRadius:8,padding:'12px 16px',maxHeight:200,overflowY:'auto',fontFamily:'DM Mono',whiteSpace:'pre-wrap'}}>
                {call.transcript}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
