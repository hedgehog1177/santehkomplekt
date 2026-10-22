// Тесты ядра Сантехкомплекта: выбор позиции, добавление, изменение и удаление, перевод старых данных.
// Запуск из папки pwa: node --test tests/   (нужен Node 18+, ничего устанавливать не надо)
// В скобках у названий — номера проверок ручного чек-листа, которые тест повторяет.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../core.js');

const part = id => C.PART_BY_ID[id];
// Позиция каталога в том виде, в каком её сохраняет окно детали
const entry = (pid, size) => { const p = part(pid); return { pid, name: p.name, size, unit: p.unit, group: p.group }; };
// Готовая позиция списка
const item = (pid, size, qty, extra) => Object.assign(entry(pid, size), { key: C.keyOf(pid, size), qty, note: '', at: 1 }, extra);

test('каталог: целостность данных', () => {
  const ids = C.PARTS.map(p => p.id);
  assert.equal(new Set(ids).size, ids.length, 'id деталей не повторяются');
  assert.equal(new Set(C.CATALOG.map(g => g.id)).size, C.CATALOG.length, 'id групп не повторяются');
  C.PARTS.forEach(p => {
    assert.ok(C.UNITS.includes(p.unit), p.id + ': единица ' + p.unit + ' есть в списке единиц');
    assert.ok(p.sizes.length >= 1, p.id + ': есть хотя бы один размер (пустой — «без размера»)');
    assert.equal(new Set(p.sizes).size, p.sizes.length, p.id + ': размеры не повторяются');
    assert.ok(C.GROUP_NAME[p.group], p.id + ': группа известна');
  });
  Object.entries(C.SIZE_RENAMES).forEach(([pid, map]) => Object.values(map).forEach(to =>
    assert.ok(part(pid).sizes.includes(to), pid + ': новый размер «' + to + '» есть в каталоге')));
  assert.equal(C.GROUP_ORDER[C.GROUP_ORDER.length - 1], C.OWN.id, '«Свои позиции» — последняя группа');
});

test('количество: разбор ввода (QTY-05, QTY-07…QTY-10)', () => {
  const cases = [
    ['', 'шт', 0], ['0', 'шт', 0], ['1', 'шт', 1],
    ['2,5', 'шт', 3], ['2,4', 'шт', 2], ['1,5', 'компл', 2], ['1,5', 'уп', 2],
    ['2,5', 'м', 2.5], ['2.5', 'м', 2.5], ['1,5', 'кг', 1.5], ['1,234', 'м', 1.23],
    ['abc', 'шт', 0], ['12abc', 'шт', 12],
    ['99999', 'шт', 99999], ['100000', 'шт', 99999], ['100000', 'м', 99999],
    // QTY-10: минус отбрасывается, «1.2.3» читается как 1,2 — поведение зафиксировано, не ошибка
    ['-5', 'шт', 5], ['1.2.3', 'м', 1.2],
  ];
  cases.forEach(([s, unit, want]) => assert.equal(C.parseQty(s, unit), want, `«${s}» ${unit} → ${want}`));
});

test('количество: вывод и склонения', () => {
  assert.equal(C.fmtQty(2.5), '2,5');
  assert.equal(C.fmtQty(3), '3');
  assert.equal(C.fmtQty(0.1 + 0.2), '0,3');
  const pos = n => n + ' ' + C.plural(n, 'позиция', 'позиции', 'позиций');
  assert.deepEqual([1, 2, 4, 5, 11, 14, 21, 22, 25].map(pos),
    ['1 позиция', '2 позиции', '4 позиции', '5 позиций', '11 позиций', '14 позиций', '21 позиция', '22 позиции', '25 позиций']);
});

test('окно детали: какой размер открывается (QTY-01…QTY-03)', () => {
  const muff = part('ppr-cpl');
  assert.equal(C.initialSize(muff, [], undefined), 'Ø20', 'ничего нет в списке — первый размер каталога');
  assert.equal(C.initialSize(muff, [item('ppr-cpl', 'Ø32', 2)], undefined), 'Ø32', 'открывается добавленный размер');
  assert.equal(C.initialSize(muff, [item('ppr-cpl', 'Ø40', 1), item('ppr-cpl', 'Ø25', 1)], undefined), 'Ø25',
    'из нескольких добавленных — первый по каталогу');
  assert.equal(C.initialSize(muff, [item('ppr-cpl', 'Ø25', 1)], 'Ø40'), 'Ø40', 'правка из списка открывает свой размер');
  assert.equal(C.initialSize(part('c-foam'), [], undefined), '', 'деталь без размеров');
  assert.equal(C.initialSize(muff, [item('ppr', 'Ø32', 2)], undefined), 'Ø20', 'чужая деталь того же размера не влияет');
});

test('окно детали: что подставляется в форму', () => {
  const items = [item('ppr-cpl', 'Ø25', 4, { note: 'хром' })];
  assert.deepEqual(C.formFor(items, 'ppr-cpl', 'Ø25'), { qty: '4', note: 'хром' });
  assert.deepEqual(C.formFor(items, 'ppr-cpl', 'Ø20'), { qty: '1', note: '' });
  assert.deepEqual(C.formFor([item('ppr', 'Ø20', 2.5)], 'ppr', 'Ø20'), { qty: '2,5', note: '' });
});

test('окно детали: черновики при переключении размеров (QTY-19)', () => {
  const items = [item('ppr-cpl', 'Ø25', 4, { note: 'хром' })];
  let d = {};
  // Ø20: ввели 7, не сохранили, перешли на Ø25 — там сохранённое из списка
  let r = C.switchSize(d, 'Ø20', { qty: '7', note: '' }, 'Ø25', items, 'ppr-cpl');
  assert.deepEqual(r.form, { qty: '4', note: 'хром' });
  // На Ø25 поменяли на 5 и вернулись на Ø20 — там введённое 7
  r = C.switchSize(r.drafts, 'Ø25', { qty: '5', note: 'хром' }, 'Ø20', items, 'ppr-cpl');
  assert.deepEqual(r.form, { qty: '7', note: '' });
  // И обратно на Ø25 — черновик 5, а не сохранённое 4
  r = C.switchSize(r.drafts, 'Ø20', { qty: '7', note: '' }, 'Ø25', items, 'ppr-cpl');
  assert.deepEqual(r.form, { qty: '5', note: 'хром' });
  // Новый размер без черновика и без позиции — «1»
  r = C.switchSize(r.drafts, 'Ø25', { qty: '5', note: 'хром' }, 'Ø40', items, 'ppr-cpl');
  assert.deepEqual(r.form, { qty: '1', note: '' });
  assert.deepEqual(d, {}, 'исходные черновики не меняются');
});

test('окно детали: главная кнопка и «Убрать из списка» по ТР-1 (QTY-04, QTY-05, QTY-15)', () => {
  const muff = part('ppr-cpl');
  const items = [item('ppr-cpl', 'Ø25', 4)];
  // Правило 1: позиции нет, количество > 0 — «Добавить», активна, «Убрать» нет
  assert.deepEqual(C.qtyForm(muff, items, 'Ø20', '2', false), { existing: false, n: 2, canSave: true, label: 'Добавить в список · 2 шт' });
  // Правило 2: позиции нет, количество 0 или пусто — неактивна
  assert.equal(C.qtyForm(muff, items, 'Ø20', '0', false).canSave, false);
  assert.equal(C.qtyForm(muff, items, 'Ø20', '', false).canSave, false);
  assert.equal(C.qtyForm(muff, items, 'Ø20', 'abc', false).canSave, false);
  // Правило 3: позиция есть, количество > 0 — «Сохранить», есть «Убрать»
  assert.deepEqual(C.qtyForm(muff, items, 'Ø25', '6', false), { existing: true, n: 6, canSave: true, label: 'Сохранить · 6 шт' });
  // Правило 4: позиция есть, количество 0 — «Сохранить» неактивна, «Убрать» остаётся
  const f = C.qtyForm(muff, items, 'Ø25', '0', false);
  assert.equal(f.canSave, false);
  assert.equal(f.existing, true);
  // Только просмотр — сохранять нельзя
  assert.equal(C.qtyForm(muff, items, 'Ø20', '2', true).canSave, false);
  // Подпись с дробными метрами и округлёнными штуками
  assert.equal(C.qtyForm(part('ppr'), [], 'Ø20', '2,5', false).label, 'Добавить в список · 2,5 м');
  assert.equal(C.qtyForm(muff, [], 'Ø20', '2,5', false).label, 'Добавить в список · 3 шт');
});

test('каталог: метка и подсветка размеров по ТР-3 (CAT-04, CAT-05)', () => {
  const muff = part('ppr-cpl');
  let r = C.rowState(muff, []);
  assert.equal(r.badge, null, 'ничего не выбрано — метки нет (показывается «+»)');
  assert.equal(r.onSizes.size, 0);
  r = C.rowState(muff, [item('ppr-cpl', 'Ø25', 4)]);
  assert.equal(r.badge, '1 поз.', 'деталь с несколькими размерами — число позиций');
  assert.ok(r.onSizes.has('Ø25') && !r.onSizes.has('Ø20'), 'подсвечен только выбранный размер');
  r = C.rowState(muff, [item('ppr-cpl', 'Ø20', 1), item('ppr-cpl', 'Ø32', 1), item('ppr', 'Ø25', 3)]);
  assert.equal(r.badge, '2 поз.', 'позиции других деталей не считаются');
  assert.deepEqual([...r.onSizes].sort(), ['Ø20', 'Ø32']);
  assert.equal(C.rowState(part('c-fum'), [item('c-fum', '19 мм × 15 м', 2)]).badge, '2 шт', 'один размер — количество');
  assert.equal(C.rowState(part('c-foam'), [item('c-foam', '', 3)]).badge, '3 шт', 'без размеров — количество');
});

test('список: добавление, изменение, удаление (CP-05, QTY-16, LIST-06)', () => {
  const e = entry('ppr-cpl', 'Ø25');
  let items = C.applyItem([], e, 4, 'хром', 100);
  assert.equal(items.length, 1);
  assert.deepEqual(items[0], Object.assign({}, e, { key: 'ppr-cpl|Ø25', qty: 4, at: 100, note: 'хром' }));
  // Тот же размер ещё раз — меняется количество, дубля нет, время добавления прежнее
  items = C.applyItem(items, e, 6, 'хром', 200);
  assert.equal(items.length, 1);
  assert.equal(items[0].qty, 6);
  assert.equal(items[0].at, 100);
  // Другой размер — отдельная позиция
  items = C.applyItem(items, entry('ppr-cpl', 'Ø20'), 2, '', 300);
  assert.equal(items.length, 2);
  // «Убрать из списка» (количество 0) у Ø25 не трогает Ø20
  const before = items;
  items = C.applyItem(items, { pid: 'ppr-cpl', size: 'Ø25' }, 0, undefined, 400);
  assert.deepEqual(items.map(i => i.key), ['ppr-cpl|Ø20']);
  assert.equal(before.length, 2, 'исходный список не меняется');
  // Отрицательное количество тоже убирает
  assert.deepEqual(C.applyItem(items, entry('ppr-cpl', 'Ø20'), -1, undefined, 500), []);
  // Убрать то, чего нет, — ничего не ломает
  assert.deepEqual(C.applyItem([], entry('ppr', 'Ø20'), 0, undefined, 1), []);
});

test('список: примечание при изменении количества', () => {
  let items = C.applyItem([], entry('ppr-cpl', 'Ø25'), 4, 'хром', 1);
  // Кнопки «+» и «−» передают позицию без нового примечания — примечание остаётся
  items = C.applyItem(items, items[0], C.stepQty(items[0], 1), undefined, 2);
  assert.equal(items[0].qty, 5);
  assert.equal(items[0].note, 'хром');
  // Окно детали передаёт примечание явно — пустое стирает
  items = C.applyItem(items, entry('ppr-cpl', 'Ø25'), 5, '', 3);
  assert.equal(items[0].note, '');
});

test('список: изменённая позиция остаётся на своём месте в группе', () => {
  let items = [];
  items = C.applyItem(items, entry('ppr-cpl', 'Ø20'), 1, '', 10);
  items = C.applyItem(items, entry('ppr-tee', 'Ø20'), 1, '', 20);
  items = C.applyItem(items, entry('ppr-cpl', 'Ø25'), 1, '', 30);
  const order = () => C.sortedGroups(items)[0].items.map(C.fullName);
  const was = order();
  items = C.applyItem(items, items[0], C.stepQty(items[0], 1), undefined, 40); // «+» у первой
  items = C.applyItem(items, entry('ppr-cpl', 'Ø25'), 7, 'новое', 50);          // правка последней из окна
  assert.deepEqual(order(), was);
});

test('список: «Вернуть» после «−» до нуля', () => {
  let items = [];
  items = C.applyItem(items, entry('ppr-cpl', 'Ø20'), 1, 'латунь', 10);
  items = C.applyItem(items, entry('ppr-tee', 'Ø20'), 4, '', 20);
  items = C.applyItem(items, entry('ppr-cpl', 'Ø25'), 2, '', 30);
  const order = () => C.sortedGroups(items)[0].items.map(C.fullName);
  const was = order();
  // «−» у первой позиции (1 шт) — она убирается
  const removed = items[0];
  items = C.applyItem(items, removed, C.stepQty(removed, -1), undefined, 40);
  assert.equal(items.length, 2);
  // «Вернуть» — на прежнее место, с прежним количеством и примечанием
  items = C.restoreItem(items, removed);
  assert.deepEqual(order(), was);
  const back = items.find(i => i.key === 'ppr-cpl|Ø20');
  assert.deepEqual([back.qty, back.note, back.at], [1, 'латунь', 10]);
  // Если позицию уже добавили заново — второй не появится
  const again = C.applyItem(C.applyItem(items, removed, 0, undefined, 50), entry('ppr-cpl', 'Ø20'), 3, '', 60);
  const after = C.restoreItem(again, removed);
  assert.equal(after.filter(i => i.key === 'ppr-cpl|Ø20').length, 1);
  assert.equal(after.find(i => i.key === 'ppr-cpl|Ø20').qty, 3, 'остаётся то, что добавили заново');
  // Одинаковое время добавления у соседей (как у счётчиков ХВС/ГВС в примере) — порядок всё равно прежний
  let tie = [item('m-cnt', 'ХВС', 1, { at: 5 }), item('m-cnt', 'ГВС', 1, { at: 5 }), item('ppr-cpl', 'Ø20', 2, { at: 5 })];
  const tieOrder = () => C.sortedGroups(tie).map(g => g.items.map(C.fullName).join(' | '));
  const tieWas = tieOrder();
  const hvs = tie[0], idx = tie.findIndex(i => i.key === hvs.key);
  tie = C.applyItem(tie, hvs, 0, undefined, 6);
  tie = C.restoreItem(tie, hvs, idx);
  assert.deepEqual(tieOrder(), tieWas);
  // Место за пределами списка — в конец; без места — тоже в конец (как раньше)
  assert.equal(C.restoreItem([], hvs, 10)[0].key, hvs.key);
  assert.deepEqual(C.restoreItem([item('ppr', 'Ø20', 1)], hvs).map(i => i.key), ['ppr|Ø20', hvs.key]);
  // 0,5 м тоже возвращается как 0,5
  let m = C.applyItem([], entry('ppr', 'Ø25'), 0.5, '', 1);
  const pipe = m[0];
  m = C.applyItem(m, pipe, C.stepQty(pipe, -1), undefined, 2);
  assert.deepEqual(C.restoreItem(m, pipe).map(i => i.qty), [0.5]);
});

test('список: кнопки «+» и «−» (LIST-03…LIST-05, QTY-06)', () => {
  const st = (pid, size, qty, d) => C.stepQty(item(pid, size, qty), d);
  assert.equal(st('ppr-cpl', 'Ø20', 4, 1), 5);
  assert.equal(st('ppr-cpl', 'Ø20', 4, -1), 3);
  assert.equal(st('ppr-cpl', 'Ø20', 1, -1), 0, '«−» при 1 — ноль, позиция убирается');
  assert.equal(st('ppr', 'Ø20', 0.5, -1), 0, '«−» при 0,5 м — ноль, а не −0,5');
  assert.equal(st('ppr', 'Ø20', 2.5, -1), 1.5, '«−» при 2,5 м — 1,5');
  assert.equal(st('ppr', 'Ø20', 0.1, 1), 1.1, 'без хвостов округления');
  assert.equal(st('ppr-cpl', 'Ø20', 0, -1), 0);
  assert.equal(st('ppr-cpl', 'Ø20', 0, 1), 1);
  assert.equal(st('ppr-cpl', 'Ø20', 99999, 1), 99999, '«+» на пределе не превышает 99999');
});

test('список: группы и порядок (LIST-01)', () => {
  const own = { pid: 'own-1', name: 'Насос', size: '', unit: 'шт', group: C.OWN.id, key: 'own-1|', qty: 1, at: 1 };
  const odd = { pid: 'own-2', name: 'Старое', size: '', unit: 'шт', group: 'нет-такой', key: 'own-2|', qty: 1, at: 1 };
  const items = [own, item('c-fum', '19 мм × 15 м', 1, { at: 5 }), item('ppr', 'Ø25', 6, { at: 9 }), item('ppr', 'Ø20', 2, { at: 3 }), odd];
  const g = C.sortedGroups(items);
  assert.deepEqual(g.map(x => x.name), ['Трубы', 'Крепёж и расходники', 'Свои позиции', 'Прочее']);
  assert.deepEqual(g[0].items.map(i => i.size), ['Ø20', 'Ø25'], 'внутри группы — по времени добавления');
});

test('объекты: изменённый поднимается в начало', () => {
  const list = [{ id: 'a', items: [] }, { id: 'b', items: [] }, { id: 'c', items: [] }];
  const out = C.bumpJob(list, 'c', j => Object.assign({}, j, { name: 'C' }), 777);
  assert.deepEqual(out.map(j => j.id), ['c', 'a', 'b']);
  assert.equal(out[0].updatedAt, 777);
  assert.equal(out[0].name, 'C');
  assert.equal(C.bumpJob(list, 'нет', j => j, 1), list, 'неизвестный объект — список без изменений');
});

test('перевод старых списков к текущему каталогу', () => {
  // Старый размер водорозетки без «ВР» переименовывается
  let out = C.normalizeItems([item('ppr-wall', '20×½"', 2)]);
  assert.equal(out[0].size, '20×½" ВР');
  assert.equal(out[0].key, 'ppr-wall|20×½" ВР');
  // Старая и новая запись одного размера сливаются в одну, количества складываются
  out = C.normalizeItems([item('ppr-un', '25×¾"', 2, { at: 1 }), item('ppr-un', '25×¾" ВР', 3, { at: 2 })]);
  assert.equal(out.length, 1);
  assert.equal(out[0].qty, 5);
  // Сумма не превышает предел
  out = C.normalizeItems([item('ppr-wall', '20×½"', 60000), item('ppr-wall', '20×½" ВР', 60000)]);
  assert.equal(out[0].qty, 99999);
  // Название, единица и группа берутся из каталога (87° → 90°, id тот же)
  out = C.normalizeItems([Object.assign(item('s-87', 'Ø50', 4), { name: 'Отвод канализационный 87°', unit: 'м', group: 'pipes' })]);
  assert.equal(out[0].name, 'Отвод канализационный 90°');
  assert.equal(out[0].unit, 'шт');
  assert.equal(out[0].group, part('s-87').group);
  // Свои позиции не трогаются
  const own = { pid: 'own-x', name: 'Насос', size: '', unit: 'шт', group: 'own', key: 'own-x|', qty: 1 };
  assert.equal(C.normalizeItems([own])[0], own);
  // Повреждённые данные
  assert.deepEqual(C.normalizeItems(undefined), []);
  assert.deepEqual(C.normalizeJob({ id: 'a', name: 'A' }).items, []);
});

test('резервная копия: проверка файла (BAK-05)', () => {
  const job = { id: 'a', name: 'A', items: [] };
  assert.deepEqual(C.backupJobs({ app: 'santehkomplekt', jobs: [job] }), [job]);
  assert.deepEqual(C.backupJobs([job]), [job], 'старый формат — просто массив');
  [null, {}, { jobs: 'x' }, [{ id: 'a', items: [] }], [{ name: 'A', items: [] }], [{ id: 'a', name: 'A' }], [null]]
    .forEach(bad => assert.equal(C.backupJobs(bad), null, JSON.stringify(bad)));
});

test('резервная копия: слияние без дублей (BAK-04, BAK-06, BAK-07)', () => {
  const cur = [{ id: 'a', name: 'A', items: [], updatedAt: 10 }, { id: 'b', name: 'B', items: [], updatedAt: 20 }];
  // Та же копия — ничего нового
  let r = C.mergeJobs(cur, cur);
  assert.deepEqual([r.added, r.updated, r.jobs.length], [0, 0, 2]);
  // Новый объект добавляется, более свежий заменяет, более старый не затирает
  r = C.mergeJobs(cur, [
    { id: 'c', name: 'C', items: [], updatedAt: 5 },
    { id: 'a', name: 'A2', items: [], updatedAt: 30 },
    { id: 'b', name: 'B-старый', items: [], updatedAt: 15 },
  ]);
  assert.deepEqual([r.added, r.updated], [1, 1]);
  assert.deepEqual(r.jobs.map(j => j.id + ':' + j.name), ['a:A2', 'b:B', 'c:C'], 'по свежести, без дублей');
  // Позиции из копии приводятся к текущему каталогу
  r = C.mergeJobs([], [{ id: 'd', name: 'D', items: [item('ppr-wall', '20×½"', 1)] }]);
  assert.equal(r.jobs[0].items[0].size, '20×½" ВР');
});

test('резервная копия: свежий пример не затирает «Пример» из копии', () => {
  // Новый телефон или удалили данные: пример создан только что, а копия сделана раньше
  const fresh = C.exampleJob(1000);
  assert.deepEqual([fresh.id, fresh.createdAt, fresh.updatedAt, fresh.items.length], ['example-1', 1000, 0, 11]);
  assert.equal(new Set(fresh.items.map(i => i.at)).size, 11, 'у позиций разное время добавления');
  const mine = Object.assign({}, fresh, { name: 'Кв. 45 — мой объект', items: fresh.items.slice(0, 3), updatedAt: 500 });
  let r = C.mergeJobs([fresh], [mine]);
  assert.deepEqual([r.added, r.updated, r.jobs.length], [0, 1, 1]);
  assert.equal(r.jobs[0].name, 'Кв. 45 — мой объект');
  assert.equal(r.jobs[0].items.length, 3, 'позиции из копии на месте');
  // В копии нетронутый пример — ничего не меняется и не задваивается
  r = C.mergeJobs([fresh], [C.exampleJob(200)]);
  assert.deepEqual([r.added, r.updated, r.jobs.length], [0, 0, 1]);
  // Пример уже правили на этом телефоне — правка свежее старой копии и остается
  const edited = C.bumpJob([fresh], 'example-1', j => Object.assign({}, j, { name: 'Правка на телефоне' }), 2000);
  r = C.mergeJobs(edited, [mine]);
  assert.equal(r.jobs[0].name, 'Правка на телефоне');
});

test('текст для мессенджера (EXP-01, EXP-02)', () => {
  const job = { name: 'Кв. 12', address: 'ул. Садовая, 1', items: [
    item('ppr', 'Ø25', 6, { at: 2 }),
    item('ppr-cpl', 'Ø25', 10, { at: 1, note: 'хром' }),
    { pid: 'own-1', name: 'Насос', size: '', unit: 'шт', group: 'own', key: 'own-1|', qty: 1, at: 3 },
  ] };
  assert.equal(C.buildText(job, '17.10.2026'), [
    'Объект: Кв. 12', 'Адрес: ул. Садовая, 1', 'Дата: 17.10.2026', '',
    'ТРУБЫ', '• Труба PPR PN20 Ø25 — 6 м', '',
    'ФИТИНГИ PPR', '• Муфта PPR Ø25 — 10 шт (хром)', '',
    'СВОИ ПОЗИЦИИ', '• Насос — 1 шт', '',
    'Всего позиций: 3',
  ].join('\n'));
  assert.ok(!C.buildText({ name: 'Б', items: [] }, '1.1.2026').includes('Адрес'), 'без адреса — строки нет');
});
