import js from '@eslint/js';

const browserGlobals = {
  Blob: 'readonly',
  File: 'readonly',
  HTMLInputElement: 'readonly',
  Node: 'readonly',
  URL: 'readonly',
  URLSearchParams: 'readonly',
  cancelAnimationFrame: 'readonly',
  clearInterval: 'readonly',
  clearTimeout: 'readonly',
  document: 'readonly',
  localStorage: 'readonly',
  location: 'readonly',
  navigator: 'readonly',
  requestAnimationFrame: 'readonly',
  setInterval: 'readonly',
  setTimeout: 'readonly',
  window: 'readonly',
};

const nodeGlobals = {
  URL: 'readonly',
  process: 'readonly',
};

export default [
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**', '.npm-cache/**'],
  },
  js.configs.recommended,
  {
    files: ['src/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      globals: browserGlobals,
      sourceType: 'module',
    },
    rules: {
      'no-alert': 'error',
      'no-eval': 'error',
    },
  },
  {
    files: ['tests/**/*.js', 'vite.config.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      globals: nodeGlobals,
      sourceType: 'module',
    },
  },
  {
    files: ['eslint.config.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
  },
];
