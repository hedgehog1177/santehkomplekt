// Тесты работ: свой прайс мастера, работы в объекте, текст для клиента.
// Запуск из папки pwa: node --test
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../core.js');

const NB = ' ';
const W = id => C.DEFAULT_WORKS.find(x => x.id === id);
const line = (work, qty, price, extra) => Object.assign(C.workEntry(work, price), { key: C.keyOf('w:' + work.id, ''), qty, note: '', at: 1 }, extra);

test('прайс работ: стартовый список', () => {
  const ids = C.DEFAULT_WORKS.map(x => x.id);
  assert.equal(new Set(ids).size, ids.length, 'id не повторяются');
  assert.ok(C.DEFAULT_WORKS.length >= 15);
  C.DEFAULT_WORKS.forEach(x => {
    assert.ok(C.WORK_UNITS.includes(x.unit), x.name + ': единица из списка');
    assert.equal(x.price, null, x.name + ': без цены — мастер проставит свою');
  });
});

test('цена: разбор ввода', () => {
  const cases = [
    ['', null], ['0', null], ['abc', null], ['-5', 5],
    ['1500', 1500], ['1 500', 1500], ['1500 ₽', 1500], ['1500 $', 1500], ['$1500', 1500], ['1500 руб', 1500], ['1500 руб.', 1500],
    ['1500,5', 1500.5], ['1500.555', 1500.56], ['99999999', C.MAX_PRICE],
  ];
  cases.forEach(([s, want]) => assert.equal(C.parsePrice(s), want, `«${s}» → ${want}`));
  assert.equal(C.parsePrice(null), null);
  assert.equal(C.parsePrice(undefined), null);
});

test('цена: вывод', () => {
  assert.equal(C.fmtMoney(1500), '1' + NB + '500' + NB + '$');
  assert.equal(C.fmtMoney(1500.5), '1' + NB + '500,50' + NB + '$');
  assert.equal(C.fmtMoney(950), '950' + NB + '$');
  assert.equal(C.fmtMoney(1234567), '1' + NB + '234' + NB + '567' + NB + '$');
  assert.equal(C.fmtMoney(null), 'договорная');
  assert.equal(C.priceInput(1500.5), '1500,5');
  assert.equal(C.priceInput(null), '');
});

test('работа в объекте: строка и итог', () => {
  const a = line(W('w-03'), 2, 1500), b = line(W('w-20'), 1, null), c = line(W('w-17'), 3, 800.5);
  assert.equal(C.lineSum(a), 3000);
  assert.equal(C.lineSum(b), null);
  assert.equal(C.lineSum(c), 2401.5);
  assert.equal(C.workLine(a), '2 шт × 1' + NB + '500' + NB + '$ = 3' + NB + '000' + NB + '$');
  assert.equal(C.workLine(b), '1 шт, цена договорная');
  assert.deepEqual(C.worksTotal([a, b, c]), { sum: 5401.5, unpriced: 1, count: 3 });
  assert.deepEqual(C.worksTotal([]), { sum: 0, unpriced: 0, count: 0 });
  assert.deepEqual(C.worksTotal(undefined), { sum: 0, unpriced: 0, count: 0 });
});

test('работа в объекте: добавить, изменить, «+/−», убрать и «Вернуть»', () => {
  const zam = W('w-03');
  let works = C.applyItem([], C.workEntry(zam, 1500), 1, 'без демонтажа', 10);
  assert.equal(works.length, 1);
  assert.deepEqual([works[0].key, works[0].price, works[0].note, works[0].at], ['w:w-03|', 1500, 'без демонтажа', 10]);
  // Цена для этого объекта меняется в окне работы — дубля нет, место прежнее
  works = C.applyItem(works, C.workEntry(zam, 1800), 2, 'без демонтажа', 20);
  assert.deepEqual([works.length, works[0].qty, works[0].price, works[0].at], [1, 2, 1800, 10]);
  // «+/−» не теряют цену и примечание
  works = C.applyItem(works, works[0], C.stepQty(works[0], 1), undefined, 30);
  assert.deepEqual([works[0].qty, works[0].price, works[0].note], [3, 1800, 'без демонтажа']);
  // «Вернуть» после «−» до нуля
  const one = C.applyItem([], C.workEntry(W('w-02'), 2000), 1, '', 1);
  const removed = one[0];
  const empty = C.applyItem(one, removed, C.stepQty(removed, -1), undefined, 2);
  assert.deepEqual(empty, []);
  assert.deepEqual(C.restoreItem(empty, removed, 0), [removed]);
});

test('единицы работ: «точка» — только целые, «час» и «м» — дробные', () => {
  assert.equal(C.parseQty('2,5', 'точка'), 3);
  assert.equal(C.parseQty('1,5', 'час'), 1.5);
  assert.equal(C.parseQty('2,5', 'м'), 2.5);
});

test('поиск по прайсу работ', () => {
  const names = q => C.filterWorks(C.DEFAULT_WORKS, q).map(x => x.name);
  assert.deepEqual(names('смесит'), ['Установка смесителя', 'Замена смесителя']);
  assert.deepEqual(names('СЧЕТЧИК'), ['Установка счётчика воды'], 'е и ё, регистр — без разницы');
  assert.deepEqual(names('разводка канал'), ['Разводка канализации'], 'все слова запроса');
  assert.equal(C.filterWorks(C.DEFAULT_WORKS, '  ').length, C.DEFAULT_WORKS.length, 'пустой запрос — весь прайс');
});

test('прайс из резервной копии: слияние', () => {
  const cur = [Object.assign({}, W('w-03'), { price: 1500, updatedAt: 10 }), Object.assign({}, W('w-20'), { updatedAt: 10 })];
  const r = C.mergeWorkLists(cur, [
    Object.assign({}, W('w-03'), { price: 1800, updatedAt: 20 }),           // свежее — обновится
    Object.assign({}, W('w-20'), { price: 900, updatedAt: 5 }),             // старее — не затрёт
    { id: 'own-1', name: 'Монтаж гребёнки', unit: 'шт', price: '2 500', updatedAt: 1 }, // новая
    { id: 'bad', name: '', unit: 'шт' }, { id: 'bad2', name: 'X', unit: 'кг' }, null,   // мусор — пропуск
  ]);
  assert.deepEqual([r.added, r.updated], [1, 1]);
  assert.deepEqual(r.list.map(x => x.id + ':' + x.price), ['w-03:1800', 'w-20:null', 'own-1:2500']);
  assert.deepEqual(C.mergeWorkLists(cur, undefined).list, cur, 'старая копия без прайса — ничего не меняется');
});

test('текст для клиента и прайс текстом', () => {
  const job = { name: 'Кв. 12', address: 'ул. Садовая, 1', items: [{ name: 'Муфта PPR' }], works: [
    line(W('w-20'), 1, null, { at: 2 }),
    line(W('w-03'), 2, 1500, { at: 1, note: 'без демонтажа' }),
  ] };
  assert.equal(C.buildClientText(job, '20.10.2026'), [
    'Объект: Кв. 12', 'Адрес: ул. Садовая, 1', 'Дата: 20.10.2026', '', 'РАБОТЫ',
    '• Замена смесителя — 2 шт × 1' + NB + '500' + NB + '$ = 3' + NB + '000' + NB + '$ (без демонтажа)',
    '• Прочистка канализации — 1 шт, цена договорная', '',
    'Итого за работы: 3' + NB + '000' + NB + '$ (без договорных: 1)',
  ].join('\n'));
  assert.ok(!C.buildClientText(job, 'x').includes('Муфта'), 'детали в текст для клиента не попадают');
  const onlyDeal = { name: 'Б', works: [line(W('w-20'), 1, null)] };
  assert.ok(C.buildClientText(onlyDeal, 'x').endsWith('Стоимость работ — договорная'));
  assert.equal(C.buildPriceListText([Object.assign({}, W('w-03'), { price: 1500 }), W('w-20')]),
    'Прайс на работы\n\n• Замена смесителя — 1' + NB + '500' + NB + '$ / шт\n• Прочистка канализации — договорная');
});

test('объект: работы в копии и в старых данных', () => {
  assert.deepEqual(C.normalizeJob({ id: 'a', name: 'A', items: [] }).works, [], 'старые объекты без работ — пустой список');
  const job = C.normalizeJob({ id: 'a', name: 'A', items: [], works: [line(W('w-03'), 1, 1500)] });
  assert.equal(job.works.length, 1);
  // Заявка магазину (buildText) работ не содержит
  assert.ok(!C.buildText(job, 'x').includes('смесител'));
});
