import confetti from 'canvas-confetti';

// PR達成時の派手な紙吹雪
export function firePrConfetti(): void {
  confetti({ particleCount: 140, spread: 90, origin: { y: 0.7 } });
  setTimeout(() => {
    confetti({ particleCount: 90, angle: 60, spread: 60, origin: { x: 0, y: 0.8 } });
  }, 250);
  setTimeout(() => {
    confetti({ particleCount: 90, angle: 120, spread: 60, origin: { x: 1, y: 0.8 } });
  }, 450);
}
