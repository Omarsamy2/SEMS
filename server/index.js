import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dataFolder = path.resolve(here, '..', 'data');
mkdirSync(dataFolder, { recursive: true });
const db = new DatabaseSync(path.join(dataFolder, 'sems.db'));
db.exec(`PRAGMA journal_mode = WAL;
CREATE TABLE IF NOT EXISTS load_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp_ms INTEGER NOT NULL,
  source TEXT NOT NULL CHECK(source IN ('simulation','hardware','system')),
  load_id INTEGER CHECK(load_id BETWEEN 1 AND 3),
  message TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS power_readings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp_ms INTEGER NOT NULL,
  source TEXT NOT NULL CHECK(source IN ('simulation','hardware')),
  load_id INTEGER NOT NULL CHECK(load_id BETWEEN 1 AND 3),
  voltage_v REAL NOT NULL,
  current_a REAL NOT NULL,
  power_w REAL NOT NULL,
  enabled INTEGER NOT NULL CHECK(enabled IN (0,1))
);
CREATE INDEX IF NOT EXISTS events_recent ON load_events(timestamp_ms DESC);
CREATE INDEX IF NOT EXISTS readings_recent ON power_readings(timestamp_ms DESC);`);
const insertEvent = db.prepare('INSERT INTO load_events(timestamp_ms,source,load_id,message) VALUES(?,?,?,?)');
const insertReading = db.prepare('INSERT INTO power_readings(timestamp_ms,source,load_id,voltage_v,current_a,power_w,enabled) VALUES(?,?,?,?,?,?,?)');
const eventsQuery = db.prepare('SELECT id,timestamp_ms AS ts,source,load_id AS loadId,message FROM load_events ORDER BY id DESC LIMIT ?');
const readingsQuery = db.prepare('SELECT id,timestamp_ms AS ts,source,load_id AS loadId,voltage_v AS voltage,current_a AS current,power_w AS watts,enabled FROM power_readings ORDER BY id DESC LIMIT ?');
const PORT=Number(process.env.SEMS_API_PORT || 3001);
function send(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
function validNum(n,max=10000){return typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=max;}
function boundedLimit(url){const n=Number(url.searchParams.get('limit')||100);return Number.isInteger(n)&&n>=1&&n<=1000?n:null;}
const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(req.method==='GET'&&url.pathname==='/api/health')return send(res,200,{ok:true,database:'SQLite',storage:'data/sems.db'});
  if(req.method==='GET'&&url.pathname==='/api/events'){
    const limit=boundedLimit(url);return limit?send(res,200,{events:eventsQuery.all(limit)}):send(res,400,{error:'limit must be 1–1000'});
  }
  if(req.method==='GET'&&url.pathname==='/api/readings'){
    const limit=boundedLimit(url);return limit?send(res,200,{readings:readingsQuery.all(limit)}):send(res,400,{error:'limit must be 1–1000'});
  }
  if(req.method!=='POST'||!['/api/events','/api/readings'].includes(url.pathname))return send(res,404,{error:'Not found'});
  let text='';
  try {for await(const chunk of req){text+=chunk;if(text.length>65536)return send(res,413,{error:'Request too large'});}}
  catch{return send(res,400,{error:'Could not read body'});}
  let input;try{input=JSON.parse(text)}catch{return send(res,400,{error:'Invalid JSON'});}
  const ts=Date.now();
  if(url.pathname==='/api/events'){
    const {message,source,loadId=null}=input||{};
    if(typeof message!=='string'||!message.trim()||message.length>300||!['simulation','hardware','system'].includes(source)||!(loadId===null||Number.isInteger(loadId)&&loadId>=1&&loadId<=3))return send(res,400,{error:'Invalid event'});
    const result=insertEvent.run(ts,source,loadId,message.trim());return send(res,201,{id:Number(result.lastInsertRowid),ts});
  }
  const {loads,source}=input||{};
  if(!['simulation','hardware'].includes(source)||!Array.isArray(loads)||loads.length!==3||new Set(loads.map(l=>l.id)).size!==3||loads.some(l=>!Number.isInteger(l.id)||l.id<1||l.id>3||typeof l.enabled!=='boolean'||!validNum(l.voltage,100)||!validNum(l.current,100)||!validNum(l.watts,10000)))return send(res,400,{error:'Expected three valid load readings'});
  db.exec('BEGIN');
  try {for(const load of loads)insertReading.run(ts,source,load.id,load.voltage,load.current,load.watts,Number(load.enabled));db.exec('COMMIT');}
  catch(error){db.exec('ROLLBACK');return send(res,500,{error:'Database write failed'});}
  return send(res,201,{ts,rows:3});
});
server.listen(PORT,'127.0.0.1',()=>console.log(`SEMS SQLite API running at http://127.0.0.1:${PORT}\nDatabase: ${path.join(dataFolder,'sems.db')}`));
