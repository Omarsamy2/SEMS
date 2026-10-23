export default function PowerChart({ history, limit }) {
  const data = history.slice(-80);
  const W = 920, H = 230, left = 48, right = 16, top = 16, bottom = 35;
  const max = Math.max(10, limit * 1.2, ...data.map(d => d.watts));
  const x = i => left + i * (W - left - right) / Math.max(1, data.length - 1);
  const y = v => H - bottom - v/max*(H - top - bottom);
  const points = data.map((d, i) => `${x(i)},${y(d.watts)}`).join(' ');
  return <div className="panel"><div className="panel-title"><h2>Power usage</h2><span className="muted">Last {data.length} readings</span></div><svg className="power-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Graph of power in watts over recent readings">
    {[0,.25,.5,.75,1].map(t => <g key={t}><line x1={left} y1={y(t*max)} x2={W-right} y2={y(t*max)} stroke="#304257"/><text x="7" y={y(t*max)+4} fill="#9daec4" fontSize="12">{(t*max).toFixed(0)}W</text></g>)}
    <line x1={left} y1={y(limit)} x2={W-right} y2={y(limit)} stroke="#f0b56c" strokeWidth="1.5" strokeDasharray="6 5"/>
    {data.length > 1 && <polyline points={points} fill="none" stroke="#55d5bd" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round"/>}
    <text x={W-right} y={H-8} fill="#9daec4" fontSize="12" textAnchor="end">Current session</text>
  </svg><div className="chart-legend"><span className="legend-line"/> Total power <span className="legend-line threshold"/> Limit</div></div>;
}
