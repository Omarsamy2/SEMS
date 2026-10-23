// Proposed protocol v1. Agree this format with the embedded team before flashing firmware.
export const initialLoads = [
  { id: 1, name: 'Load 1', priority: 1, enabled: true, voltage: 12, current: 0.8, watts: 9.6 },
  { id: 2, name: 'Load 2', priority: 2, enabled: true, voltage: 12, current: 1.2, watts: 14.4 },
  { id: 3, name: 'Load 3', priority: 3, enabled: true, voltage: 12, current: 0.5, watts: 6.0 },
];
export const sumPower = loads => loads.reduce((sum, load) => sum + (load.enabled ? load.watts : 0), 0);
export function normalizeTelemetry(payload) {
  if (!payload || payload.type !== 'telemetry' || !Array.isArray(payload.loads) || payload.loads.length !== 3) return null;
  const ids = new Set();
  const loads = payload.loads.map((input) => {
    if (!input || !Number.isInteger(input.id) || input.id < 1 || input.id > 3 || ids.has(input.id)) return null;
    ids.add(input.id);
    if (typeof input.enabled !== 'boolean' || !Number.isInteger(input.priority) || input.priority < 1 || input.priority > 3) return null;
    if (![input.voltage, input.current, input.watts].every(n => typeof n === 'number' && Number.isFinite(n) && n >= 0)) return null;
    return { id: input.id, name: `Load ${input.id}`, enabled: input.enabled, priority: input.priority, voltage: input.voltage, current: input.current, watts: input.enabled ? input.watts : 0 };
  });
  if (loads.some(item => item === null) || ids.size !== 3 || typeof payload.limitWatts !== 'number' || !Number.isFinite(payload.limitWatts) || payload.limitWatts <= 0) return null;
  return { loads: loads.sort((a,b) => a.id - b.id), limit: payload.limitWatts };
}
