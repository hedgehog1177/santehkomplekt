// Тесты пин-кода: формат, когда запирать, пауза после неверных попыток, отпечаток пина.
// Запуск из папки pwa: node --test
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../core.js');

const MIN = 60 * 1000;

test('пин: формат — ровно 4 цифры', () => {
  ['1234', '0000', '9087'].forEach(p => assert.ok(C.isPin(p), p));
  ['', '123', '12345', '12a4', ' 1234', '12.3', null].forEach(p => assert.ok(!C.isPin(p), String(p)));
});

test('пин: когда запирать при запуске', () => {
  const now = 1e12;
  assert.equal(C.pinLockedOnStart({ hasPin: false, unlocked: false, hiddenAt: null, now }), false, 'пин выключен — не запираем');
  assert.equal(C.pinLockedOnStart({ hasPin: true, unlocked: false, hiddenAt: null, now }), true, 'новый запуск — пин');
  assert.equal(C.pinLockedOnStart({ hasPin: true, unlocked: true, hiddenAt: null, now }), false, 'перезагрузка в том же сеансе (обновление) — без пина');
  assert.equal(C.pinLockedOnStart({ hasPin: true, unlocked: true, hiddenAt: now - 5 * MIN, now }), false);
  assert.equal(C.pinLockedOnStart({ hasPin: true, unlocked: true, hiddenAt: now - 11 * MIN, now }), true, 'свернули надолго — пин');
});

test('пин: возврат из фона — граница 10 минут', () => {
  const now = 1e12;
  assert.equal(C.PIN_LOCK_AFTER, 10 * MIN);
  assert.equal(C.pinLockedOnReturn(null, now), false);
  assert.equal(C.pinLockedOnReturn(now - 30 * 1000, now), false, 'на полминуты в мессенджер — без пина');
  assert.equal(C.pinLockedOnReturn(now - (10 * MIN - 1), now), false);
  assert.equal(C.pinLockedOnReturn(now - 10 * MIN, now), true);
});

test('пин: пауза после 5 неверных попыток', () => {
  const now = 1e12;
  let t = null;
  for (let i = 1; i < 5; i++) { t = C.pinFail(t, now); assert.equal(t.fails, i); assert.equal(C.pinWait(t, now), 0, 'до пятой — можно вводить'); }
  t = C.pinFail(t, now);
  assert.equal(t.fails, 0, 'на пятой счётчик с нуля');
  assert.equal(C.pinWait(t, now), 30, 'и пауза 30 секунд');
  assert.equal(C.pinWait(t, now + 29.5 * 1000), 1);
  assert.equal(C.pinWait(t, now + 30 * 1000), 0, 'после паузы снова можно');
  assert.equal(C.pinWait(null, now), 0);
});

test('пин: отпечаток — проверка верного и неверного, сам пин не хранится', async () => {
  const rec = await C.makePinRecord('2580', 'test-salt');
  assert.deepEqual(Object.keys(rec).sort(), ['hash', 'salt', 'v']);
  assert.ok(!JSON.stringify(rec).includes('2580'), 'в записи нет самого пина');
  assert.equal(rec.hash.length, 64);
  assert.equal(await C.checkPin('2580', rec), true);
  assert.equal(await C.checkPin('2581', rec), false);
  assert.equal(await C.checkPin('258', rec), false, 'неполный — нет');
  assert.equal(await C.checkPin('2580', null), false, 'нет записи — нет');
  // Одинаковый пин с разной солью — разные отпечатки
  const a = await C.makePinRecord('2580'), b = await C.makePinRecord('2580');
  assert.notEqual(a.salt, b.salt);
  assert.notEqual(a.hash, b.hash);
  assert.equal(await C.checkPin('2580', a), true);
});
