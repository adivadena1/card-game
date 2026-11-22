// Ember Duel — render.js
// Everything the player sees: cards, life and ember bars, the played-card
// zone, the duel log, floating damage numbers, banners and the title / end
// screens. DOM + CSS only, no canvas: text stays sharp at thumbnail size.

import { ELEMENTS, effectiveCost, effectivePower, CARD_TYPES } from './deck.js';

// Inline SVG glyphs: each element is told apart by colour AND shape, never
// by text alone. Drawn as paths so they scale cleanly at any size.
const GLYPHS = {
  flame:
    '<svg viewBox="0 0 24 24"><path d="M12 2 C13 6 17 7 17 12 a5 5 0 0 1 -10 0 C7 9 9 8 9 5 C10 7 11 7 12 2 Z M12 13 a2.5 2.5 0 0 0 2.5 2.5 A2.5 2.5 0 0 0 12 20 a2.5 2.5 0 0 0 -2.5 -2.5 A2.5 2.5 0 0 0 12 13 Z"/></svg>',
  wave:
    '<svg viewBox="0 0 24 24"><path d="M2 14 c3 -3 5 3 8 0 s5 3 8 0 s3 -2 4 -1 v6 H2 Z M2 9 c3 -3 5 3 8 0 s5 3 8 0 s3 -2 4 -1 v4 H2 Z"/></svg>',
  peak:
    '<svg viewBox="0 0 24 24"><path d="M3 20 L10 6 L14 13 L17 8 L21 20 Z M10 15 l1.5 2.5 h-3 Z"/></svg>',
  wind:
    '<svg viewBox="0 0 24 24"><path d="M3 8 h9 a3 3 0 1 0 -3 -3 M3 12 h13 a3 3 0 1 1 -3 3 M3 16 h6 a2.5 2.5 0 1 1 -2.5 2.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
};

export function glyphSvg(element) {
  return GLYPHS[ELEMENTS[element].glyph] ?? '';
}

function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

function powerLabel(card) {
  if (card.type === 'strike') return 'DMG';
  if (card.type === 'guard') return 'BLOCK';
  return 'HEAL';
}

// One face-up card. `opts.playable` dims cards the player cannot afford;
// `opts.selected` marks the keyboard-selected card.
export function cardElement(card, opts = {}) {
  const info = ELEMENTS[card.element];
  const node = el('div', `card el-${card.element}`);
  node.dataset.cardId = String(card.id);
  if (opts.playable === false) node.classList.add('unaffordable');
  if (opts.selected) node.classList.add('selected');
  if (opts.played) node.classList.add('played-card');

  const cost = el('div', 'card-cost', String(effectiveCost(card)));
  cost.title = 'Ember cost';
  node.appendChild(cost);

  const glyph = el('div', 'card-glyph');
  glyph.innerHTML = glyphSvg(card.element);
  node.appendChild(glyph);

  node.appendChild(el('div', 'card-name', card.name));
  node.appendChild(el('div', 'card-type', `${CARD_TYPES[card.type].label} · ${info.name}`));
  const power = el('div', 'card-power', String(effectivePower(card)));
  node.appendChild(power);
  node.appendChild(el('div', 'card-power-label', powerLabel(card)));
  node.appendChild(el('div', 'card-text', card.text));
  return node;
}

export function cardBackElement() {
  const node = el('div', 'card card-back');
  node.innerHTML =
    '<div class="card-back-glyph">' +
    '<svg viewBox="0 0 24 24"><path d="M12 2 C13 6 17 7 17 12 a5 5 0 0 1 -10 0 C7 9 9 8 9 5 C10 7 11 7 12 2 Z"/></svg>' +
    '</div><div class="card-back-word">EMBER</div>';
  return node;
}

function emberPips(current, max) {
  const wrap = el('div', 'ember-pips');
  for (let i = 0; i < max; i++) {
    const pip = el('div', 'ember-pip' + (i < current ? ' filled' : ''));
    pip.textContent = '◆';
    wrap.appendChild(pip);
  }
  return wrap;
}

function lifeBar(life, block) {
  const wrap = el('div', 'life-wrap');
  const bar = el('div', 'life-bar');
  const fill = el('div', 'life-fill');
  fill.style.width = `${Math.max(0, (life / 20) * 100)}%`;
  if (life <= 6) fill.classList.add('low');
  bar.appendChild(fill);
  wrap.appendChild(bar);
  const nums = el('div', 'life-nums', `♥ ${life} / 20`);
  wrap.appendChild(nums);
  if (block > 0) wrap.appendChild(el('div', 'block-badge', `🛡 ${block} Block`));
  return wrap;
}

function renderSide(state, who) {
  const side = state[who];
  const area = document.getElementById(who === 'player' ? 'player-area' : 'opponent-area');
  area.querySelector('.life-slot').replaceChildren(lifeBar(side.life, side.block));
  const emberSlot = area.querySelector('.ember-slot');
  emberSlot.replaceChildren();
  emberSlot.appendChild(el('span', 'ember-label', `Ember ${side.ember} / ${side.emberMax}`));
  emberSlot.appendChild(emberPips(side.ember, side.emberMax));
}

function renderHands(state) {
  const oppHand = document.getElementById('opponent-hand');
  oppHand.replaceChildren();
  state.ai.hand.forEach(() => oppHand.appendChild(cardBackElement()));
  document.getElementById('opponent-count').textContent = `${state.ai.hand.length} cards`;

  const hand = document.getElementById('player-hand');
  hand.replaceChildren();
  state.player.hand.forEach((card, index) => {
    const node = cardElement(card, {
      playable: effectiveCost(card) <= state.player.ember && state.phase === 'playing',
      selected: index === state.selectedIndex,
    });
    node.dataset.handIndex = String(index);
    node.title = `${card.name} — ${index + 1} to play`;
    hand.appendChild(node);
  });
  document.getElementById('player-count').textContent =
    `${state.player.hand.length} cards · Deck ${state.player.deck.length}`;
}

function renderPlayedZone(state) {
  const zone = document.getElementById('played-zone');
  zone.replaceChildren();
  const shown = state.lastPlayed.slice(-4);
  if (shown.length === 0) {
    zone.appendChild(el('div', 'played-empty', 'Play a card — the duel is waiting.'));
    return;
  }
  for (const play of shown) {
    const wrap = el('div', 'played-wrap');
    wrap.appendChild(el('div', 'played-by', play.by === 'player' ? 'You played' : 'Cinder played'));
    wrap.appendChild(cardElement(play.card, { played: true }));
    if (play.surge) wrap.appendChild(el('div', 'surge-tag', 'SURGE ×2'));
    zone.appendChild(wrap);
  }
}

function renderStatus(state) {
  const turnEl = document.getElementById('turn-indicator');
  if (state.phase === 'over') {
    turnEl.textContent = state.winner === 'player' ? 'Victory!' : 'Defeat';
  } else if (state.phase === 'ai') {
    turnEl.textContent = `Turn ${state.turn} — Cinder is thinking…`;
  } else {
    turnEl.textContent = `Turn ${state.turn} — Your move`;
  }
  const endBtn = document.getElementById('end-turn-btn');
  endBtn.disabled = state.phase !== 'playing';
  endBtn.textContent = state.phase === 'ai' ? 'Cinder plays…' : 'End Turn ⏎';
}

export function renderAll(state) {
  renderSide(state, 'player');
  renderSide(state, 'ai');
  renderHands(state);
  renderPlayedZone(state);
  renderStatus(state);
}

export function addLogLine(text, cls) {
  const log = document.getElementById('duel-log');
  const line = el('div', 'log-line' + (cls ? ` ${cls}` : ''), text);
  log.prepend(line);
  while (log.children.length > 7) log.removeChild(log.lastChild);
}

export function clearLog() {
  document.getElementById('duel-log').replaceChildren();
}

// A floating number over a side's life area: damage, block or healing.
export function floatText(who, amount, kind) {
  const area = document.getElementById(who === 'player' ? 'player-area' : 'opponent-area');
  const anchor = area.querySelector('.life-slot');
  const node = el('div', `float-text ${kind}`, (amount > 0 ? '+' : '') + String(amount));
  anchor.appendChild(node);
  node.addEventListener('animationend', () => node.remove());
}

let bannerTimer = null;
export function showBanner(text, sub) {
  const banner = document.getElementById('banner');
  banner.replaceChildren();
  banner.appendChild(el('div', 'banner-main', text));
  if (sub) banner.appendChild(el('div', 'banner-sub', sub));
  banner.classList.add('show');
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => banner.classList.remove('show'), 1100);
}

export function showTitleScreen() {
  document.getElementById('title-screen').classList.remove('hidden');
  document.getElementById('end-screen').classList.add('hidden');
}

export function hideTitleScreen() {
  document.getElementById('title-screen').classList.add('hidden');
}

export function showEndScreen(win, stats) {
  const screen = document.getElementById('end-screen');
  screen.classList.remove('hidden');
  screen.classList.toggle('win', win);
  screen.classList.toggle('loss', !win);
  document.getElementById('end-title').textContent = win ? 'VICTORY!' : 'DEFEAT';
  document.getElementById('end-sub').textContent = win
    ? 'Cinder’s ember fades. The table is yours.'
    : 'Cinder’s ember burns on. Shuffle up and try again.';
  document.getElementById('end-stats').textContent =
    `Turns ${stats.turns} · Cards played ${stats.cardsPlayed} · ` +
    `Damage dealt ${stats.damageDealt} · Surges ${stats.surges}`;
  document.getElementById('play-again-btn').focus();
}
