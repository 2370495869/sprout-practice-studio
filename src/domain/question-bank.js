export const QUESTION_BANK_SCHEMA_VERSION = 1;

const SUBJECTS = new Set(['math', 'chinese', 'english', 'common']);
const AGE_GROUPS = new Set(['3-5', '6-8', '9-12']);

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

export function validateQuestionBank(bank) {
  const errors = [];

  try {
    if (!isRecord(bank)) {
      return { valid: false, errors: ['bank must be an object'] };
    }

    if (bank.schemaVersion !== QUESTION_BANK_SCHEMA_VERSION) {
      errors.push(`schemaVersion must be ${QUESTION_BANK_SCHEMA_VERSION}`);
    }
    if (!isNonEmptyText(bank.title)) errors.push('title must be non-empty text');
    if (!Array.isArray(bank.questions)) {
      errors.push('questions must be an array');
      return { valid: false, errors };
    }

    const questionIds = new Set();
    for (const [index, question] of bank.questions.entries()) {
      const path = `questions[${index}]`;
      if (!isRecord(question)) {
        errors.push(`${path} must be an object`);
        continue;
      }

      if (!Number.isSafeInteger(question.id) || question.id < 1) {
        errors.push(`${path}.id must be a positive safe integer`);
      } else if (questionIds.has(question.id)) {
        errors.push(`${path}.id duplicates question id ${question.id}`);
      } else {
        questionIds.add(question.id);
      }

      if (!SUBJECTS.has(question.subject)) errors.push(`${path}.subject is not supported`);
      if (!AGE_GROUPS.has(question.ageGroup)) errors.push(`${path}.ageGroup is not supported`);
      if (!isNonEmptyText(question.question))
        errors.push(`${path}.question must be non-empty text`);
      if (!isNonEmptyText(question.explanation))
        errors.push(`${path}.explanation must be non-empty text`);

      if (question.type === 'choice') {
        if (!Array.isArray(question.options) || question.options.length < 2) {
          errors.push(`${path}.options must contain at least two choices`);
        } else if (!question.options.every(isNonEmptyText)) {
          errors.push(`${path}.options must contain only non-empty text`);
        }

        if (
          !Number.isSafeInteger(question.answer) ||
          !Array.isArray(question.options) ||
          question.answer < 0 ||
          question.answer >= question.options.length
        ) {
          errors.push(`${path}.answer must be a zero-based option index`);
        }
      } else if (question.type === 'match') {
        if (!Array.isArray(question.pairs) || question.pairs.length === 0) {
          errors.push(`${path}.pairs must contain at least one pair`);
          continue;
        }

        const pairIds = new Set();
        for (const [pairIndex, pair] of question.pairs.entries()) {
          const pairPath = `${path}.pairs[${pairIndex}]`;
          if (!isRecord(pair)) {
            errors.push(`${pairPath} must be an object`);
            continue;
          }
          if (!isNonEmptyText(pair.id)) {
            errors.push(`${pairPath}.id must be non-empty text`);
          } else if (pairIds.has(pair.id)) {
            errors.push(`${pairPath}.id duplicates pair id ${pair.id}`);
          } else {
            pairIds.add(pair.id);
          }
          if (!isNonEmptyText(pair.left)) errors.push(`${pairPath}.left must be non-empty text`);
          if (!isNonEmptyText(pair.right)) errors.push(`${pairPath}.right must be non-empty text`);
        }
      } else {
        errors.push(`${path}.type must be "choice" or "match"`);
      }
    }
  } catch {
    errors.push('bank contains unreadable data');
  }

  return { valid: errors.length === 0, errors };
}

export function questionsForSession(questions, ageGroup, subject, type) {
  if (!Array.isArray(questions)) return [];
  return questions.filter(
    (question) =>
      question &&
      question.ageGroup === ageGroup &&
      question.subject === subject &&
      (type === undefined || question.type === type),
  );
}

function normalizeSearchText(value) {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/\s*\/\s*/g, '/');
}

function containsFraction(text, query) {
  let index = text.indexOf(query);
  while (index !== -1) {
    const before = text[index - 1] ?? '';
    const after = text[index + query.length] ?? '';
    if (!/[\d/]/u.test(before) && !/[\d/]/u.test(after)) return true;
    index = text.indexOf(query, index + 1);
  }
  return false;
}

export function searchQuestions(questions, query, filters = {}) {
  if (!Array.isArray(questions) || typeof query !== 'string') return [];

  const normalizedQuery = normalizeSearchText(query.trim());
  const ageGroup = isRecord(filters) ? filters.ageGroup : undefined;
  const subject = isRecord(filters) ? filters.subject : undefined;
  const fractionQuery = /^\d+\/\d+$/u.test(normalizedQuery);

  return questions.filter((question) => {
    if (
      !question ||
      (ageGroup !== undefined && question.ageGroup !== ageGroup) ||
      (subject !== undefined && question.subject !== subject)
    )
      return false;
    if (!normalizedQuery) return true;

    const text = [
      question.question,
      question.explanation,
      ...(Array.isArray(question.options) ? question.options : []),
      ...(Array.isArray(question.pairs)
        ? question.pairs.flatMap((pair) => [pair?.left, pair?.right])
        : []),
    ]
      .filter((value) => typeof value === 'string')
      .map(normalizeSearchText);

    return text.some((value) =>
      fractionQuery ? containsFraction(value, normalizedQuery) : value.includes(normalizedQuery),
    );
  });
}

export function getAnswerLabel(question) {
  if (!question) return '';
  if (question.type === 'choice' && Array.isArray(question.options)) {
    return typeof question.options[question.answer] === 'string'
      ? question.options[question.answer]
      : '';
  }
  if (question.type === 'match' && Array.isArray(question.pairs)) {
    return question.pairs
      .filter(
        (pair) => isRecord(pair) && typeof pair.left === 'string' && typeof pair.right === 'string',
      )
      .map((pair) => `${pair.left} → ${pair.right}`)
      .join('、');
  }
  return '';
}

export function matchesPair(question, sourcePairId, targetPairId) {
  return (
    question?.type === 'match' &&
    Array.isArray(question.pairs) &&
    sourcePairId === targetPairId &&
    question.pairs.some((pair) => pair?.id === sourcePairId)
  );
}
