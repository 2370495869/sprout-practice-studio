import bundledBank from '../../data/questions.json' with { type: 'json' };

function freezeRecursively(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freezeRecursively);
    Object.freeze(value);
  }
  return value;
}

export const defaultBank = freezeRecursively(bundledBank);
export default defaultBank;
