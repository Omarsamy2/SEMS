// The Vite dev server forwards /api requests to the localhost SQLite backend.
async function request(path, options) {
  const response = await fetch(path, options);
  if (!response.ok) throw new Error(`Database request failed (${response.status})`);
  return response.json();
}
const post = (path, value) => request(path, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(value)});
export const getEvents = async () => (await request('/api/events?limit=500')).events;
export const getReadings = async () => (await request('/api/readings?limit=500')).readings;
export const postEvent = value => post('/api/events', value);
export const postReadings = value => post('/api/readings', value);
