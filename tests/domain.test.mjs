import assert from 'node:assert/strict';
import test from 'node:test';

import { defaultBank } from '../src/data/default-bank.js';
import {
  getAnswerLabel,
  matchesPair,
  questionsForSession,
  searchQuestions,
  validateQuestionBank,
} from '../src/domain/question-bank.js';
import { scoreChoice, shuffle } from '../src/domain/scoring.js';

function sampleChoice() {
  return {
    id: 1,
    subject: 'math',
    ageGroup: '6-8',
    type: 'choice',
    question: 'Choose a number',
    options: ['one', 'two'],
    answer: 0,
    explanation: 'One is first.',
  };
}

function sampleBank(question = sampleChoice()) {
  return { schemaVersion: 1, title: 'Test bank', questions: [question] };
}

test('the v1 bank keeps all 64 questions and validates', () => {
  assert.equal(defaultBank.schemaVersion, 1);
  assert.equal(defaultBank.title, '小芽练习室 (Sprout Practice Studio)');
  assert.equal(defaultBank.questions.length, 64);
  assert.deepEqual(
    defaultBank.questions.map(({ id }) => id),
    Array.from({ length: 64 }, (_, index) => index + 1),
  );
  assert.equal(defaultBank.questions.filter(({ type }) => type === 'choice').length, 50);
  assert.equal(defaultBank.questions.filter(({ type }) => type === 'match').length, 14);
  assert.deepEqual(validateQuestionBank(defaultBank), { valid: true, errors: [] });

  const categories = new Set(
    defaultBank.questions.map(({ ageGroup, subject }) => `${ageGroup}/${subject}`),
  );
  assert.equal(categories.size, 12);
  assert.ok(defaultBank.questions.every(({ type }) => type === 'choice' || type === 'match'));
});

test('validation rejects malformed imports, duplicate question IDs, and unsupported categories', () => {
  for (const value of [null, [], 'not a bank', {}]) {
    assert.equal(validateQuestionBank(value).valid, false);
  }

  const duplicate = sampleBank();
  duplicate.questions.push({ ...sampleChoice() });
  assert.equal(validateQuestionBank(duplicate).valid, false);

  const badCategory = sampleBank();
  badCategory.questions[0].subject = 'history';
  assert.equal(validateQuestionBank(badCategory).valid, false);

  const emptyText = sampleBank();
  emptyText.questions[0].explanation = '  ';
  assert.equal(validateQuestionBank(emptyText).valid, false);
});

test('choice validation enforces nonempty options and zero-based answer bounds', () => {
  const belowRange = sampleBank();
  belowRange.questions[0].answer = -1;
  assert.equal(validateQuestionBank(belowRange).valid, false);

  const aboveRange = sampleBank();
  aboveRange.questions[0].answer = 2;
  assert.equal(validateQuestionBank(aboveRange).valid, false);

  const emptyOption = sampleBank();
  emptyOption.questions[0].options[1] = '';
  assert.equal(validateQuestionBank(emptyOption).valid, false);
});

test('match validation requires unique IDs but permits duplicate display labels', () => {
  const question = {
    id: 7,
    subject: 'math',
    ageGroup: '9-12',
    type: 'match',
    question: 'Match equivalent labels',
    explanation: 'Each pair is identified by its stable ID.',
    pairs: [
      { id: 'first', left: 'same', right: 'answer' },
      { id: 'second', left: 'same', right: 'answer' },
    ],
  };
  assert.equal(validateQuestionBank(sampleBank(question)).valid, true);

  question.pairs[1].id = 'first';
  assert.equal(validateQuestionBank(sampleBank(question)).valid, false);
});

test('session filtering and text search include match labels and respect filters', () => {
  const mathFractions = questionsForSession(defaultBank.questions, '9-12', 'math', 'match');
  assert.deepEqual(
    mathFractions.map(({ id }) => id),
    [42, 44],
  );
  assert.equal(questionsForSession(defaultBank.questions, '3-5', 'english', 'choice').length, 4);

  assert.deepEqual(
    searchQuestions(defaultBank.questions, '春眠').map(({ id }) => id),
    [28],
  );
  assert.deepEqual(
    searchQuestions(defaultBank.questions, 'cat', { ageGroup: '6-8', subject: 'english' }).map(
      ({ id }) => id,
    ),
    [36],
  );
  assert.deepEqual(
    searchQuestions(defaultBank.questions, '相对论', { subject: 'common' }).map(({ id }) => id),
    [64],
  );
  assert.deepEqual(searchQuestions(defaultBank.questions, '['), []);
});

test('fraction search returns the correct stable pairs instead of zipping labels by position', () => {
  const fractionQuestion = defaultBank.questions.find(({ id }) => id === 42);
  assert.deepEqual(
    searchQuestions(defaultBank.questions, '1/2').map(({ id }) => id),
    [40, 42],
  );
  assert.equal(getAnswerLabel(fractionQuestion), '1/2 → 第二、1/3 → 最小、2/5 → 第三、3/4 → 最大');
  assert.equal(matchesPair(fractionQuestion, 'q42-pair-1', 'q42-pair-1'), true);
  assert.equal(matchesPair(fractionQuestion, 'q42-pair-1', 'q42-pair-2'), false);
  assert.equal(matchesPair(fractionQuestion, '1/2', '1/2'), false);

  const distractor = {
    ...fractionQuestion,
    id: 100,
    question: 'Compare 1/20',
    explanation: 'This question is about a twentieth.',
    pairs: [{ id: 'twentieth', left: '1/20', right: 'twentieth' }],
  };
  assert.deepEqual(searchQuestions([distractor], '1/2'), []);
});

test('imported markup and regex metacharacters remain inert plain text', () => {
  const hostile = sampleChoice();
  hostile.question = '<img src=x onerror=alert(1)>';
  hostile.options[0] = '<script>alert(1)</script>';
  assert.equal(validateQuestionBank(sampleBank(hostile)).valid, true);
  assert.deepEqual(searchQuestions([hostile], 'onerror'), [hostile]);
  assert.equal(getAnswerLabel(hostile), '<script>alert(1)</script>');
  assert.deepEqual(searchQuestions([hostile], '['), []);
});

test('scoreChoice preserves retries, every-third streak bonus, and streak reset', () => {
  assert.deepEqual(scoreChoice({ correct: true }), {
    points: 10,
    bonus: 0,
    total: 10,
    consecutiveCorrect: 1,
  });
  assert.deepEqual(scoreChoice({ correct: true, retries: 1, consecutiveCorrect: 2 }), {
    points: 5,
    bonus: 5,
    total: 10,
    consecutiveCorrect: 3,
  });
  assert.deepEqual(scoreChoice({ correct: false, retries: 3, consecutiveCorrect: 2 }), {
    points: 0,
    bonus: 0,
    total: 0,
    consecutiveCorrect: 0,
  });
});

test('shuffle uses Fisher-Yates, preserves input, and returns the same sequence members', () => {
  const input = ['a', 'b', 'c', 'd'];
  const shuffled = shuffle(input, () => 0);
  assert.deepEqual(shuffled, ['b', 'c', 'd', 'a']);
  assert.deepEqual(input, ['a', 'b', 'c', 'd']);
  assert.deepEqual([...shuffled].sort(), [...input].sort());
});
