// Ember Duel — shots.js
// Screenshot and headless-playtest setups. These only run when the page is
// opened with a query string (?shot=, ?test= or ?autoplay=); the normal game
// at index.html with no query string is always a fair duel from a fresh deal.
//
// ?shot=title  — the title screen over a fresh table
// ?shot=table  — a mid-game table: turn 4, both sides hurt, cards played,
//                a Surge already fired, log lines visible
// ?shot=win    — the victory screen, reached by playing a real lethal card
// ?shot=loss   — the defeat screen, reached by a real lethal AI card
// ?test=win    — rigged opening, then autoplay wins it (fast)
// ?test=loss   — rigged opening, then autoplay loses it (fast)
// ?autoplay=fair — a full fair duel, both sides playing the AI's scoring

import { showTitleScreen, hideTitleScreen, addLogLine } from './render.js';
import { effectiveCost, effectivePower } from './deck.js';

function rigForWin(api) {
  const state = api.getState();
  state.ai.life = 5;
  state.ai.block = 0;
  state.player.hand = state.player.hand.slice(0, 2);
  // A hand that can finish the job: two Novas and a heavy strike.
  const deck = state.player.deck;
  const nova = deck.find((c) => c.name.endsWith('Nova'));
  if (nova) {
    state.player.hand.push(nova);
    state.player.deck = deck.filter((c) => c.id !== nova.id);
  }
  state.player.ember = 10;
  state.player.emberMax = 10;
}

function rigForLoss(api) {
  const state = api.getState();
  state.player.life = 4;
  state.player.block = 0;
  state.ai.ember = 10;
  state.ai.emberMax = 10;
  // Give Cinder a heavy hand so the loss lands on her turn.
  const heavy = state.ai.deck.filter((c) => c.type === 'strike' && c.power >= 6).slice(0, 2);
  for (const card of heavy) {
    state.ai.hand.push(card);
    state.ai.deck = state.ai.deck.filter((c) => c.id !== card.id);
  }
}

// Play the table shot for real: two player cards (a same-element pair, so a
// Surge fires) and one AI card, using the game's own playCard path.
// Ember starts at 6 of 6 in turn 6, and the two cards are cheap enough to
// leave at least 2 ember: a cover shot at 0 ember would grey out the whole
// hand with the .unaffordable filter, hiding every suit colour.
function playTableScript(api) {
  const state = api.getState();
  state.turn = 6;
  state.player.life = 16;
  state.player.block = 3;
  state.ai.life = 18;
  state.ai.block = 4;
  state.player.ember = 6;
  state.player.emberMax = 6;
  state.ai.ember = 6;
  state.ai.emberMax = 6;

  const hand = state.player.hand;
  const first = hand.findIndex((c) => effectiveCost(c) <= 2);
  if (first < 0) return;
  const firstCard = hand[first];
  api.playCard('player', first);
  const second = state.player.hand.findIndex(
    (c) => c.element === firstCard.element && effectiveCost(c) <= state.player.ember - 2,
  );
  if (second >= 0) api.playCard('player', second);
  // Cinder answers with one strike of her own.
  const aiStrike = state.ai.hand.findIndex((c) => c.type === 'strike' && effectiveCost(c) <= 4);
  if (aiStrike >= 0) api.playCard('ai', aiStrike);
  addLogLine('Turn 6 — the table is warm.', 'info');
}

function shotWin(api) {
  const state = api.getState();
  state.ai.life = 3;
  state.ai.block = 0;
  state.player.ember = 10;
  state.player.emberMax = 10;
  // A strike that actually finishes the job: power at least Cinder's life.
  const lethal = state.player.hand.findIndex(
    (c) => c.type === 'strike' && effectiveCost(c) <= 10 && effectivePower(c) >= state.ai.life,
  );
  if (lethal >= 0) api.playCard('player', lethal);
}

function shotLoss(api) {
  const state = api.getState();
  state.player.life = 3;
  state.player.block = 0;
  state.ai.ember = 10;
  state.ai.emberMax = 10;
  const lethal = state.ai.hand.findIndex(
    (c) => c.type === 'strike' && effectiveCost(c) <= 10 && effectivePower(c) >= state.player.life,
  );
  if (lethal >= 0) api.playCard('ai', lethal);
  else {
    // No lethal strike in hand: draw until one shows up, then play it.
    let guard = 0;
    while (state.player.life > 0 && guard < 30) {
      guard += 1;
      const card = state.ai.deck.pop();
      if (!card) break;
      state.ai.hand.push(card);
      const idx = state.ai.hand.findIndex(
        (c) => c.type === 'strike' && effectivePower(c) >= state.player.life,
      );
      if (idx >= 0) {
        api.playCard('ai', idx);
        break;
      }
    }
  }
}

export function setupShotOrTest(api) {
  const { params } = api;
  const shot = params.get('shot');
  const test = params.get('test');
  const autoplay = params.get('autoplay');
  if (!shot && !test && !autoplay) return;

  api.setInstant(true);
  const state = api.getState();
  hideTitleScreen();
  state.phase = 'playing';

  if (shot === 'title') {
    showTitleScreen();
    return;
  }
  if (shot === 'table') {
    playTableScript(api);
    return;
  }
  if (shot === 'win') {
    shotWin(api);
    return;
  }
  if (shot === 'loss') {
    shotLoss(api);
    return;
  }

  // Test / autoplay modes: start a real duel and let the autoplay drive it.
  if (test === 'win') rigForWin(api);
  if (test === 'loss') rigForLoss(api);

  let turnsGuard = 0;
  function drive() {
    const current = api.getState();
    if (current.phase === 'over' || turnsGuard > 200) return;
    turnsGuard += 1;
    if (current.phase === 'playing') {
      api.autoplayTurn();
    }
    setTimeout(drive, 0);
  }
  setTimeout(drive, 0);
}
