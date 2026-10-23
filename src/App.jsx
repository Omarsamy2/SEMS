import { useCallback, useEffect, useRef, useState } from 'react';
import PowerChart from './components/PowerChart.jsx';
import { baseLoads, generateSimulation } from './services/simulation.js';
import { normalizeTelemetry, sumPower } from './services/protocol.js';
import { getEvents, getReadings, postEvent, postReadings } from './services/database.js';
const PAGES = ['Overview', 'Loads', 'History', 'Events', 'Settings'];
const shortTime = time => new Date(time).toLocaleTimeString();
function LoadCard({ load, limit, onToggle, isDemo }) {
  return <article className="panel load"><div className="between"><h3>{load.name}</h3><span className={`tag ${load.enabled?'on':'off'}`}>{load.enabled?'ON':'OFF'}</span></div><p className="muted">Priority {load.priority} · {load.voltage.toFixed(1)} V · {load.current.toFixed(2)} A</p><div className="load-watts">{load.watts.toFixed(2)} <small>W</small></div><div className="meter"><div style={{width:`${Math.min(100, load.watts/Math.max(limit,1)*100)}%`}}/></div><button className="outline" onClick={() => onToggle(load.id)} disabled={!isDemo} title={!isDemo?'Live control is disabled until the firmware command protocol is agreed':''}>{load.enabled?'Turn OFF':'Request ON'}</button></article>;
}
export default function App() {
  const [page, setPage] = useState('Overview');
  const [mode, setMode] = useState('simulation');
  const [socketUrl, setSocketUrl] = useState('ws://192.168.1.50/ws');
  const [connection, setConnection] = useState('Simulation active');
  const [loads, setLoads] = useState(baseLoads);
  const [limit, setLimit] = useState(35);
  const [draftLimit, setDraftLimit] = useState('35');
  const [draftPriorities, setDraftPriorities] = useState({1:1,2:2,3:3});
  const [events, setEvents] = useState([]);
  const [storedReadings, setStoredReadings] = useState([]);
  const [dbStatus, setDbStatus] = useState('Checking storage…');
  const modeRef = useRef(mode);
  useEffect(() => { modeRef.current = mode; }, [mode]);
  const refreshDatabase = useCallback(async () => {
    try {
      const [savedEvents, savedReadings] = await Promise.all([getEvents(), getReadings()]);
      setEvents(savedEvents); setStoredReadings(savedReadings); setDbStatus('SQLite connected');
    } catch { setDbStatus('Database offline — start npm run server'); }
  }, []);
  useEffect(() => { refreshDatabase(); }, [refreshDatabase]);
  useEffect(() => { if (page === 'Events' || page === 'History') refreshDatabase(); }, [page, refreshDatabase]);
  const [history, setHistory] = useState([]);
  const [lastSample, setLastSample] = useState(null);
  const loadsRef = useRef(loads); const limitRef = useRef(limit); const wsRef = useRef(null);
  useEffect(() => { loadsRef.current=loads; }, [loads]);
  useEffect(() => { limitRef.current=limit; }, [limit]);
  const log = useCallback((message, loadId = null) => {
    const item = {ts:Date.now(), message, source:modeRef.current, loadId};
    setEvents(prev => [item,...prev].slice(0,500));
    postEvent(item).then(() => setDbStatus('SQLite connected')).catch(() => setDbStatus('Database offline — event not saved'));
  }, []);
  const record = useCallback(newLoads => {
    const ts=Date.now(); setLoads(newLoads); loadsRef.current = newLoads;
    setHistory(prev=>[...prev,{ts, watts:sumPower(newLoads)}].slice(-1000)); setLastSample(ts);
    postReadings({source:modeRef.current,loads:newLoads}).then(() => setDbStatus('SQLite connected')).catch(() => setDbStatus('Database offline — reading not saved'));
  },[]);
  useEffect(() => {
    if (mode !== 'simulation') return;
    setConnection('Simulation active');
    const sample = () => {
      const { loads: next, messages }=generateSimulation(loadsRef.current,limitRef.current);
      record(next); messages.forEach(log);
    };
    sample(); const timer=setInterval(sample,2000); return () => clearInterval(timer);
  },[mode,record,log]);
  useEffect(() => {
    if (mode !== 'hardware') return;
    let disposed=false;
    let ws;
    try { ws=new WebSocket(socketUrl); } catch { setConnection('Invalid WebSocket URL'); return; }
    wsRef.current=ws; setConnection('Connecting…');
    ws.onopen=()=>{if(!disposed){setConnection('ESP32 connected');log('WebSocket connected')}};
    ws.onmessage=event=>{
      try {const data=JSON.parse(event.data);const parsed=normalizeTelemetry(data);
        if (parsed) { limitRef.current=parsed.limit;setLimit(parsed.limit);setDraftLimit(String(parsed.limit));setDraftPriorities(Object.fromEntries(parsed.loads.map(l=>[l.id,l.priority])));record(parsed.loads); }
        else if(data.type==='event' && typeof data.message==='string') log(data.message.slice(0,300));
      } catch { log('Received invalid WebSocket message'); }
    };
    ws.onerror=()=>{ if(!disposed)setConnection('WebSocket error'); };
    ws.onclose=()=>{ if(!disposed){setConnection('Disconnected');log('WebSocket disconnected')} };
    return ()=>{disposed=true;wsRef.current=null;ws.close()};
  },[mode,socketUrl,log,record]);
  const switchMode = next=>{
    if(next===mode)return;
    if(next==='simulation'){setLoads(baseLoads());loadsRef.current=baseLoads();setLimit(35);limitRef.current=35;setDraftLimit('35');setDraftPriorities({1:1,2:2,3:3});}
    setHistory([]);setLastSample(null);setMode(next);log(`Switched to ${next} mode`);
  };
  const toggleLoad = id => {
    if(mode!=='simulation')return;
    const next=loadsRef.current.map(l=>l.id===id?{...l,enabled:!l.enabled,current:0,watts:0}:l);
    loadsRef.current=next;setLoads(next);log(`Load ${id} toggled from dashboard`);
    const updated=generateSimulation(next,limitRef.current);loadsRef.current=updated.loads;setLoads(updated.loads);updated.messages.forEach(log);
  };
  const save = event => {
    event.preventDefault();const v=Number(draftLimit);
    if(!Number.isFinite(v)||v<=0||v>1000){window.alert('Power limit must be greater than 0 and no more than 1000 W.');return;}
    if (mode==='hardware') {window.alert('For safety, hardware configuration commands are not enabled until the team agrees on authorization, validation, and acknowledgement handling.');return;}
    setLimit(v);limitRef.current=v;
    const next=loadsRef.current.map(l=>({...l, priority:Number(draftPriorities[l.id])}));
    const updated=generateSimulation(next,v);loadsRef.current=updated.loads;setLoads(updated.loads);updated.messages.forEach(log);
    log(`Simulation settings saved: ${v} W limit`);
  };
  const watts = sumPower(loads);
  const energyWh = history.reduce((sum,sample,i)=>i===0?sum:sum+(history[i-1].watts+sample.watts)/2*(sample.ts-history[i-1].ts)/3600000,0);
  return <div className="shell"><aside className="sidebar"><div className="brand">SEMS</div><p className="project-name">ECE 49200 · Senior Design</p><nav aria-label="Pages">{PAGES.map(name=><button key={name} className={page===name?'selected':''} onClick={()=>setPage(name)}>{name}</button>)}</nav><div className="sidebar-bottom">Three-load · 12 V system<br/>Software v0.3</div></aside><main className="main"><header className="top"><div><h1>{page}</h1><p className="muted">Smart Energy Management System</p></div><span className={`status ${mode==='hardware' && connection!=='ESP32 connected'?'warning':''}`}>● {connection}</span></header>
   {page==='Overview'&&<><div className="metrics"><div className="panel"><div className="muted">Total Power</div><div className="value">{watts.toFixed(2)} <small>W</small></div></div><div className="panel"><div className="muted">Power Limit</div><div className="value">{limit.toFixed(1)} <small>W</small></div></div><div className="panel"><div className="muted">Active Loads</div><div className="value">{loads.filter(l=>l.enabled).length} <small>/ 3</small></div></div><div className="panel"><div className="muted">Measured Energy*</div><div className="value">{energyWh.toFixed(4)} <small>Wh</small></div></div></div><div className="section-heading"><h2>Connected loads</h2><span className="muted">{mode==='simulation'?'Simulated readings':'ESP32 telemetry'}</span></div><div className="load-grid">{loads.map(l=><LoadCard key={l.id} load={l} limit={limit} onToggle={toggleLoad} isDemo={mode==='simulation'}/>)}</div><div className="section"><PowerChart history={history} limit={limit}/></div></>}
   {page==='Loads'&&<><div className="section-heading"><h2>Load management</h2><span className="muted">1 = highest priority</span></div><div className="load-grid">{loads.map(l=><LoadCard key={l.id} load={l} limit={limit} onToggle={toggleLoad} isDemo={mode==='simulation'}/>)}</div><p className="footnote">In hardware mode, this UI displays status only until firmware-side controls and command acknowledgements are implemented.</p></>}
   {page==='History'&&<><PowerChart history={history} limit={limit}/><div className="panel section"><div className="panel-title"><h2>Reading history</h2><span className="muted">Saved in SQLite · latest 100 readings shown</span></div><table><thead><tr><th>Time</th><th>Total Power (W)</th></tr></thead><tbody>{storedReadings.slice(0,100).map(s=><tr key={s.id}><td>{new Date(s.ts).toLocaleString()} · Load {s.loadId}</td><td>{s.watts.toFixed(2)}</td></tr>)}</tbody></table></div></>}
   {page==='Events'&&<div className="panel"><div className="panel-title"><h2>System events</h2><span className="muted">{dbStatus} · persistent history</span></div><table><thead><tr><th>Time</th><th>Event</th></tr></thead><tbody>{events.map((e,i)=><tr key={e.id ?? `${e.ts}-${i}`}><td>{new Date(e.ts).toLocaleString()}</td><td>{e.loadId ? `Load ${e.loadId}: ` : ''}{e.message}</td></tr>)}</tbody></table></div>}
   {page==='Settings'&&<div className="settings-layout"><div className="panel"><h2>Data source</h2><div className="toggle-group"><button className={mode==='simulation'?'chosen':''} onClick={()=>switchMode('simulation')}>Simulation</button><button className={mode==='hardware'?'chosen':''} onClick={()=>switchMode('hardware')}>ESP32 WebSocket</button></div><label>ESP32 WebSocket URL<input type="url" value={socketUrl} onChange={e=>setSocketUrl(e.target.value)} placeholder="ws://192.168.1.50/ws" disabled={mode!=='hardware'}/></label><p className="footnote">Use a URL hosted by the ESP32 on your local Wi-Fi network. Incoming telemetry must follow <code>PROTOCOL.md</code>. No live firmware has been provided.</p><p className="muted">Last sample: {lastSample?new Date(lastSample).toLocaleString():'None yet'}</p></div><form className="panel" onSubmit={save}><h2>Load configuration</h2><label>Maximum power (W)<input type="number" min="0.1" max="1000" step="0.1" value={draftLimit} onChange={e=>setDraftLimit(e.target.value)}/></label>{loads.map(l=><label key={l.id}>{l.name} priority<select value={draftPriorities[l.id]} onChange={e=>setDraftPriorities(prev=>({...prev,[l.id]:e.target.value}))}>{[1,2,3].map(p=><option value={p} key={p}>{p} {p===1?'(highest)':''}</option>)}</select></label>)}<button className="primary" type="submit" disabled={mode==='hardware'}>Save configuration</button>{mode==='hardware'&&<p className="footnote">Read-only hardware mode; configuration requires a validated firmware command protocol.</p>}</form></div>}
   <footer>* Energy estimate on Overview uses current-session samples. Events and per-load readings are saved to SQLite when the backend is running. Storage: {dbStatus}. {mode==='simulation'?'Demonstration data — not physical measurements.':'Hardware telemetry mode.'}</footer>
  </main></div>;
}
