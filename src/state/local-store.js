import { validateQuestionBank } from '../domain/question-bank.js';

const QUESTION_BANK_KEY = 'children_edu_question_bank';
let memoryQuestionBank;
let memoryQuestionBankIsAuthoritative = false;
const memoryChallengeBests = new Map();

function resolveStorage(storage) {
  if (storage !== undefined) return storage;
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function isValidBank(bank) {
  return validateQuestionBank(bank).valid;
}

function challengeKey(age, subject) {
  if (typeof age !== 'string' || !age || typeof subject !== 'string' || !subject) return null;
  return `challenge_best_${age}_${subject}`;
}

function parseScore(value) {
  const score = Number(value);
  return Number.isSafeInteger(score) && score >= 0 ? score : null;
}

export function loadQuestionBank(defaultBank, storage) {
  if (memoryQuestionBankIsAuthoritative) {
    return isValidBank(memoryQuestionBank)
      ? memoryQuestionBank
      : isValidBank(defaultBank)
        ? defaultBank
        : null;
  }

  const activeStorage = resolveStorage(storage);
  if (activeStorage && typeof activeStorage.getItem === 'function') {
    try {
      const stored = activeStorage.getItem(QUESTION_BANK_KEY);
      if (typeof stored === 'string' && stored.length > 0) {
        const parsed = JSON.parse(stored);
        if (isValidBank(parsed)) {
          memoryQuestionBank = parsed;
          return parsed;
        }
      }
    } catch {
      // Fall back to the last in-memory pack, then the bundled default.
    }
  }

  if (isValidBank(memoryQuestionBank)) return memoryQuestionBank;
  return isValidBank(defaultBank) ? defaultBank : null;
}

export function saveQuestionBank(bank, storage) {
  if (!isValidBank(bank)) return { saved: false, persistent: false };

  memoryQuestionBank = bank;
  memoryQuestionBankIsAuthoritative = true;
  const activeStorage = resolveStorage(storage);
  if (!activeStorage || typeof activeStorage.setItem !== 'function') {
    return { saved: true, persistent: false };
  }

  try {
    const serialized = JSON.stringify(bank);
    if (typeof serialized !== 'string') return { saved: true, persistent: false };
    activeStorage.setItem(QUESTION_BANK_KEY, serialized);
    memoryQuestionBankIsAuthoritative = false;
    return { saved: true, persistent: true };
  } catch {
    return { saved: true, persistent: false };
  }
}

export function resetQuestionBank(storage) {
  memoryQuestionBank = undefined;
  memoryQuestionBankIsAuthoritative = true;
  const activeStorage = resolveStorage(storage);
  if (!activeStorage || typeof activeStorage.removeItem !== 'function') {
    return { saved: true, persistent: false };
  }

  try {
    activeStorage.removeItem(QUESTION_BANK_KEY);
    memoryQuestionBankIsAuthoritative = false;
    return { saved: true, persistent: true };
  } catch {
    return { saved: true, persistent: false };
  }
}

export function getChallengeBest(age, subject, storage) {
  const key = challengeKey(age, subject);
  if (!key) return 0;
  const memoryBest = memoryChallengeBests.get(key) ?? 0;

  const activeStorage = resolveStorage(storage);
  if (activeStorage && typeof activeStorage.getItem === 'function') {
    try {
      const stored = activeStorage.getItem(key);
      if (stored !== null && stored !== undefined) {
        const parsed = parseScore(stored);
        if (parsed !== null) return Math.max(parsed, memoryBest);
      }
    } catch {
      // Use the in-memory score when storage is unavailable.
    }
  }
  return memoryBest;
}

export function saveChallengeBest(age, subject, score, storage) {
  const key = challengeKey(age, subject);
  if (!key) return 0;

  const parsedScore = parseScore(score);
  const currentBest = getChallengeBest(age, subject, storage);
  const best = Math.max(currentBest, parsedScore ?? 0);
  if (parsedScore === null || best === currentBest) return best;

  memoryChallengeBests.set(key, best);
  const activeStorage = resolveStorage(storage);
  if (activeStorage && typeof activeStorage.setItem === 'function') {
    try {
      activeStorage.setItem(key, String(best));
    } catch {
      // Keep the updated best score in memory for this session.
    }
  }
  return best;
}
