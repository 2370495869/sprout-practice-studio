import { validateQuestionBank } from '../domain/question-bank.js';
import { loadQuestionBank, resetQuestionBank, saveQuestionBank } from '../state/local-store.js';
import { button, clear, element, makeBrand, makeStatus, setStatus, sproutImageUrl } from './dom.js';

const AGE_GROUPS = [
  { value: '3-5', title: '小萌芽', detail: '3–5 岁', icon: '🌱' },
  { value: '6-8', title: '小树苗', detail: '6–8 岁', icon: '🌿' },
  { value: '9-12', title: '小森林', detail: '9–12 岁', icon: '🌳' },
];

const SUBJECTS = [
  { value: 'math', title: '数学', detail: '数字与图形', icon: '＋' },
  { value: 'chinese', title: '语文', detail: '汉字与故事', icon: '文' },
  { value: 'english', title: '英语', detail: '单词与表达', icon: 'Aa' },
  { value: 'common', title: '综合常识', detail: '发现身边世界', icon: '✳' },
];

const MAX_IMPORT_BYTES = 2_000_000;

export function renderHomePage(root, { defaultBank, initialBank }) {
  clear(root);

  let selectedAge = '';
  let selectedSubject = '';
  let activeBank = initialBank ?? defaultBank;

  const page = element('div', { className: 'home-page' });
  const header = element('header', { className: 'site-header' });
  header.append(makeBrand());
  page.append(header);

  const hero = element('section', {
    className: 'home-hero',
    attrs: { 'aria-labelledby': 'home-title' },
  });
  const heroCopy = element('div', { className: 'home-hero__copy' });
  heroCopy.append(
    element('p', { className: 'eyebrow', text: 'LEARN AT YOUR OWN PACE' }),
    element('h1', { text: '好奇心，是最好的起点。', attrs: { id: 'home-title' } }),
    element('p', {
      text: '选一个适合你的学习主题，用轻松的小挑战，把每天的新发现一点点收集起来。',
    }),
  );
  hero.append(heroCopy);
  hero.append(
    element('div', {
      className: 'home-hero__art',
      attrs: { 'aria-hidden': 'true' },
      children: [element('img', { attrs: { src: sproutImageUrl, alt: '' } })],
    }),
  );
  page.append(hero);

  const setup = element('section', {
    className: 'card setup-card',
    attrs: { 'aria-labelledby': 'setup-title' },
  });
  const setupHeader = element('div', { className: 'section-heading' });
  setupHeader.append(
    element('span', { className: 'step-number', text: '01', attrs: { 'aria-hidden': 'true' } }),
    element('div', {
      children: [
        element('h2', { text: '为今天选一条学习路线', attrs: { id: 'setup-title' } }),
        element('p', { text: '先选年龄段，再选想探索的内容。' }),
      ],
    }),
  );

  const form = element('form', { className: 'setup-form', attrs: { id: 'learning-setup' } });
  const ageFieldset = makeChoiceGroup('age', '选择年龄段', AGE_GROUPS, 'choice-grid');
  const subjectFieldset = makeChoiceGroup(
    'subject',
    '选择学习内容',
    SUBJECTS,
    'choice-grid choice-grid--subjects',
  );
  subjectFieldset.disabled = true;

  const setupHint = element('p', {
    className: 'setup-hint',
    text: '先选择年龄段，接着挑选学习内容。',
    attrs: { id: 'setup-hint' },
  });
  const startButton = button('开始今天的练习　→', {
    className: 'button button--large',
    type: 'submit',
  });
  startButton.disabled = true;
  const setupActions = element('div', { className: 'setup-actions' });
  setupActions.append(setupHint, startButton);

  form.append(ageFieldset, subjectFieldset, setupActions);
  form.addEventListener('change', (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || input.type !== 'radio') return;

    if (input.name === 'age') {
      selectedAge = input.value;
      selectedSubject = '';
      subjectFieldset.disabled = !selectedAge;
      subjectFieldset.querySelectorAll('input[type="radio"]').forEach((radio) => {
        radio.checked = false;
      });
    } else if (input.name === 'subject') {
      selectedSubject = input.value;
    }

    startButton.disabled = !(selectedAge && selectedSubject);
    setupHint.textContent =
      selectedAge && selectedSubject
        ? `已选 ${labelFor(AGE_GROUPS, selectedAge)} · ${labelFor(SUBJECTS, selectedSubject)}，准备好就开始吧。`
        : selectedAge
          ? '年龄段选好了，再挑一个学习内容。'
          : '先选择年龄段，接着挑选学习内容。';
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (
      !AGE_GROUPS.some((item) => item.value === selectedAge) ||
      !SUBJECTS.some((item) => item.value === selectedSubject)
    )
      return;

    const params = new URLSearchParams({ age: selectedAge, subject: selectedSubject });
    window.location.assign(`learn.html?${params.toString()}`);
  });

  setup.append(setupHeader, form);
  page.append(setup);

  const library = makeLibraryCard(activeBank, defaultBank, (updatedBank) => {
    activeBank = updatedBank;
    updateBankMeta(libraryMeta, activeBank, defaultBank);
  });
  const libraryMeta = library.querySelector('.bank-meta');
  page.append(library);
  root.append(page);
}

function makeChoiceGroup(name, legendText, choices, gridClass) {
  const fieldset = element('fieldset', { className: 'selection-group' });
  fieldset.append(element('legend', { text: legendText }));
  const grid = element('div', { className: gridClass });

  for (const choice of choices) {
    const input = element('input', {
      attrs: { type: 'radio', name, value: choice.value, required: true },
    });
    const surface = element('span', { className: 'choice-card__surface' });
    surface.append(
      element('span', {
        className: 'choice-card__icon',
        text: choice.icon,
        attrs: { 'aria-hidden': 'true' },
      }),
      element('span', { className: 'choice-card__title', text: choice.title }),
      element('span', { className: 'choice-card__detail', text: choice.detail }),
    );
    const label = element('label', { className: 'choice-option' });
    label.append(input, surface);
    grid.append(label);
  }

  fieldset.append(grid);
  return fieldset;
}

function labelFor(items, value) {
  return items.find((item) => item.value === value)?.title ?? '';
}

function makeLibraryCard(activeBank, defaultBank, onBankChange) {
  let currentBank = activeBank;
  const section = element('section', {
    className: 'card library-card',
    attrs: { 'aria-labelledby': 'library-title' },
  });
  const copy = element('div', { className: 'library-copy' });
  copy.append(
    element('p', { className: 'eyebrow', text: 'YOUR QUESTION LIBRARY' }),
    element('h2', { text: '练习题库', attrs: { id: 'library-title' } }),
    element('p', { text: '导入或导出 JSON 题库。内容只保存在这台设备的浏览器中。' }),
  );

  const actions = element('div', { className: 'library-actions' });
  const fileInput = element('input', {
    className: 'visually-hidden',
    attrs: {
      type: 'file',
      accept: '.json,application/json',
      'aria-label': '选择要导入的 JSON 题库',
    },
  });
  const uploadLabel = element('label', { className: 'upload-control' });
  uploadLabel.append(
    element('span', { className: 'button button--light', text: '导入题库' }),
    fileInput,
  );

  const exportButton = button('导出题库', { className: 'button button--light' });
  const resetButton = button('恢复默认', { className: 'button button--danger' });
  const resetDialog = element('dialog', {
    className: 'confirm-dialog',
    attrs: { 'aria-labelledby': 'reset-dialog-title', 'aria-describedby': 'reset-dialog-copy' },
  });
  const resetForm = element('form', {
    className: 'confirm-dialog__content',
    attrs: { method: 'dialog' },
  });
  resetForm.append(
    element('h2', { text: '恢复默认题库？', attrs: { id: 'reset-dialog-title' } }),
    element('p', { text: '已导入的本地题库会被清除。', attrs: { id: 'reset-dialog-copy' } }),
  );
  const resetChoices = element('div', { className: 'confirm-dialog__actions' });
  resetChoices.append(
    button('保留当前题库', {
      className: 'button button--light',
      type: 'submit',
      attrs: { value: 'cancel', autofocus: true },
    }),
    button('恢复默认', {
      className: 'button button--danger',
      type: 'submit',
      attrs: { value: 'confirm' },
    }),
  );
  resetForm.append(resetChoices);
  resetDialog.append(resetForm);
  actions.append(uploadLabel, exportButton, resetButton);

  const status = makeStatus('status-message');
  status.classList.add('library-status');
  const statusWrap = element('div', { className: 'library-status-wrap' });
  statusWrap.append(status);

  const meta = element('div', { className: 'bank-meta', attrs: { id: 'bank-meta' } });
  updateBankMeta(meta, activeBank, defaultBank);

  fileInput.addEventListener('change', async () => {
    const [file] = fileInput.files ?? [];
    fileInput.value = '';
    if (!file) return;
    if (file.size > MAX_IMPORT_BYTES) {
      setStatus(status, '这个文件太大了。请选择小于 2 MB 的 JSON 题库。', 'error');
      return;
    }

    try {
      const importedBank = JSON.parse(await file.text());
      const validation = validateQuestionBank(importedBank);
      if (!validation.valid) {
        const details = validation.errors.slice(0, 4).join('；');
        setStatus(status, `题库格式需要检查：${details}`, 'error');
        return;
      }

      const result = saveQuestionBank(importedBank);
      if (!result.saved) {
        setStatus(status, '题库没有保存，请检查文件格式后再试。', 'error');
        return;
      }

      currentBank = importedBank;
      onBankChange(currentBank);
      setStatus(
        status,
        result.persistent
          ? '题库已导入，并保存在这台设备的浏览器中。'
          : '题库已导入到当前页面；浏览器暂时无法保存更改。',
        'success',
      );
    } catch {
      setStatus(status, '无法读取这个文件。请选择有效的 UTF-8 JSON 题库。', 'error');
    }
  });

  exportButton.addEventListener('click', () => {
    if (!currentBank) {
      setStatus(status, '当前没有可导出的题库。', 'error');
      return;
    }
    const blob = new Blob([`${JSON.stringify(currentBank, null, 2)}\n`], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const download = element('a', {
      attrs: { href: url, download: 'sprout-practice-question-bank.json' },
    });
    document.body.append(download);
    download.click();
    download.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatus(status, '题库文件已准备好下载。', 'success');
  });

  resetButton.addEventListener('click', () => {
    resetDialog.showModal();
  });

  resetDialog.addEventListener('close', () => {
    if (resetDialog.returnValue !== 'confirm') return;
    const result = resetQuestionBank();
    const restored = loadQuestionBank(defaultBank);
    if (!restored) {
      setStatus(status, '默认题库暂时无法读取。', 'error');
      return;
    }
    currentBank = restored;
    onBankChange(currentBank);
    setStatus(
      status,
      result.persistent ? '已恢复默认题库。' : '当前页面已恢复默认题库；浏览器暂时无法保存更改。',
      'success',
    );
  });

  section.append(copy, actions, statusWrap, meta, resetDialog);
  return section;
}

function updateBankMeta(meta, activeBank, defaultBank) {
  clear(meta);
  if (!activeBank) {
    meta.append(element('span', { text: '题库暂时无法读取。' }));
    return;
  }
  const isDefault = activeBank === defaultBank;
  const questions = Array.isArray(activeBank.questions) ? activeBank.questions : [];
  const choiceCount = questions.filter((question) => question?.type === 'choice').length;
  const matchCount = questions.filter((question) => question?.type === 'match').length;
  meta.append(
    element('span', { className: 'bank-meta__tag', text: isDefault ? '默认题库' : '本地题库' }),
    element('strong', { text: activeBank.title || '未命名题库' }),
    element('span', { text: `${questions.length} 道练习` }),
    element('span', { text: `${choiceCount} 道选择 · ${matchCount} 道配对` }),
  );
}
