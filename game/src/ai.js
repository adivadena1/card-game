// Ember Duel — ai.js
// Cinder, the ember-spirit opponent. Her choices are meant to be read and
// countered: she goes for the kill when she can see it, she turtles when she
// is hurt, and she loves a same-element Surge. Pure logic, no DOM.

import { effectiveCost, effectivePower } from './deck.js';

// Score one card for Cinder in her current position. Higher is better.
function scoreCard(card, self, foe) {
  const cost = effectiveCost(card);
  const power = effectivePower(card);
  let score = 0;

  if (card.type === 'strike') {
    // Lethal damage is worth everything.
    const lethal = power >= foe.life + foe.block;
    score += power * 2;
    if (lethal) score += 100;
    // Hitting a foe who just guarded is less useful.
    if (foe.block > 0) score -= Math.min(foe.block, power) * 0.5;
    // Cheap strikes are efficient when ember is tight.
    score += (4 - cost) * 1.5;
  } else if (card.type === 'guard') {
    // Guard matters most when Cinder is in danger.
    const danger = self.life <= 8 ? 3 : self.life <= 12 ? 1.5 : 0.5;
    score += power * danger;
    if (foe.life <= 6) score -= 4; // don't turtle when the foe is almost dead
  } else if (card.type === 'heal') {
    const missing = 20 - self.life;
    if (missing <= 0) score -= 50; // full life: healing is wasted
    else score += Math.min(power, missing) * 1.6;
    if (self.life <= 6) score += 12; // desperate healing
  }
  return score;
}

// Pick Cinder's plays for this turn. Returns an ordered list of card ids.
// She may play at most 3 cards: long AI turns are boring to watch, and a
// capped turn keeps the duel from snowballing in a single round.
export function chooseAiPlays(state) {
  // Simulate on copies: scoring must never touch the real duel.
  const self = { ...state.ai };
  const foe = { ...state.player };
  const plays = [];
  let ember = self.ember;
  const playedElements = [];
  const hand = self.hand.slice();

  for (let step = 0; step < 3; step++) {
    let best = null;
    let bestScore = -Infinity;
    for (const card of hand) {
      if (plays.includes(card.id)) continue;
      const cost = effectiveCost(card);
      if (cost > ember) continue;
      let score = scoreCard(card, self, foe);
      // Surge hunger: a second card of an element already played this turn
      // doubles, so it is worth reaching for.
      if (playedElements.includes(card.element)) score += 14;
      // Opening a Surge chain with a cheap card is good setup.
      if (playedElements.length === 0 && cost <= 2) score += 2;
      if (score > bestScore) {
        bestScore = score;
        best = card;
      }
    }
    if (!best || bestScore <= 0) break;
    plays.push(best.id);
    ember -= effectiveCost(best);
    playedElements.push(best.element);
    // Pretend the card resolved, so the next pick sees the new position.
    if (best.type === 'strike') {
      const dmg = effectivePower(best) * (playedElements.filter((e) => e === best.element).length > 1 ? 2 : 1);
      const absorbed = Math.min(foe.block, dmg);
      foe.block -= absorbed;
      foe.life = Math.max(0, foe.life - (dmg - absorbed));
    } else if (best.type === 'guard') {
      self.block += effectivePower(best);
    } else if (best.type === 'heal') {
      self.life = Math.min(20, self.life + effectivePower(best));
    }
  }
  return plays;
}

// The same scoring, exposed for the in-page autoplay that plays the human
// side during headless playtests. It picks the single best affordable card.
export function chooseBestCard(hand, ember, self, foe, playedElements) {
  let best = null;
  let bestScore = -Infinity;
  for (const card of hand) {
    const cost = effectiveCost(card);
    if (cost > ember) continue;
    let score = scoreCard(card, self, foe);
    if (playedElements.includes(card.element)) score += 14;
    if (score > bestScore) {
      bestScore = score;
      best = card;
    }
  }
  return bestScore > 0 ? best : null;
}
