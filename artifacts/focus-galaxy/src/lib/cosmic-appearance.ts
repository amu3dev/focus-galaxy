export const planetColors = [
  { id: 'rose', name: 'Rose Nebula', hue: '#f04e76' },
  { id: 'violet', name: 'Violet Dusk', hue: '#9b5be4' },
  { id: 'azure', name: 'Azure Sky', hue: '#3aa2f7' },
  { id: 'ember', name: 'Ember Glow', hue: '#f1883b' },
  { id: 'indigo', name: 'Deep Indigo', hue: '#466bf0' },
  { id: 'verdant', name: 'Verdant World', hue: '#85d852' },
  { id: 'gold', name: 'Solar Gold', hue: '#f0c04e' },
  { id: 'aurora', name: 'Aurora Mint', hue: '#4ef0c0' },
  { id: 'coral', name: 'Coral Dawn', hue: '#ed796b' },
  { id: 'glacier', name: 'Glacier Blue', hue: '#74cddd' },
  { id: 'orchid', name: 'Orchid Haze', hue: '#d27cdb' },
  { id: 'copper', name: 'Copper Dust', hue: '#c99768' },
] as const;

export const taskAppearances = [
  { id: 'lunar-moon', name: 'Lunar Moon', description: 'A silver moon with softly lit impact craters.' },
  { id: 'comet', name: 'Comet', description: 'An icy nucleus trailing a long turquoise plume.' },
  { id: 'asteroid', name: 'Asteroid', description: 'A weathered, angular rock with copper mineral seams.' },
  { id: 'satellite', name: 'Satellite', description: 'A gold research craft with blue solar wings.' },
  { id: 'rocket', name: 'Rocket', description: 'A silver exploration rocket with a warm engine flame.' },
  { id: 'meteor', name: 'Meteor', description: 'A molten stone wrapped in an amber fire trail.' },
  { id: 'mini-planet', name: 'Mini Planet', description: 'A little ocean world with pale cloud bands.' },
  { id: 'star-core', name: 'Star Core', description: 'A brilliant stellar heart with a sculpted corona.' },
  { id: 'ringed-moon', name: 'Ringed Moon', description: 'A lavender moon encircled by a slender icy ring.' },
  { id: 'explorer-probe', name: 'Explorer Probe', description: 'A long-range probe with a dish and instrument booms.' },
] as const;

export const noteAppearances = [
  { id: 'crystal-shard', name: 'Crystal Shard', description: 'A cut violet crystal with luminous triangular facets.' },
  { id: 'energy-orb', name: 'Energy Orb', description: 'A suspended blue core held between curved metal arms.' },
  { id: 'stardust-cluster', name: 'Stardust Cluster', description: 'A constellation of small rose and gold crystals.' },
  { id: 'ice-fragment', name: 'Ice Fragment', description: 'A translucent glacial splinter with frozen fractures.' },
  { id: 'prism', name: 'Prism', description: 'A triangular glass prism splitting a ribbon of light.' },
  { id: 'ancient-relic', name: 'Ancient Relic', description: 'A bronze orbital tablet with an inlaid turquoise seal.' },
  { id: 'vortex-core', name: 'Vortex Core', description: 'A coiled violet artifact folding around a dark center.' },
  { id: 'nebula-pearl', name: 'Nebula Pearl', description: 'An iridescent pearl nestled inside a crescent shell.' },
  { id: 'solar-gem', name: 'Solar Gem', description: 'An amber jewel held in a delicate sun-shaped setting.' },
  { id: 'quantum-cube', name: 'Quantum Cube', description: 'A floating glass cube with nested luminous edges.' },
] as const;

export type CelestialAppearance = (typeof taskAppearances)[number]['id'] | (typeof noteAppearances)[number]['id'];

export function resolveAppearance(type: 'task' | 'note', value: unknown): CelestialAppearance {
  const catalog = type === 'task' ? taskAppearances : noteAppearances;
  return catalog.find(item => item.id === value)?.id ?? catalog[0].id;
}

/** Choose once at creation; rendering only resolves the stored appearance. */
export function nextAppearance(
  type: 'task' | 'note',
  entries: readonly { type: 'task' | 'note'; appearance?: unknown }[],
  identity: string,
): CelestialAppearance {
  const catalog = type === 'task' ? taskAppearances : noteAppearances;
  const counts = new Map<CelestialAppearance, number>(catalog.map(item => [item.id, 0]));
  let last: CelestialAppearance | undefined;
  for (const entry of entries) {
    if (entry.type !== type) continue;
    last = resolveAppearance(type, entry.appearance);
    counts.set(last, (counts.get(last) ?? 0) + 1);
  }
  const minimum = Math.min(...counts.values());
  const leastUsed = catalog.filter(item => counts.get(item.id) === minimum);
  const nonRepeating = leastUsed.filter(item => item.id !== last);
  const candidates = nonRepeating.length ? nonRepeating : leastUsed;
  let hash = 2166136261;
  for (let index = 0; index < identity.length; index++) {
    hash = Math.imul(hash ^ identity.charCodeAt(index), 16777619) >>> 0;
  }
  return candidates[hash % candidates.length].id;
}
