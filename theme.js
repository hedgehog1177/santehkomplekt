// Тема оформления: «Тёмная» (по умолчанию), «Светлая» или «Как в телефоне».
// Подключается в <head> сразу после meta theme-color и до показа страницы — чтобы приложение
// и справка открывались сразу в выбранной теме, без мигания. Выбор хранится в localStorage
// (он есть и в браузере, и во встроенном браузере Android-приложения).
// В браузере доступно как window.SantehTheme, в Node — через require('./theme.js') (для тестов).
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.SantehTheme = api; api.apply(api.read()); }
})(typeof self !== 'undefined' ? self : this, function () {
'use strict';
const KEY = 'santeh.theme';
const DEFAULT = 'dark';
// Порядок — как кнопки в окне «Объекты»
const MODES = [
  { id: 'dark', label: 'Тёмная' },
  { id: 'light', label: 'Светлая' },
  { id: 'system', label: 'Как в телефоне' },
];
// Цвет строки состояния для светлой и тёмной темы — как в <meta name="theme-color">
const BAR = { light: '#0d5f80', dark: '#16222a' };

const normalize = v => (MODES.some(m => m.id === v) ? v : DEFAULT);
// Какая тема на экране: при «Как в телефоне» — по настройке телефона
const effective = (mode, systemDark) => (mode === 'system' ? (systemDark ? 'dark' : 'light') : mode);
// Цвета для двух meta theme-color (одна для светлой темы телефона, другая для тёмной).
// При выбранной теме обе получают её цвет, при «Как в телефоне» — каждая свой
const barColors = mode => (mode === 'system' ? { light: BAR.light, dark: BAR.dark } : { light: BAR[mode], dark: BAR[mode] });

function read() {
  try { return normalize(localStorage.getItem(KEY)); } catch (e) { return DEFAULT; }
}
function apply(mode) {
  const el = document.documentElement;
  if (mode === 'system') el.removeAttribute('data-theme'); else el.setAttribute('data-theme', mode);
  const c = barColors(mode);
  document.querySelectorAll('meta[name="theme-color"]').forEach(m => {
    m.setAttribute('content', /dark/.test(m.getAttribute('media') || '') ? c.dark : c.light);
  });
}
function set(mode) {
  const m = normalize(mode);
  try { localStorage.setItem(KEY, m); } catch (e) { /* не сохранится, но на экране применится */ }
  apply(m);
  return m;
}

return { KEY, DEFAULT, MODES, BAR, normalize, effective, barColors, read, apply, set };
});
