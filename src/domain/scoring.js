export function scoreChoice({ correct, retries = 0, consecutiveCorrect = 0 } = {}) {
  const streak =
    Number.isSafeInteger(consecutiveCorrect) && consecutiveCorrect > 0 ? consecutiveCorrect : 0;

  if (correct !== true) {
    return { points: 0, bonus: 0, total: 0, consecutiveCorrect: 0 };
  }

  const retryCount = Number.isSafeInteger(retries) && retries > 0 ? retries : 0;
  const nextStreak = streak + 1;
  const points = retryCount === 0 ? 10 : 5;
  const bonus = nextStreak % 3 === 0 ? 5 : 0;
  return {
    points,
    bonus,
    total: points + bonus,
    consecutiveCorrect: nextStreak,
  };
}

export function shuffle(items, random = Math.random) {
  if (!Array.isArray(items)) return [];
  const shuffled = [...items];
  const randomValue = typeof random === 'function' ? random : Math.random;

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const sample = Number(randomValue());
    const unit = Number.isFinite(sample) ? Math.min(1, Math.max(0, sample)) : 0;
    const swapIndex = Math.min(index, Math.floor(unit * (index + 1)));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}
