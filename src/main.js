import { defaultBank } from './data/default-bank.js';
import { loadQuestionBank } from './state/local-store.js';
import { renderHomePage } from './ui/home-page.js';
import { renderStudyPage } from './ui/study-page.js';

const root = document.querySelector('#main-content');
const activeBank = loadQuestionBank(defaultBank);

if (!root) {
  throw new Error('The page is missing its application root.');
}

if (document.body.dataset.page === 'home') {
  renderHomePage(root, { defaultBank, initialBank: activeBank });
} else if (document.body.dataset.page === 'study') {
  renderStudyPage(root, { questionBank: activeBank });
} else {
  root.textContent = 'This page could not be opened.';
}
