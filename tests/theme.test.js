// Тесты выбора темы: по умолчанию тёмная, выбор запоминается, строка состояния в цвет темы.
// Запуск из папки pwa: node --test
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../theme.js');

test('тема: по умолчанию тёмная', () => {
  assert.equal(T.DEFAULT, 'dark');
  assert.equal(T.MODES[0].id, 'dark', 'первая кнопка — «Тёмная»');
  // Ничего не выбрано или в памяти мусор — тёмная
  [null, undefined, '', 'blue', 'Dark', 'auto'].forEach(v => assert.equal(T.normalize(v), 'dark', String(v)));
});

test('тема: допустимые значения и подписи кнопок', () => {
  assert.deepEqual(T.MODES.map(m => m.id), ['dark', 'light', 'system']);
  assert.deepEqual(T.MODES.map(m => m.label), ['Тёмная', 'Светлая', 'Как в телефоне']);
  T.MODES.forEach(m => assert.equal(T.normalize(m.id), m.id));
});

test('тема: что на экране при каждом выборе', () => {
  assert.equal(T.effective('dark', false), 'dark', 'тёмная и на светлом телефоне');
  assert.equal(T.effective('light', true), 'light', 'светлая и на тёмном телефоне');
  assert.equal(T.effective('system', true), 'dark');
  assert.equal(T.effective('system', false), 'light');
});

test('тема: цвет строки состояния', () => {
  assert.deepEqual(T.barColors('dark'), { light: T.BAR.dark, dark: T.BAR.dark }, 'тёмная — тёмная строка при любой теме телефона');
  assert.deepEqual(T.barColors('light'), { light: T.BAR.light, dark: T.BAR.light });
  assert.deepEqual(T.barColors('system'), { light: T.BAR.light, dark: T.BAR.dark }, 'как в телефоне — как было до переключателя');
});

test('тема: без доступа к памяти — тёмная, без ошибок', () => {
  // В Node нет localStorage — как в браузере с запретом хранения
  assert.equal(T.read(), 'dark');
});
