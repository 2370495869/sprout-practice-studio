import assert from 'node:assert/strict';
import test from 'node:test';

import { defaultBank } from '../src/data/default-bank.js';
import {
  getChallengeBest,
  loadQuestionBank,
  resetQuestionBank,
  saveChallengeBest,
  saveQuestionBank,
} from '../src/state/local-store.js';

function createStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
  };
}

const unavailableStorage = {
  getItem() {
    throw new Error('storage unavailable');
  },
  setItem() {
    throw new Error('storage unavailable');
  },
  removeItem() {
    throw new Error('storage unavailable');
  },
};

const copy = (value) => JSON.parse(JSON.stringify(value));

test('question bank save/load/reset uses persistence when available', () => {
  const storage = createStorage();
  const customBank = copy(defaultBank);
  customBank.title = 'Custom pack';

  assert.deepEqual(resetQuestionBank(storage), { saved: true, persistent: true });
  assert.deepEqual(saveQuestionBank(customBank, storage), { saved: true, persistent: true });
  assert.equal(loadQuestionBank(defaultBank, storage).title, 'Custom pack');
  assert.deepEqual(resetQuestionBank(storage), { saved: true, persistent: true });
  assert.strictEqual(loadQuestionBank(defaultBank, storage), defaultBank);
});

test('malformed imports fall back to the bundled bank without prototype pollution', () => {
  const storage = createStorage({ children_edu_question_bank: '{' });
  resetQuestionBank(storage);
  storage.setItem('children_edu_question_bank', 'not-json');
  assert.strictEqual(loadQuestionBank(defaultBank, storage), defaultBank);

  const poisonedJson = JSON.stringify(defaultBank).replace(
    '"schemaVersion":1,',
    '"__proto__":{"polluted":true},"schemaVersion":1,',
  );
  assert.notEqual(poisonedJson, JSON.stringify(defaultBank));
  storage.setItem('children_edu_question_bank', poisonedJson);
  const imported = loadQuestionBank(defaultBank, storage);
  assert.equal(imported.questions.length, 64);
  assert.equal({}.polluted, undefined);
});

test('invalid banks are rejected and storage failures use the in-memory fallback', () => {
  resetQuestionBank(unavailableStorage);
  assert.deepEqual(saveQuestionBank({ schemaVersion: 9 }, unavailableStorage), {
    saved: false,
    persistent: false,
  });

  const customBank = copy(defaultBank);
  customBank.title = 'Session-only pack';
  assert.deepEqual(saveQuestionBank(customBank, unavailableStorage), {
    saved: true,
    persistent: false,
  });
  assert.equal(loadQuestionBank(defaultBank, unavailableStorage).title, 'Session-only pack');

  assert.deepEqual(resetQuestionBank(unavailableStorage), { saved: true, persistent: false });
  assert.strictEqual(loadQuestionBank(defaultBank, unavailableStorage), defaultBank);
});

test('failed writes and resets override stale persisted packs for the current session', () => {
  const staleBank = copy(defaultBank);
  staleBank.title = 'Stale persisted pack';
  const blockedStorage = {
    ...createStorage({ children_edu_question_bank: JSON.stringify(staleBank) }),
    setItem() {
      throw new Error('quota exceeded');
    },
  };
  resetQuestionBank(createStorage());

  const sessionBank = copy(defaultBank);
  sessionBank.title = 'Session fallback pack';
  assert.deepEqual(saveQuestionBank(sessionBank, blockedStorage), {
    saved: true,
    persistent: false,
  });
  assert.equal(loadQuestionBank(defaultBank, blockedStorage).title, 'Session fallback pack');

  const blockedReset = {
    ...createStorage({ children_edu_question_bank: JSON.stringify(staleBank) }),
    removeItem() {
      throw new Error('storage unavailable');
    },
  };
  assert.deepEqual(resetQuestionBank(blockedReset), { saved: true, persistent: false });
  assert.strictEqual(loadQuestionBank(defaultBank, blockedReset), defaultBank);
});

test('challenge bests persist by age and subject, retain the maximum, and fall back to memory', () => {
  const storage = createStorage();
  assert.equal(getChallengeBest('3-5', 'math', storage), 0);
  assert.equal(saveChallengeBest('3-5', 'math', 25, storage), 25);
  assert.equal(saveChallengeBest('3-5', 'math', 12, storage), 25);
  assert.equal(getChallengeBest('3-5', 'math', storage), 25);
  assert.equal(getChallengeBest('6-8', 'math', storage), 0);

  assert.equal(saveChallengeBest('test-age', 'test-subject', 17, unavailableStorage), 17);
  assert.equal(getChallengeBest('test-age', 'test-subject', unavailableStorage), 17);
  assert.equal(saveChallengeBest('test-age', 'test-subject', -1, unavailableStorage), 17);

  const staleBest = {
    ...createStorage({ challenge_best_stale_age_stale_subject: '10' }),
    setItem() {
      throw new Error('quota exceeded');
    },
  };
  assert.equal(saveChallengeBest('stale_age', 'stale_subject', 15, staleBest), 15);
  assert.equal(getChallengeBest('stale_age', 'stale_subject', staleBest), 15);
});

test('HTML-like imported question text is retained as data, not evaluated', () => {
  const storage = createStorage();
  const customBank = copy(defaultBank);
  customBank.questions[0].question = '<svg onload=alert(1)>';
  assert.deepEqual(saveQuestionBank(customBank, storage), { saved: true, persistent: true });
  assert.equal(
    loadQuestionBank(defaultBank, storage).questions[0].question,
    '<svg onload=alert(1)>',
  );
  assert.equal({}.alert, undefined);
});
