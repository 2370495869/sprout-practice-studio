import {
  getAnswerLabel,
  matchesPair,
  questionsForSession,
  searchQuestions,
} from '../domain/question-bank.js';
import { scoreChoice, shuffle } from '../domain/scoring.js';
import { getChallengeBest, saveChallengeBest } from '../state/local-store.js';
import { button, clear, element, makeBrand, makeStatus, setStatus } from './dom.js';

const AGE_GROUPS = new Set(['3-5', '6-8', '9-12']);
const SUBJECTS = new Map([
  ['math', '数学'],
  ['chinese', '语文'],
  ['english', '英语'],
  ['common', '综合常识'],
]);
const SUBJECT_TITLES = new Map([
  ['math', '数学小径'],
  ['chinese', '语文花园'],
  ['english', '英语探索'],
  ['common', '常识发现'],
]);
const QUIZ_SECONDS = 10;
const CHALLENGE_SECONDS = 30;

export function renderStudyPage(root, { questionBank }) {
  const params = new URLSearchParams(window.location.search);
  const ageGroup = params.get('age');
  const subject = params.get('subject');
  if (!AGE_GROUPS.has(ageGroup) || !SUBJECTS.has(subject)) {
    renderInvalidLink(root);
    return;
  }
  if (!questionBank || !Array.isArray(questionBank.questions)) {
    renderInvalidLink(root, '题库暂时无法读取，请回到首页重试。');
    return;
  }

  const sessionQuestions = questionsForSession(questionBank.questions, ageGroup, subject);
  const quizQuestions = questionsForSession(questionBank.questions, ageGroup, subject, 'choice');
  const matchQuestions = questionsForSession(questionBank.questions, ageGroup, subject, 'match');
  const title = SUBJECT_TITLES.get(subject);

  let score = 0;
  let quizStreak = 0;
  let activeTab = '';
  let quizIndex = 0;
  let quizRetries = 0;
  let quizRemaining = QUIZ_SECONDS;
  let quizLocked = false;
  let quizTimer = null;
  let matchIndex = 0;
  let currentMatchQuestion = null;
  let matchedPairIds = new Set();
  let matchTargetOrder = [];
  let selectedSourceId = null;
  let matchAwarded = false;
  let searchQuery = '';
  let searchCurrentOnly = true;

  const challenge = {
    active: false,
    advanceTimer: null,
    best: getChallengeBest(ageGroup, subject),
    consecutiveCorrect: 0,
    finished: false,
    index: 0,
    pendingAdvance: false,
    questions: [],
    score: 0,
    newRecord: false,
    secondsLeft: CHALLENGE_SECONDS,
    started: false,
    timer: null,
  };

  clear(root);
  const shell = element('div', { className: 'study-shell' });
  const siteHeader = element('header', { className: 'site-header' });
  siteHeader.append(
    makeBrand(),
    element('a', {
      className: 'button button--light back-link',
      text: '← 返回首页',
      attrs: { href: 'index.html' },
    }),
  );

  const studyHeader = element('section', {
    className: 'study-header',
    attrs: { 'aria-labelledby': 'study-title' },
  });
  const titleGroup = element('div', { className: 'study-title-group' });
  const titleText = element('h1', { text: title, attrs: { id: 'study-title' } });
  titleGroup.append(titleText);
  const scoreValue = element('span', {
    className: 'score-pill__value',
    text: '0',
    attrs: { id: 'study-score' },
  });
  const scorePill = element('output', {
    className: 'score-pill',
    attrs: { 'aria-label': '本次练习得分', 'aria-live': 'polite', 'aria-atomic': 'true' },
  });
  scorePill.append(
    element('span', { text: '★', attrs: { 'aria-hidden': 'true' } }),
    scoreValue,
    element('span', { text: '分' }),
  );
  studyHeader.append(titleGroup, scorePill);

  const subjectCaption = element('p', {
    className: 'subject-caption',
    text: `${ageGroup} 岁 · ${SUBJECTS.get(subject)} · ${questionBank.title}`,
  });

  const tabs = [
    { id: 'quiz', icon: '✎', title: '看题作答' },
    { id: 'match', icon: '↔', title: '配对练习' },
    { id: 'challenge', icon: '◷', title: '限时挑战' },
    { id: 'search', icon: '⌕', title: '知识搜索' },
  ];
  const tabList = element('div', {
    className: 'tab-list',
    attrs: { role: 'tablist', 'aria-label': '学习活动', 'aria-orientation': 'horizontal' },
  });
  const tabButtons = new Map();
  const tabPanels = new Map();

  for (const tab of tabs) {
    const tabButton = element('button', {
      className: 'tab-button',
      attrs: {
        type: 'button',
        id: `${tab.id}-tab`,
        role: 'tab',
        'aria-controls': `${tab.id}-panel`,
        'aria-selected': 'false',
        tabindex: '-1',
      },
    });
    tabButton.append(
      element('span', {
        className: 'tab-button__icon',
        text: tab.icon,
        attrs: { 'aria-hidden': 'true' },
      }),
      element('span', { text: tab.title }),
    );
    tabButton.addEventListener('click', () => activateTab(tab.id));
    tabButton.addEventListener('keydown', (event) => handleTabKeydown(event, tab.id));
    tabButtons.set(tab.id, tabButton);
    tabList.append(tabButton);

    const panel = element('section', {
      className: 'card tab-panel',
      attrs: {
        id: `${tab.id}-panel`,
        role: 'tabpanel',
        'aria-labelledby': `${tab.id}-tab`,
        tabindex: '0',
        hidden: true,
      },
    });
    tabPanels.set(tab.id, panel);
  }

  shell.append(siteHeader, studyHeader, subjectCaption, tabList);
  for (const tab of tabs) shell.append(tabPanels.get(tab.id));
  root.append(shell);

  function updateScore(nextPoints) {
    score += nextPoints;
    scoreValue.textContent = String(score);
  }

  function stopQuizTimer() {
    if (quizTimer !== null) {
      window.clearInterval(quizTimer);
      quizTimer = null;
    }
  }

  function pauseChallenge() {
    if (challenge.timer !== null) {
      window.clearInterval(challenge.timer);
      challenge.timer = null;
    }
    if (challenge.advanceTimer !== null) {
      window.clearTimeout(challenge.advanceTimer);
      challenge.advanceTimer = null;
    }
    if (challenge.pendingAdvance) {
      challenge.index += 1;
      challenge.pendingAdvance = false;
    }
    challenge.active = false;
  }

  function cleanupTab(tab) {
    if (tab === 'quiz') stopQuizTimer();
    if (tab === 'challenge' && challenge.active) pauseChallenge();
  }

  function cleanupAll() {
    stopQuizTimer();
    if (challenge.timer !== null) window.clearInterval(challenge.timer);
    if (challenge.advanceTimer !== null) window.clearTimeout(challenge.advanceTimer);
    challenge.timer = null;
    challenge.advanceTimer = null;
    challenge.active = false;
  }

  function activateTab(tabId, { moveFocus = false } = {}) {
    if (!tabPanels.has(tabId) || tabId === activeTab) {
      if (moveFocus) tabButtons.get(tabId)?.focus();
      return;
    }
    cleanupTab(activeTab);
    activeTab = tabId;

    for (const [id, tabButton] of tabButtons) {
      const selected = id === tabId;
      tabButton.setAttribute('aria-selected', String(selected));
      tabButton.tabIndex = selected ? 0 : -1;
      tabPanels.get(id).hidden = !selected;
    }

    if (tabId === 'quiz') renderQuizPanel();
    else if (tabId === 'match') renderMatchPanel();
    else if (tabId === 'challenge') renderChallengePanel();
    else renderSearchPanel();

    if (moveFocus) tabButtons.get(tabId).focus();
  }

  function handleTabKeydown(event, currentId) {
    const index = tabs.findIndex((tab) => tab.id === currentId);
    let nextIndex;
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') nextIndex = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = tabs.length - 1;
    else return;
    event.preventDefault();
    activateTab(tabs[nextIndex].id, { moveFocus: true });
  }

  function panelHeading(tabId, heading, description) {
    const block = element('div', { className: 'panel-heading' });
    block.append(
      element('div', {
        children: [element('h2', { text: heading }), element('p', { text: description })],
      }),
    );
    const index = tabs.findIndex((tab) => tab.id === tabId);
    block.append(
      element('span', {
        className: 'panel-kicker',
        text: `${String(index + 1).padStart(2, '0')} / 04`,
      }),
    );
    return block;
  }

  function showEmpty(panel, heading, description) {
    const state = element('div', { className: 'empty-state' });
    state.append(element('span', { className: 'question-count', text: '小芽提示' }));
    state.append(element('h3', { text: heading }), element('p', { text: description }));
    panel.append(state);
  }

  function renderQuizPanel({ focusQuestion = false } = {}) {
    const panel = tabPanels.get('quiz');
    clear(panel);
    panel.append(panelHeading('quiz', '看题作答', '选出你认为正确的答案，答题后可以查看解析。'));
    if (quizQuestions.length === 0) {
      showEmpty(
        panel,
        '这里还没有选择题',
        '可以从首页导入一份包含本年龄段和学科练习的题库。也可以先试试配对练习或知识搜索。',
      );
      return;
    }

    if (quizIndex >= quizQuestions.length) {
      const done = element('div', { className: 'activity-card challenge-result' });
      done.append(
        element('span', {
          className: 'challenge-intro__icon',
          text: '✓',
          attrs: { 'aria-hidden': 'true' },
        }),
        element('h3', { text: '这一轮完成啦' }),
        element('p', { text: '慢慢练习，也是在进步。准备好后可以再来一轮。' }),
        element('p', { className: 'challenge-result__score', text: `${score} 分` }),
      );
      done.append(
        button('再练一轮', {
          className: 'button',
          onClick: () => {
            quizIndex = 0;
            quizStreak = 0;
            quizRetries = 0;
            quizRemaining = QUIZ_SECONDS;
            quizLocked = false;
            renderQuizPanel({ focusQuestion: true });
          },
        }),
      );
      panel.append(done);
      return;
    }

    const question = quizQuestions[quizIndex];
    const card = element('div', { className: 'activity-card' });
    const toolbar = element('div', { className: 'question-toolbar' });
    toolbar.append(
      element('span', {
        className: 'question-count',
        text: `第 ${quizIndex + 1} / ${quizQuestions.length} 题`,
      }),
      element('span', {
        className: 'timer-chip',
        attrs: { id: 'quiz-timer', role: 'timer', 'aria-live': 'off' },
      }),
    );
    const prompt = element('p', {
      className: 'question-prompt',
      text: question.question,
      attrs: { tabindex: '-1' },
    });
    const feedback = makeStatus('feedback');
    feedback.id = 'quiz-feedback';
    const options = element('div', {
      className: 'option-list',
      attrs: { role: 'group', 'aria-label': '答案选项' },
    });
    const optionButtons = [];

    question.options.forEach((optionText, index) => {
      const optionButton = element('button', {
        className: 'option-button',
        attrs: { type: 'button', 'aria-describedby': feedback.id },
      });
      optionButton.append(
        element('span', {
          className: 'option-letter',
          text: String.fromCharCode(65 + index),
          attrs: { 'aria-hidden': 'true' },
        }),
        element('span', { text: optionText }),
      );
      optionButton.addEventListener('click', () => {
        if (quizLocked) return;
        if (index !== question.answer) {
          quizRetries += 1;
          quizStreak = 0;
          optionButton.disabled = true;
          optionButton.dataset.state = 'wrong';
          setStatus(feedback, '还不对，再看看其他选项。', 'error');
          return;
        }

        quizLocked = true;
        stopQuizTimer();
        optionButton.dataset.state = 'correct';
        optionButtons.forEach((item) => {
          item.disabled = true;
        });
        const result = scoreChoice({
          correct: true,
          retries: quizRetries,
          consecutiveCorrect: quizStreak,
        });
        quizStreak = result.consecutiveCorrect;
        updateScore(result.total);
        const earned =
          result.bonus > 0
            ? `答对了！获得 ${result.points} 分，连续答对奖励 ${result.bonus} 分。`
            : `答对了！获得 ${result.points} 分。`;
        setStatus(feedback, earned, 'success');
        card.append(
          element('p', { className: 'question-explanation', text: question.explanation }),
        );
        const actions = element('div', { className: 'activity-actions' });
        actions.append(
          button(quizIndex + 1 === quizQuestions.length ? '完成这一轮' : '下一题 →', {
            onClick: () => {
              quizIndex += 1;
              quizRetries = 0;
              quizRemaining = QUIZ_SECONDS;
              quizLocked = false;
              renderQuizPanel({ focusQuestion: true });
            },
          }),
        );
        card.append(actions);
      });
      optionButtons.push(optionButton);
      options.append(optionButton);
    });

    card.append(toolbar, prompt, options, feedback);
    panel.append(card);
    if (focusQuestion) prompt.focus();
    if (!quizLocked) startQuizTimer();
  }

  function startQuizTimer() {
    stopQuizTimer();
    const timerElement = tabPanels.get('quiz').querySelector('#quiz-timer');
    if (!timerElement || quizLocked) return;
    const update = () => {
      timerElement.textContent = `◷ ${quizRemaining} 秒`;
      timerElement.setAttribute('aria-label', `剩余 ${quizRemaining} 秒`);
      timerElement.dataset.urgent = String(quizRemaining <= 3);
    };
    update();
    if (quizRemaining <= 0) {
      onQuizTimeout();
      return;
    }
    quizTimer = window.setInterval(() => {
      quizRemaining = Math.max(0, quizRemaining - 1);
      update();
      if (quizRemaining === 0) onQuizTimeout();
    }, 1000);
  }

  function onQuizTimeout() {
    stopQuizTimer();
    if (quizLocked || quizIndex >= quizQuestions.length) return;
    quizLocked = true;
    quizStreak = 0;
    const question = quizQuestions[quizIndex];
    const panel = tabPanels.get('quiz');
    panel.querySelectorAll('.option-button').forEach((optionButton, index) => {
      optionButton.disabled = true;
      if (index === question.answer) optionButton.dataset.state = 'correct';
    });
    const feedback = panel.querySelector('#quiz-feedback');
    setStatus(feedback, `时间到啦。正确答案是：${question.options[question.answer]}`, 'error');
    const card = panel.querySelector('.activity-card');
    card.append(element('p', { className: 'question-explanation', text: question.explanation }));
    const actions = element('div', { className: 'activity-actions' });
    actions.append(
      button(quizIndex + 1 === quizQuestions.length ? '完成这一轮' : '下一题 →', {
        onClick: () => {
          quizIndex += 1;
          quizRetries = 0;
          quizRemaining = QUIZ_SECONDS;
          quizLocked = false;
          renderQuizPanel({ focusQuestion: true });
        },
      }),
    );
    card.append(actions);
  }

  function ensureMatchQuestion() {
    const question = matchQuestions[matchIndex];
    if (question !== currentMatchQuestion) {
      currentMatchQuestion = question;
      matchedPairIds = new Set();
      selectedSourceId = null;
      matchTargetOrder = shuffle(question?.pairs ?? []);
      matchAwarded = false;
    }
    return question;
  }

  function renderMatchPanel({ focusId = null, focusSide = 'source' } = {}) {
    const panel = tabPanels.get('match');
    clear(panel);
    panel.append(panelHeading('match', '配对练习', '点选左边的内容，再点选右边与它对应的一项。'));
    if (matchQuestions.length === 0) {
      showEmpty(
        panel,
        '这里还没有配对题',
        '可以从首页导入一份包含配对练习的题库。选择题和知识搜索仍然可以使用。',
      );
      return;
    }
    if (matchIndex >= matchQuestions.length) {
      const done = element('div', { className: 'activity-card challenge-result' });
      done.append(
        element('span', {
          className: 'challenge-intro__icon',
          text: '↔',
          attrs: { 'aria-hidden': 'true' },
        }),
        element('h3', { text: '所有配对都完成啦' }),
        element('p', { text: '再来一轮，看看能不能配得更快。' }),
        element('p', { className: 'challenge-result__score', text: `${score} 分` }),
      );
      done.append(
        button('再练一轮', {
          onClick: () => {
            matchIndex = 0;
            currentMatchQuestion = null;
            renderMatchPanel();
          },
        }),
      );
      panel.append(done);
      return;
    }

    const question = ensureMatchQuestion();
    const card = element('div', { className: 'activity-card' });
    card.append(
      element('span', {
        className: 'question-count',
        text: `第 ${matchIndex + 1} / ${matchQuestions.length} 题`,
      }),
      element('p', {
        className: 'question-prompt',
        text: question.question,
        attrs: { tabindex: '-1' },
      }),
      element('p', {
        className: 'match-instructions',
        text: '键盘或触屏都可以：选择左侧一项，再选择右侧对应内容。',
      }),
    );

    const feedback = makeStatus('feedback');
    feedback.id = 'match-feedback';
    const board = element('div', { className: 'match-board' });
    const sourceColumn = element('div', {
      className: 'match-column',
      attrs: { 'aria-label': '待配对内容' },
    });
    sourceColumn.append(element('h3', { text: '内容' }));
    const targetColumn = element('div', {
      className: 'match-column',
      attrs: { 'aria-label': '对应内容' },
    });
    targetColumn.append(element('h3', { text: '配对' }));

    for (const pair of question.pairs) {
      sourceColumn.append(
        makePairChoice(pair, 'left', {
          pressed: pair.id === selectedSourceId,
          matched: matchedPairIds.has(pair.id),
          onClick: () => {
            if (matchedPairIds.has(pair.id)) return;
            selectedSourceId = selectedSourceId === pair.id ? null : pair.id;
            renderMatchPanel({ focusId: pair.id, focusSide: 'source' });
            const currentFeedback = tabPanels.get('match').querySelector('#match-feedback');
            setStatus(
              currentFeedback,
              selectedSourceId ? `已选“${pair.left}”，现在选右侧的对应内容。` : '已取消选择。',
              'neutral',
            );
          },
        }),
      );
    }
    for (const pair of matchTargetOrder) {
      targetColumn.append(
        makePairChoice(pair, 'right', {
          pressed: false,
          matched: matchedPairIds.has(pair.id),
          onClick: () => {
            const feedbackNode = tabPanels.get('match').querySelector('#match-feedback');
            if (!selectedSourceId) {
              setStatus(feedbackNode, '先选左侧的一项，再来配对。', 'neutral');
              return;
            }
            const source = question.pairs.find((item) => item.id === selectedSourceId);
            if (matchesPair(question, selectedSourceId, pair.id)) {
              matchedPairIds.add(pair.id);
              selectedSourceId = null;
              if (matchedPairIds.size === question.pairs.length && !matchAwarded) {
                matchAwarded = true;
                updateScore(15);
                renderMatchPanel();
                const currentFeedback = tabPanels.get('match').querySelector('#match-feedback');
                setStatus(
                  currentFeedback,
                  `全部配对正确！获得 15 分。${question.explanation}`,
                  'success',
                );
                const currentCard = tabPanels.get('match').querySelector('.activity-card');
                currentCard.append(
                  button(matchIndex + 1 === matchQuestions.length ? '完成这一轮' : '下一题 →', {
                    onClick: () => {
                      matchIndex += 1;
                      currentMatchQuestion = null;
                      renderMatchPanel({
                        focusId: matchQuestions[matchIndex]?.pairs?.[0]?.id ?? null,
                      });
                    },
                  }),
                );
                return;
              }
              renderMatchPanel({
                focusId: question.pairs.find((item) => !matchedPairIds.has(item.id))?.id ?? null,
              });
              const currentFeedback = tabPanels.get('match').querySelector('#match-feedback');
              setStatus(
                currentFeedback,
                `配对成功：${source?.left ?? ''} ↔ ${pair.right}。`,
                'success',
              );
            } else {
              selectedSourceId = null;
              renderMatchPanel({ focusId: pair.id, focusSide: 'right' });
              const currentFeedback = tabPanels.get('match').querySelector('#match-feedback');
              setStatus(currentFeedback, '还不是这一组，再试试看。', 'error');
            }
          },
        }),
      );
    }

    board.append(sourceColumn, targetColumn);
    card.append(board, feedback);
    panel.append(card);
    focusPairChoice(panel, focusSide, focusId);
  }

  function makePairChoice(pair, side, { pressed, matched, onClick }) {
    const pairButton = button(side === 'left' ? pair.left : pair.right, {
      className: 'match-item',
      attrs: {
        'data-pair-id': pair.id,
        'data-side': side,
        'aria-pressed': String(pressed),
        'data-state': matched ? 'matched' : 'idle',
        'aria-label': matched
          ? `${side === 'left' ? pair.left : pair.right}，已完成配对`
          : side === 'left'
            ? `选择${pair.left}`
            : `选择${pair.right}`,
        disabled: matched,
      },
      onClick,
    });
    return pairButton;
  }

  function focusPairChoice(panel, side, pairId) {
    if (!pairId) return;
    for (const item of panel.querySelectorAll('.match-item')) {
      if (item.dataset.side === side && item.dataset.pairId === pairId) {
        item.focus();
        return;
      }
    }
  }

  function renderChallengePanel() {
    const panel = tabPanels.get('challenge');
    clear(panel);
    panel.append(panelHeading('challenge', '限时挑战', '看看 30 秒内能完成多少道小练习。'));
    if (sessionQuestions.length === 0) {
      showEmpty(
        panel,
        '这里还没有挑战题',
        '请从首页导入一份包含本年龄段和学科练习的题库。可以先试试知识搜索。',
      );
      return;
    }

    if (!challenge.started) {
      const intro = element('div', { className: 'activity-card challenge-intro' });
      intro.append(
        element('span', {
          className: 'challenge-intro__icon',
          text: '◷',
          attrs: { 'aria-hidden': 'true' },
        }),
        element('h3', { text: '准备好就开始吧' }),
        element('p', {
          text: '30 秒里尽量多答几题。选择题答错后会跳到下一题；配对题可以重新选择。',
        }),
        element('p', { className: 'panel-kicker', text: `最高纪录：${challenge.best} 分` }),
      );
      intro.append(
        button('开始挑战', {
          className: 'button button--large',
          onClick: startChallenge,
        }),
      );
      panel.append(intro);
      return;
    }

    if (challenge.finished) {
      const result = element('div', { className: 'activity-card challenge-result' });
      result.append(
        element('span', {
          className: 'challenge-intro__icon',
          text: '★',
          attrs: { 'aria-hidden': 'true' },
        }),
        element('h3', { text: challenge.newRecord ? '新纪录！' : '挑战完成' }),
        element('p', { className: 'challenge-result__score', text: `${challenge.score} 分` }),
        element('p', { text: `最高纪录：${challenge.best} 分` }),
      );
      result.append(button('再挑战一次', { onClick: startChallenge }));
      panel.append(result);
      return;
    }

    if (!challenge.active) {
      const paused = element('div', { className: 'activity-card challenge-intro' });
      paused.append(
        element('span', {
          className: 'challenge-intro__icon',
          text: 'Ⅱ',
          attrs: { 'aria-hidden': 'true' },
        }),
        element('h3', { text: '挑战已暂停' }),
        element('p', {
          text: `还有 ${challenge.secondsLeft} 秒，当前得分 ${challenge.score} 分。`,
        }),
      );
      paused.append(
        button('继续挑战', {
          onClick: () => {
            challenge.active = true;
            renderChallengePanel();
            startChallengeTimer();
          },
        }),
      );
      panel.append(paused);
      return;
    }

    const hud = element('div', { className: 'challenge-hud' });
    const timer = element('span', {
      className: 'timer-chip',
      attrs: { id: 'challenge-timer', role: 'timer', 'aria-live': 'off' },
    });
    timer.textContent = `◷ ${challenge.secondsLeft} 秒`;
    timer.setAttribute('aria-label', `剩余 ${challenge.secondsLeft} 秒`);
    hud.append(timer, element('strong', { text: `本轮得分：${challenge.score}` }));
    const pause = button('暂停', { className: 'button button--light' });
    pause.addEventListener('click', () => {
      pauseChallenge();
      renderChallengePanel();
    });
    hud.append(pause);
    panel.append(hud);

    const question = currentChallengeQuestion();
    if (!question) {
      showEmpty(panel, '当前题库没有可用题目', '请回到首页检查题库内容后再开始挑战。');
      return;
    }
    const card = element('div', { className: 'activity-card' });
    card.append(
      element('span', {
        className: 'question-count',
        text: `${question.type === 'choice' ? '选择题' : '配对题'} · 共用挑战倒计时`,
      }),
      element('p', { className: 'question-prompt', text: question.question }),
    );
    const feedback = makeStatus('feedback');
    feedback.id = 'challenge-feedback';
    if (question.type === 'choice') {
      const options = element('div', {
        className: 'option-list',
        attrs: { role: 'group', 'aria-label': '答案选项' },
      });
      question.options.forEach((optionText, index) => {
        const optionButton = button(optionText, {
          className: 'option-button',
          attrs: { 'aria-describedby': feedback.id },
        });
        optionButton.addEventListener('click', () => {
          if (!challenge.active || challenge.pendingAdvance) return;
          options.querySelectorAll('button').forEach((item) => {
            item.disabled = true;
          });
          if (index === question.answer) {
            optionButton.dataset.state = 'correct';
            const result = scoreChoice({
              correct: true,
              retries: 0,
              consecutiveCorrect: challenge.consecutiveCorrect,
            });
            challenge.consecutiveCorrect = result.consecutiveCorrect;
            challenge.score += result.total;
            setStatus(feedback, `答对了，获得 ${result.total} 分。`, 'success');
          } else {
            optionButton.dataset.state = 'wrong';
            const result = scoreChoice({
              correct: false,
              consecutiveCorrect: challenge.consecutiveCorrect,
            });
            challenge.consecutiveCorrect = result.consecutiveCorrect;
            setStatus(feedback, '答错啦，这题会跳过。', 'error');
          }
          scheduleChallengeAdvance(650);
        });
        options.append(optionButton);
      });
      card.append(options, feedback);
    } else {
      const challengePairs = getChallengeMatchState(question);
      card.append(
        element('p', {
          className: 'match-instructions',
          text: '选左边一项，再选右边的对应内容。答错可以重新配对。',
        }),
      );
      card.append(renderChallengeMatch(question, challengePairs, feedback));
      card.append(feedback);
    }
    panel.append(card);
    updateChallengeHud();
  }

  let challengeMatchQuestion = null;
  let challengeMatchedPairIds = new Set();
  let challengeSelectedSourceId = null;
  let challengeTargetOrder = [];

  function getChallengeMatchState(question) {
    if (challengeMatchQuestion !== question) {
      challengeMatchQuestion = question;
      challengeMatchedPairIds = new Set();
      challengeSelectedSourceId = null;
      challengeTargetOrder = shuffle(question.pairs);
    }
    return {
      matched: challengeMatchedPairIds,
      selectedSourceId: challengeSelectedSourceId,
      targets: challengeTargetOrder,
    };
  }

  function renderChallengeMatch(question, state, feedback) {
    const board = element('div', { className: 'match-board' });
    const left = element('div', { className: 'match-column' });
    left.append(element('h3', { text: '内容' }));
    const right = element('div', { className: 'match-column' });
    right.append(element('h3', { text: '配对' }));

    for (const pair of question.pairs) {
      left.append(
        makePairChoice(pair, 'left', {
          pressed: state.selectedSourceId === pair.id,
          matched: state.matched.has(pair.id),
          onClick: () => {
            if (state.matched.has(pair.id)) return;
            challengeSelectedSourceId = pair.id;
            renderChallengePanel();
          },
        }),
      );
    }
    for (const pair of state.targets) {
      right.append(
        makePairChoice(pair, 'right', {
          pressed: false,
          matched: state.matched.has(pair.id),
          onClick: () => {
            if (!challengeSelectedSourceId) {
              setStatus(feedback, '先选左侧的一项，再来配对。', 'neutral');
              return;
            }
            if (matchesPair(question, challengeSelectedSourceId, pair.id)) {
              challengeMatchedPairIds.add(pair.id);
              challengeSelectedSourceId = null;
              if (challengeMatchedPairIds.size === question.pairs.length) {
                challenge.score += 15;
                setStatus(feedback, `全部配对正确，获得 15 分。${question.explanation}`, 'success');
                scheduleChallengeAdvance(650);
              } else {
                renderChallengePanel();
                setStatus(
                  tabPanels.get('challenge').querySelector('#challenge-feedback'),
                  '配对成功，继续完成剩下的内容。',
                  'success',
                );
              }
            } else {
              challengeSelectedSourceId = null;
              renderChallengePanel();
              setStatus(
                tabPanels.get('challenge').querySelector('#challenge-feedback'),
                '还不是这一组，再试试看。',
                'error',
              );
            }
          },
        }),
      );
    }
    board.append(left, right);
    return board;
  }

  function currentChallengeQuestion() {
    if (challenge.questions.length === 0) return null;
    if (challenge.index >= challenge.questions.length) {
      challenge.questions = shuffle(sessionQuestions);
      challenge.index = 0;
    }
    return challenge.questions[challenge.index];
  }

  function startChallenge() {
    if (sessionQuestions.length === 0) return;
    challenge.questions = shuffle(sessionQuestions);
    challenge.index = 0;
    challenge.score = 0;
    challenge.newRecord = false;
    challenge.secondsLeft = CHALLENGE_SECONDS;
    challenge.consecutiveCorrect = 0;
    challenge.active = true;
    challenge.finished = false;
    challenge.started = true;
    challenge.pendingAdvance = false;
    challengeMatchQuestion = null;
    renderChallengePanel();
    startChallengeTimer();
  }

  function startChallengeTimer() {
    if (!challenge.active || challenge.timer !== null) return;
    updateChallengeHud();
    challenge.timer = window.setInterval(() => {
      challenge.secondsLeft = Math.max(0, challenge.secondsLeft - 1);
      updateChallengeHud();
      if (challenge.secondsLeft === 0) endChallenge();
    }, 1000);
  }

  function updateChallengeHud() {
    const panel = tabPanels.get('challenge');
    const timer = panel.querySelector('#challenge-timer');
    if (timer) {
      timer.textContent = `◷ ${challenge.secondsLeft} 秒`;
      timer.setAttribute('aria-label', `剩余 ${challenge.secondsLeft} 秒`);
      timer.dataset.urgent = String(challenge.secondsLeft <= 8);
    }
    const scoreText = panel.querySelector('.challenge-hud strong');
    if (scoreText) scoreText.textContent = `本轮得分：${challenge.score}`;
  }

  function scheduleChallengeAdvance(delay) {
    if (challenge.advanceTimer !== null) window.clearTimeout(challenge.advanceTimer);
    challenge.pendingAdvance = true;
    challenge.advanceTimer = window.setTimeout(() => {
      challenge.advanceTimer = null;
      challenge.pendingAdvance = false;
      challenge.index += 1;
      challengeMatchQuestion = null;
      challengeMatchedPairIds = new Set();
      challengeSelectedSourceId = null;
      if (challenge.active) renderChallengePanel();
    }, delay);
  }

  function endChallenge() {
    if (challenge.timer !== null) window.clearInterval(challenge.timer);
    if (challenge.advanceTimer !== null) window.clearTimeout(challenge.advanceTimer);
    challenge.timer = null;
    challenge.advanceTimer = null;
    challenge.pendingAdvance = false;
    challenge.active = false;
    challenge.finished = true;
    challenge.newRecord = challenge.score > challenge.best;
    challenge.best = saveChallengeBest(ageGroup, subject, challenge.score);
    renderChallengePanel();
  }

  function renderSearchPanel() {
    const panel = tabPanels.get('search');
    clear(panel);
    panel.append(panelHeading('search', '知识搜索', '在题库里查找词语、题目和解析。'));

    const form = element('form', { className: 'search-form' });
    const label = element('label', { className: 'field-label', text: '搜索题库' });
    const input = element('input', {
      className: 'text-input',
      attrs: {
        id: 'knowledge-search-input',
        type: 'search',
        name: 'query',
        placeholder: '例如：春晓、质数、apple',
        autocomplete: 'off',
        value: searchQuery,
        'aria-controls': 'knowledge-search-results',
      },
    });
    label.append(input);
    const submit = button('搜索', { className: 'button', type: 'submit' });
    form.append(label, submit);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      searchQuery = input.value;
      renderSearchResults();
    });

    const scopeLabel = element('label', { className: 'search-scope' });
    const scopeInput = element('input', {
      attrs: { type: 'checkbox', checked: searchCurrentOnly },
    });
    scopeInput.addEventListener('change', () => {
      searchCurrentOnly = scopeInput.checked;
      searchQuery = input.value;
      renderSearchResults();
    });
    scopeLabel.append(
      scopeInput,
      element('span', { text: `只搜当前范围（${SUBJECTS.get(subject)} · ${ageGroup} 岁）` }),
    );

    const status = makeStatus('search-summary');
    status.id = 'knowledge-search-status';
    const results = element('div', {
      className: 'search-results',
      attrs: { id: 'knowledge-search-results', 'aria-describedby': status.id },
    });
    panel.append(form, scopeLabel, status, results);

    function renderSearchResults() {
      const query = input.value.trim();
      searchQuery = input.value;
      clear(results);
      if (!query) {
        setStatus(status, '输入关键词后，这里会显示相关题目和答案解析。', 'neutral');
        return;
      }

      const filters = searchCurrentOnly ? { ageGroup, subject } : {};
      const matches = searchQuestions(questionBank.questions, query, filters);
      setStatus(status, `找到 ${matches.length} 条相关内容。`, 'neutral');
      if (matches.length === 0) {
        results.append(
          element('div', {
            className: 'empty-state',
            children: [
              element('h3', { text: '暂时没有找到' }),
              element('p', { text: '试试更短的关键词，或把搜索范围改成全部题库。' }),
            ],
          }),
        );
        return;
      }

      for (const question of matches) {
        const result = element('article', { className: 'search-result' });
        const tags = element('div', { className: 'result-tags' });
        tags.append(
          element('span', {
            className: 'result-tag',
            text: SUBJECTS.get(question.subject) ?? '学习',
          }),
          element('span', { className: 'result-tag', text: `${question.ageGroup} 岁` }),
          element('span', {
            className: 'result-tag',
            text: question.type === 'choice' ? '选择题' : '配对题',
          }),
        );
        result.append(
          tags,
          element('h3', { text: question.question }),
          element('p', { className: 'search-answer', text: `答案：${getAnswerLabel(question)}` }),
          element('p', { text: `解析：${question.explanation}` }),
        );
        results.append(result);
      }
    }

    input.addEventListener('input', renderSearchResults);
    renderSearchResults();
  }

  window.addEventListener('pagehide', cleanupAll, { once: true });
  activateTab('quiz');
}

function renderInvalidLink(
  target,
  message = '学习链接中的年龄段或学科不正确。请回到首页重新选择。',
) {
  clear(target);
  const section = element('section', { className: 'card invalid-link' });
  section.append(
    element('p', { className: 'eyebrow', text: 'LINK NEEDS A RESET' }),
    element('h1', { text: '这条学习链接暂时打不开' }),
    element('p', { text: message }),
    element('a', { className: 'button', text: '返回首页', attrs: { href: 'index.html' } }),
  );
  target.append(section);
}
