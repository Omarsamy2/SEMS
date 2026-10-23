import { initialLoads, sumPower } from './protocol';
export const baseLoads = () => initialLoads.map(l => ({ ...l }));
export function generateSimulation(loads, limit) {
  const next = loads.map(l => {
    if (!l.enabled) return { ...l, current: 0, watts: 0 };
    const baseline = [0.8, 1.2, 0.5][l.id - 1];
    const current = Math.max(0, baseline + (Math.random() - 0.5) * 0.18);
    return { ...l, current, watts: l.voltage * current };
  });
  const messages = [];
  while (sumPower(next) > limit) {
    // Priority 1 is highest. For equal priority, shed the higher ID first.
    const candidate = [...next].filter(l => l.enabled).sort((a,b) => b.priority-a.priority || b.id-a.id)[0];
    if (!candidate) break;
    const index = next.findIndex(l => l.id === candidate.id);
    next[index] = { ...candidate, enabled: false, current: 0, watts: 0 };
    messages.push(`${candidate.name} automatically shed (power exceeded ${limit} W)`);
  }
  return { loads: next, messages };
}
