// Ember Duel — main.js
// The duel itself: state, turn flow, playing a card, the Surge combo rule,
// win and loss, and the AI's turn. Rendering, input, sound and the AI's
// choices live in their own files; this one only runs the game.

import { buildDeck, drawFrom, effectiveCost, effectivePower, counterBonus, makeRng, shuffle, ELEMENTS } from './deck.js';
import { chooseAiPlays, chooseBestCard } from './ai.js';
import { renderAll, addLogLine, clearLog, floatText, showBanner, hideTitleScreen, showEndScreen } from './render.js';
import { bindInput } from './input.js';
import * as audio from './audio.js';
import { setupShotOrTest } from './shots.js';

const MAX_LIFE = 20;
const MAX_EMBER = 10;
const MAX_HAND = 7;
const START_HAND = 5;

let state = null;
let instant = false; // true in shot/test mode: no animation delays

function freshSide(rng) {
  const deck = shuffle(buildDeck(), rng);
  const hand = [];
  for (let i = 0; i < START_HAND; i++) hand.push(deck.pop());
  return { life: MAX_LIFE, block: 0, ember: 1, emberMax: 1, hand, deck, discard: [], started: false };
}

export function newDuel(seed) {
  const rng = makeRng(seed);
  state = {
    seed,
    rng,
    phase: 'title',
    turn: 1,
    player: freshSide(rng),
    ai: freshSide(rng),
    playedElements: [],
    lastPlayed: [],
    selectedIndex: 0,
    winner: null,
    stats: { cardsPlayed: 0, damageDealt: 0, surges: 0, turns: 1 },
  };
  clearLog();
  addLogLine('A new duel begins. Cinder shuffles her deck.', 'info');
  // The player's first turn is the deal itself, so it counts as started:
  // without this the player would sit one ember behind Cinder all duel.
  state.player.started = true;
  renderAll(state);
  return state;
}

function sideName(who) {
  return who === 'player' ? 'You' : 'Cinder';
}

function possessiveName(who) {
  return who === 'player' ? 'Your' : "Cinder's";
}

function playVerb(who) {
  return who === 'player' ? 'play' : 'plays';
}

// Element of the most recent card `who`'s foe played, or undefined when the
// foe has played nothing yet. Used by cards that answer the foe's element.
function foeLastElement(who) {
  const foe = who === 'player' ? 'ai' : 'player';
  for (let i = state.lastPlayed.length - 1; i >= 0; i--) {
    if (state.lastPlayed[i].by === foe) return state.lastPlayed[i].card.element;
  }
  return undefined;
}

function drawCard(who) {
  const side = state[who];
  if (side.hand.length >= MAX_HAND) {
    // The card is not lost (drawFrom is never called), but the player
    // deserves to know the draw went nowhere.
    if (who === 'player') addLogLine('Your hand is full — the drawn card stays in the deck.', 'warn');
    return null;
  }
  const card = drawFrom(side.deck, side.discard, state.rng);
  if (card) side.hand.push(card);
  return card;
}

function startTurn(who) {
  const side = state[who];
  // The first turn of each side keeps ember at 1: without this the side
  // moving second would always sit one ember ahead of the first.
  if (side.started) side.emberMax = Math.min(MAX_EMBER, side.emberMax + 1);
  side.started = true;
  side.ember = side.emberMax;
  side.block = 0;
  state.playedElements = [];
  drawCard(who);
}

function startPlayerTurn() {
  if (state.phase === 'over') return;
  state.turn += 1;
  state.stats.turns = state.turn;
  startTurn('player');
  state.phase = 'playing';
  state.selectedIndex = 0;
  audio.playTurnSound();
  addLogLine(`Turn ${state.turn} — your move. Ember refills to ${state.player.ember}.`, 'info');
  renderAll(state);
}

function dealDamage(target, amount, attacker) {
  const side = state[target];
  const absorbed = Math.min(side.block, amount);
  side.block -= absorbed;
  const toLife = amount - absorbed;
  side.life = Math.max(0, side.life - toLife);
  // No floatText here: playCard shows the number after renderAll, because
  // renderSide rebuilds the life area and would discard a float made now.
  if (absorbed > 0) addLogLine(`${possessiveName(target)} block absorbs ${absorbed}.`, 'info');
  if (attacker === 'player') state.stats.damageDealt += toLife;
  return toLife;
}

// Play the card at handIndex for `who`.
// Returns 'played' when the card resolved, 'unaffordable' when the side
// cannot pay for it, and 'none' when nothing could be played at all.
// Callers must tell those apart: 'unaffordable' is not a reason to end the
// turn, only 'none' is.
export function playCard(who, handIndex) {
  if (state.phase === 'over') return 'none';
  if (who === 'player' && state.phase !== 'playing') return 'none';
  const side = state[who];
  const card = side.hand[handIndex];
  if (!card) return 'none';
  const cost = effectiveCost(card);
  if (cost > side.ember) {
    if (who === 'player') addLogLine(`Not enough ember for ${card.name} (${cost} needed).`, 'warn');
    return 'unaffordable';
  }

  side.hand.splice(handIndex, 1);
  side.ember -= cost;
  // Surge doubles only the SECOND card of an element in one turn: exactly
  // one card of this element was played before it. A third one plays flat.
  const surge = state.playedElements.filter((e) => e === card.element).length === 1;
  state.playedElements.push(card.element);
  // A card that answers the foe's element (Backdraft vs Gale) hits harder
  // when the foe's most recent card was of that element.
  const foeElement = foeLastElement(who);
  const counter = counterBonus(card, foeElement);
  const power = effectivePower(card, foeElement) * (surge ? 2 : 1);

  if (who === 'player') {
    state.stats.cardsPlayed += 1;
    if (surge) state.stats.surges += 1;
  }
  state.lastPlayed.push({ card, by: who, surge, power });
  // Bounded: the played zone shows the last 4, and the counter lookup only
  // ever needs the foe's most recent card (at most 7 plays back).
  if (state.lastPlayed.length > 8) state.lastPlayed.shift();
  side.discard.push(card);

  const foe = who === 'player' ? 'ai' : 'player';
  const elementName = ELEMENTS[card.element].name;
  // Floating numbers are collected here and shown after renderAll below:
  // renderSide rebuilds the life area, which would discard a float made
  // before it, so no number ever reached the screen.
  const floats = [];
  if (surge) {
    audio.playSurgeSound();
    showBanner('SURGE!', `${elementName} ×2 — ${card.name} hits twice as hard`);
    addLogLine(`SURGE! ${card.name} doubles to ${power}.`, 'surge');
  }
  if (counter > 0) {
    addLogLine(`${card.name} answers ${ELEMENTS[foeElement].name} — +${counter} power.`, 'surge');
  }

  if (card.type === 'strike') {
    audio.playCardSound(card.element);
    audio.playHitSound(power >= 8);
    const dealt = dealDamage(foe, power, who);
    if (dealt > 0) floats.push([foe, -dealt, 'damage']);
    addLogLine(`${sideName(who)} ${playVerb(who)} ${card.name} (${elementName}) — ${dealt} damage to ${sideName(foe)}.`, 'strike');
  } else if (card.type === 'guard') {
    audio.playGuardSound();
    side.block += power;
    floats.push([who, power, 'block']);
    addLogLine(`${sideName(who)} ${playVerb(who)} ${card.name} (${elementName}) — gains ${power} block.`, 'guard');
  } else {
    audio.playHealSound();
    const healed = Math.min(power, MAX_LIFE - side.life);
    side.life = Math.min(MAX_LIFE, side.life + power);
    if (healed > 0) floats.push([who, healed, 'heal']);
    addLogLine(`${sideName(who)} ${playVerb(who)} ${card.name} (${elementName}) — restores ${healed} life.`, 'heal');
  }

  if (who === 'player') state.selectedIndex = Math.min(state.selectedIndex, side.hand.length - 1);
  renderAll(state);
  checkEnd();
  for (const [target, amount, kind] of floats) floatText(target, amount, kind);
  return 'played';
}

function checkEnd() {
  if (state.phase === 'over') return;
  if (state.ai.life <= 0) return endDuel('player');
  if (state.player.life <= 0) return endDuel('ai');
}

function endDuel(winner) {
  state.phase = 'over';
  state.winner = winner;
  renderAll(state);
  if (winner === 'player') {
    audio.playWinSound();
    addLogLine('Cinder falls. You win the duel!', 'win');
  } else {
    audio.playLossSound();
    addLogLine('Your ember gutters out. Cinder wins.', 'loss');
  }
  showEndScreen(winner === 'player', state.stats);
  writeTestResult();
}

export function endPlayerTurn() {
  if (state.phase !== 'playing') return;
  state.phase = 'ai';
  addLogLine('You end your turn. Cinder takes the table.', 'info');
  renderAll(state);
  runAiTurn();
}

function runAiTurn() {
  startTurn('ai');
  const plays = chooseAiPlays(state);
  let step = 0;
  const stepDelay = instant ? 0 : 650;

  function nextPlay() {
    if (state.phase === 'over') return;
    if (step >= plays.length) {
      addLogLine(`Cinder ends her turn with ${state.ai.hand.length} cards in hand.`, 'info');
      renderAll(state);
      setTimeout(startPlayerTurn, instant ? 0 : 450);
      return;
    }
    const cardId = plays[step];
    step += 1;
    const index = state.ai.hand.findIndex((c) => c.id === cardId);
    if (index >= 0) playCard('ai', index);
    setTimeout(nextPlay, stepDelay);
  }
  setTimeout(nextPlay, instant ? 0 : 500);
}

// Autoplay for headless playtests: the human side uses the same scoring as
// the AI, so a full fair duel can be run without a mouse.
export function autoplayStep() {
  if (state.phase !== 'playing') return false;
  const played = state.playedElements.slice();
  const card = chooseBestCard(state.player.hand, state.player.ember, state.player, state.ai, played, foeLastElement('player'));
  if (!card) return false;
  const index = state.player.hand.findIndex((c) => c.id === card.id);
  return playCard('player', index) === 'played';
}

export function autoplayTurn() {
  if (state.phase !== 'playing') return;
  let guard = 0;
  while (autoplayStep() && guard < 7) guard += 1;
  if (state.phase === 'playing') endPlayerTurn();
}

function writeTestResult() {
  const node = document.getElementById('test-result');
  if (!node) return;
  const result = {
    winner: state.winner,
    turns: state.turn,
    playerLife: state.player.life,
    aiLife: state.ai.life,
    cardsPlayed: state.stats.cardsPlayed,
    damageDealt: state.stats.damageDealt,
    surges: state.stats.surges,
  };
  node.textContent = JSON.stringify(result);
  document.title = `Ember Duel — ${state.winner === 'player' ? 'WIN' : 'LOSS'} in ${state.turn} turns`;
}

export function setInstant(value) {
  instant = value;
}

export function getState() {
  return state;
}

export function startGame() {
  hideTitleScreen();
  state.phase = 'playing';
  audio.playTurnSound();
  addLogLine('Your move — play a card or end your turn.', 'info');
  renderAll(state);
}

export function restartGame() {
  const seed = (Date.now() % 2147483647) || 7;
  newDuel(seed);
  hideTitleScreen();
  document.getElementById('end-screen').classList.add('hidden');
  state.phase = 'playing';
  audio.playTurnSound();
  renderAll(state);
}

function boot() {
  const params = new URLSearchParams(location.search);
  const seed = Number(params.get('seed') || '7');
  newDuel(Number.isFinite(seed) && seed > 0 ? seed : 7);

  bindInput({
    onPlayCard: (index) => playCard('player', index),
    onPlaySelected: () => {
      if (state.phase !== 'playing') return false;
      return playCard('player', state.selectedIndex);
    },
    onMoveSelection: (delta) => {
      if (state.player.hand.length === 0) return;
      state.selectedIndex =
        (state.selectedIndex + delta + state.player.hand.length) % state.player.hand.length;
      renderAll(state);
    },
    onEndTurn: () => endPlayerTurn(),
    onStartGame: () => startGame(),
    onRestart: () => restartGame(),
    onToggleSound: () => {
      audio.setMuted(!audio.isMuted());
      return audio.isMuted();
    },
  });

  // Shot / test / autoplay modes (screenshots and headless playtests).
  setupShotOrTest({
    params,
    state: () => state,
    newDuel,
    playCard,
    endPlayerTurn,
    autoplayTurn,
    setInstant,
    startGame,
    getState,
  });
}

document.addEventListener('DOMContentLoaded', boot);
