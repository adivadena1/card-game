// Ember Duel — input.js
// Mouse and keyboard for the table. Click a card (or press 1–7) to play it,
// arrow keys move the selection, Enter/Space ends the turn, R restarts from
// an end screen. All handlers funnel into the callbacks main.js provides.

export function bindInput(callbacks) {
  const hand = document.getElementById('player-hand');

  hand.addEventListener('click', (event) => {
    const cardNode = event.target.closest('.card');
    if (!cardNode || cardNode.dataset.handIndex === undefined) return;
    callbacks.onPlayCard(Number(cardNode.dataset.handIndex));
  });

  document.getElementById('end-turn-btn').addEventListener('click', () => {
    callbacks.onEndTurn();
  });

  document.getElementById('play-btn').addEventListener('click', () => {
    callbacks.onStartGame();
  });

  document.getElementById('play-again-btn').addEventListener('click', () => {
    callbacks.onRestart();
  });

  document.getElementById('rules-btn').addEventListener('click', () => {
    document.getElementById('rules-modal').classList.remove('hidden');
  });

  document.getElementById('rules-close-btn').addEventListener('click', () => {
    document.getElementById('rules-modal').classList.add('hidden');
  });

  document.getElementById('sound-btn').addEventListener('click', (event) => {
    const muted = callbacks.onToggleSound();
    event.currentTarget.textContent = muted ? '🔇 Sound off' : '🔊 Sound on';
  });

  document.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    const key = event.key;
    if (key >= '1' && key <= '7') {
      callbacks.onPlayCard(Number(key) - 1);
    } else if (key === 'ArrowLeft' || key === 'ArrowRight') {
      callbacks.onMoveSelection(key === 'ArrowRight' ? 1 : -1);
    } else if (key === 'Enter' || key === ' ') {
      const titleVisible = !document.getElementById('title-screen').classList.contains('hidden');
      const endVisible = !document.getElementById('end-screen').classList.contains('hidden');
      if (titleVisible) callbacks.onStartGame();
      else if (endVisible) callbacks.onRestart();
      else if (callbacks.onPlaySelected()) {
        // A selected card was played; nothing else to do.
      } else {
        callbacks.onEndTurn();
      }
      event.preventDefault();
    } else if (key === 'r' || key === 'R') {
      const endVisible = !document.getElementById('end-screen').classList.contains('hidden');
      if (endVisible) callbacks.onRestart();
    } else if (key === 'Escape') {
      document.getElementById('rules-modal').classList.add('hidden');
    }
  });
}
