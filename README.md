![Best Card Game](https://make.fun/badge/best-card-game-20261122-1826.svg)
![Rank](https://make.fun/badge/best-card-game-20261122-1826/adivadena1/card-game/rank.svg)
![Reward](https://make.fun/badge/best-card-game-20261122-1826/adivadena1/card-game/reward.svg)

# Ember Duel — Best Card Game entry

A complete original card game for the [make.fun Best Card Game bounty](https://make.fun/bounty/best-card-game-20261122-1826). A
turn-based duel against Cinder, an ember spirit: both duelists have 20 Life
and Ember (mana) that grows every turn. Play Strike, Guard and Heal cards from
a 30-card deck across four elements — Flame, Tide, Stone, Gale — and chain two
cards of the same element in one turn to trigger a **Surge** (double effect).

## How to play

- **Goal:** bring Cinder's Life from 20 to 0 before she does the same to you.
- **Ember** pays for cards. It refills and grows by 1 every turn (max 10).
- **Strike** deals damage, **Guard** gives block, **Heal** restores Life.
- **Surge:** the second card of the same element played in one turn has its
  effect doubled. A third card of the same element plays flat.
- Element flavour: Flame strikes +1, Tide heals +1, Stone guards +2, Gale
  cards cost 1 less Ember but hit 1 weaker. Backdraft strikes +2 against a
  Gale card Cinder just played.
- **Cinder** is readable: she takes the kill when she sees it, guards and
  heals when hurt, and loves a Surge as much as you do.
- Mouse: click a card to play it. Keyboard: `1–7` play a card, `← →` select,
  `Enter` plays the selected card, `Space` ends your turn, `R` play again.

## Run it

Serve `game/` with any static server and open `index.html` in desktop Chrome
(no network needed, no build step):

```sh
cd game && python3 -m http.server 8080
```

Or with Node: `npx serve game` — then open http://localhost:3000.

Sounds are synthesized with WebAudio (no audio files). Query strings are for
screenshots and headless playtests only: `?shot=title|table|win|loss&seed=N`
renders a fixed state, `?test=win|loss` rigs an opening then plays it out to
a win or a loss, `?autoplay=fair` plays a full fair duel on its own.

## Layout

- `game/index.html` + `game/styles.css` — the table
- `game/src/deck.js` — elements, cards, deck, seeded RNG
- `game/src/ai.js` — Cinder's decisions
- `game/src/render.js` — cards, bars, log, banners, screens
- `game/src/input.js` — mouse + keyboard
- `game/src/audio.js` — synthesized WebAudio sounds
- `game/src/shots.js` — screenshot / playtest setups
- `game/src/main.js` — duel state machine and turn flow
- `main.ts` — the hand-in program (copies `game/` + `screenshots/` to
  `/output` and writes `dossier.json` via `vendor/makefun-game.ts`)
- `screenshots/` — four real renders of the game (title, table, win, loss)

## License

MIT — see `LICENSE`.
