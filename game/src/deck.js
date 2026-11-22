// Ember Duel — deck.js
// Owns the four elements, every card definition, deck construction and the
// seeded random number generator the whole game draws from. No DOM here:
// this module only knows about cards, so the rules can be tested on their own.

export const ELEMENTS = {
  flame: { name: 'Flame', color: '#e5484d', dark: '#8f1d20', light: '#ffd9d4', glyph: 'flame' },
  tide: { name: 'Tide', color: '#3e8fe8', dark: '#174a86', light: '#d4e8ff', glyph: 'wave' },
  stone: { name: 'Stone', color: '#b07a3f', dark: '#6b4423', light: '#ffe9cf', glyph: 'peak' },
  gale: { name: 'Gale', color: '#46a758', dark: '#1f5c2e', light: '#d8f5dd', glyph: 'wind' },
};

export const CARD_TYPES = {
  strike: { label: 'Strike', verb: 'hits' },
  guard: { label: 'Guard', verb: 'wards' },
  heal: { label: 'Heal', verb: 'mends' },
};

// Element flavour, kept small so the table stays readable:
// Flame strikes hit +1, Tide heals +1, Stone guards +2, Gale cards cost 1
// less Ember but hit 1 weaker (cheap, not free). Backdraft, in the
// blueprint below, strikes +2 against a Gale card the foe just played.
export function elementBonus(element, type) {
  if (element === 'flame' && type === 'strike') return 1;
  if (element === 'tide' && type === 'heal') return 1;
  if (element === 'stone' && type === 'guard') return 2;
  return 0;
}

export function effectiveCost(card) {
  if (card.element === 'gale') return Math.max(1, card.cost - 1);
  return card.cost;
}

// A card that answers the foe's element: Backdraft burns hotter (+2) when
// the foe's most recently played card was Gale. foeLastElement is that
// element, or undefined when the foe has played nothing yet.
export function counterBonus(card, foeLastElement) {
  if (card.bonusVs && foeLastElement === card.bonusVs.element) return card.bonusVs.power;
  return 0;
}

export function effectivePower(card, foeLastElement) {
  let power = card.power + elementBonus(card.element, card.type);
  if (card.element === 'gale') power -= 1; // Gale is cheap, so it hits weaker
  return power + counterBonus(card, foeLastElement);
}

let nextCardId = 1;

export function makeCard(element, type, name, cost, power, text, bonusVs) {
  const card = {
    id: nextCardId++,
    element,
    type,
    name,
    cost,
    power,
    text,
  };
  if (bonusVs) card.bonusVs = bonusVs;
  return card;
}

// The 30-card deck every duelist shuffles: 6 cards per element plus a heavy
// "Nova" finisher per element and two extra sparks. Names are original.
const DECK_BLUEPRINT = [
  // element, type, name, cost, power, flavour text
  ['flame', 'strike', 'Ember Lash', 2, 3, 'A whip of live coal.'],
  ['flame', 'strike', 'Backdraft', 2, 3, 'Burns hotter against Gale.', { element: 'gale', power: 2 }],
  ['flame', 'strike', 'Cinder Fang', 3, 5, 'Bites through armour.'],
  ['flame', 'guard', 'Flame Ward', 2, 5, 'A wall of held fire.'],
  ['flame', 'heal', 'Ember Mend', 2, 4, 'Warmth knits the wound.'],
  ['flame', 'strike', 'Spark Nip', 1, 2, 'Small, quick, annoying.'],
  ['flame', 'strike', 'Flame Nova', 4, 7, 'The hearth explodes.'],
  ['tide', 'strike', 'Tide Crash', 2, 3, 'A wave that hits like stone.'],
  ['tide', 'strike', 'Tide Crash', 2, 3, 'A wave that hits like stone.'],
  ['tide', 'strike', 'Riptide Pull', 3, 5, 'Drags the foe under.'],
  ['tide', 'guard', 'Tide Wall', 2, 5, 'Water holds its shape.'],
  ['tide', 'heal', 'Tide Renew', 2, 4, 'Cool water, clear head.'],
  ['tide', 'strike', 'Dew Prick', 1, 2, 'Small, quick, annoying.'],
  ['tide', 'strike', 'Tide Nova', 4, 7, 'The whole sea rises.'],
  ['stone', 'strike', 'Stone Slam', 2, 3, 'A fist of mountain.'],
  ['stone', 'strike', 'Stone Slam', 2, 3, 'A fist of mountain.'],
  ['stone', 'strike', 'Quake Step', 3, 5, 'The floor answers back.'],
  ['stone', 'guard', 'Stone Bulwark', 2, 5, 'Nothing gets through.'],
  ['stone', 'heal', 'Stone Salve', 2, 4, 'Mud and moss, it works.'],
  ['stone', 'strike', 'Pebble Flick', 1, 2, 'Small, quick, annoying.'],
  ['stone', 'strike', 'Stone Nova', 4, 7, 'The mountain falls.'],
  ['gale', 'strike', 'Gale Slice', 2, 3, 'Wind with an edge.'],
  ['gale', 'strike', 'Gale Slice', 2, 3, 'Wind with an edge.'],
  ['gale', 'strike', 'Storm Shear', 3, 5, 'Cuts the air itself.'],
  ['gale', 'guard', 'Gale Veil', 2, 5, 'A curtain of fast air.'],
  ['gale', 'heal', 'Gale Breath', 2, 4, 'Fresh air, fresh strength.'],
  ['gale', 'strike', 'Breeze Sting', 1, 2, 'Small, quick, annoying.'],
  ['gale', 'strike', 'Gale Nova', 4, 7, 'The sky comes down.'],
  ['flame', 'strike', 'Wild Spark', 1, 2, 'Jumps where it pleases.'],
  ['tide', 'strike', 'Wild Spark', 1, 2, 'Jumps where it pleases.'],
];

export function buildDeck() {
  // Note: nextCardId is NOT reset here. buildDeck runs once per side, so a
  // reset would hand both hands the same ids 1..30; ids must stay unique
  // across the whole duel (the AI looks cards up by id).
  return DECK_BLUEPRINT.map(([element, type, name, cost, power, text, bonusVs]) =>
    makeCard(element, type, name, cost, power, text, bonusVs),
  );
}

// mulberry32: a tiny deterministic PRNG so a seed replays the same duel.
export function makeRng(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle(deck, rng) {
  const out = deck.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function drawFrom(deck, discard, rng) {
  if (deck.length === 0) {
    if (discard.length === 0) return null;
    deck.push(...shuffle(discard.splice(0), rng));
  }
  return deck.pop() ?? null;
}
