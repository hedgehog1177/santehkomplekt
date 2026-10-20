// Сантехкомплект — ядро без интерфейса: каталог и правила работы со списком.
// Не обращается ни к браузеру, ни к React, поэтому проверяется тестами в Node: node --test tests/
// В браузере доступно как window.SantehCore, в Node — через require('./core.js').
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SantehCore = api;
})(typeof self !== 'undefined' ? self : this, function () {
'use strict';

/* ---------- Каталог ---------- */
const T = ['½"', '¾"', '1"'];
const p = (id, name, unit, sizes, spec, alias) => ({ id, name, unit, sizes: sizes && sizes.length ? sizes : [''], spec: spec || '', alias: alias || '' });
const CATALOG = [
  { id: 'pipes', name: 'Трубы', items: [
    p('ppr', 'Труба PPR PN20', 'м', ['Ø20', 'Ø25', 'Ø32', 'Ø40'], 'Полипропилен, ХВС', 'пп полипропилен пропилен'),
    p('pprfb', 'Труба PPR армированная стекловолокном', 'м', ['Ø20', 'Ø25', 'Ø32'], 'ГВС и отопление', 'армированная файбер стекло'),
    p('mp', 'Труба металлопластиковая PEX-AL-PEX', 'м', ['16×2,0', '20×2,0', '26×3,0'], '', 'металлопласт мп'),
    p('pex', 'Труба из сшитого полиэтилена PE-Xa', 'м', ['16×2,2', '20×2,8'], 'Тёплый пол, лучевая разводка', 'пекс сшитый'),
    p('vgp', 'Труба стальная ВГП оцинкованная', 'м', ['Ду15 (½")', 'Ду20 (¾")', 'Ду25 (1")', 'Ду32 (1¼")'], 'Ду — условный проход', 'сталь вгп оцинковка дюйм дюймовка полдюймовая'),
    p('corr', 'Гофра защитная для труб', 'м', ['Ø16', 'Ø20', 'Ø25'], 'Под металлопластик и PE-X', 'гофротруба кожух'),
  ]},
  { id: 'ppr', name: 'Фитинги PPR', items: [
    p('ppr-cpl', 'Муфта PPR', 'шт', ['Ø20', 'Ø25', 'Ø32', 'Ø40']),
    p('ppr-90', 'Угол PPR 90°', 'шт', ['Ø20', 'Ø25', 'Ø32'], '', 'отвод колено уголок'),
    p('ppr-45', 'Угол PPR 45°', 'шт', ['Ø20', 'Ø25', 'Ø32'], '', 'отвод колено уголок'),
    p('ppr-tee', 'Тройник PPR', 'шт', ['Ø20', 'Ø25', 'Ø32']),
    p('ppr-teer', 'Тройник PPR переходной', 'шт', ['25×20×25', '32×20×32', '32×25×32']),
    p('ppr-red', 'Муфта PPR переходная', 'шт', ['25×20', '32×20', '32×25', '40×32'], '', 'переход редукция'),
    p('ppr-fi', 'Муфта PPR комбинированная ВР', 'шт', ['20×½"', '25×½"', '25×¾"', '32×1"'], 'Внутренняя резьба', 'переход резьба внутренняя'),
    p('ppr-mi', 'Муфта PPR комбинированная НР', 'шт', ['20×½"', '25×¾"', '32×1"'], 'Наружная резьба', 'переход резьба наружная'),
    p('ppr-fe', 'Угол PPR комбинированный ВР', 'шт', ['20×½"', '25×½"', '25×¾"'], '', 'уголок резьба'),
    p('ppr-wall', 'Водорозетка PPR', 'шт', ['20×½" ВР', '20×½" НР'], 'Настенный угольник под смеситель; ВР — внутренняя резьба, НР — наружная', 'водоразетка угольник крепление'),
    p('ppr-bend', 'Обвод PPR', 'шт', ['Ø20', 'Ø25', 'Ø32'], '', 'скоба обходник'),
    p('ppr-cap', 'Заглушка PPR', 'шт', ['Ø20', 'Ø25', 'Ø32']),
    p('ppr-val', 'Кран шаровой PPR', 'шт', ['Ø20', 'Ø25', 'Ø32']),
    p('ppr-un', 'Муфта PPR разъёмная (американка)', 'шт', ['20×½" ВР', '20×½" НР', '25×¾" ВР', '25×¾" НР', '32×1" ВР', '32×1" НР'], 'ВР — внутренняя резьба, НР — наружная', 'американка разъемная'),
  ]},
  { id: 'mpfit', name: 'Пресс-фитинги для металлопластика', items: [
    p('mp-cpl', 'Пресс-муфта', 'шт', ['16×16', '20×20', '26×26']),
    p('mp-90', 'Пресс-угол 90°', 'шт', ['Ø16', 'Ø20', 'Ø26'], '', 'уголок колено'),
    p('mp-tee', 'Пресс-тройник', 'шт', ['16×16×16', '20×16×20', '20×20×20', '26×20×26']),
    p('mp-fi', 'Пресс-переход ВР', 'шт', ['16×½"', '20×½"', '20×¾"', '26×1"'], 'Внутренняя резьба'),
    p('mp-mi', 'Пресс-переход НР', 'шт', ['16×½"', '20×½"', '20×¾"', '26×1"'], 'Наружная резьба'),
    p('mp-wall', 'Пресс-водорозетка', 'шт', ['16×½"', '20×½"'], '', 'водоразетка угольник'),
    p('euro', 'Евроконус для коллектора', 'шт', ['16×¾"', '20×¾"'], 'Для PE-X и металлопластика', 'фитинг коллекторный'),
  ]},
  { id: 'thread', name: 'Резьбовые фитинги', items: [
    p('th-cpl', 'Муфта латунная ВР-ВР', 'шт', T),
    p('th-nip', 'Ниппель латунный НР-НР', 'шт', T, '', 'бочонок'),
    p('th-red', 'Переходник латунный ВР-НР', 'шт', ['½"×¾"', '¾"×½"', '1"×¾"'], '', 'переход'),
    p('th-90f', 'Угольник латунный ВР-ВР', 'шт', T, '', 'уголок колено'),
    p('th-90m', 'Угольник латунный ВР-НР', 'шт', T, '', 'уголок колено'),
    p('th-tee', 'Тройник латунный ВР', 'шт', T),
    p('th-un', 'Сгон-американка прямой', 'шт', T, '', 'американка сгон'),
    p('th-un90', 'Сгон-американка угловой', 'шт', T, '', 'американка сгон'),
    p('th-ext', 'Удлинитель резьбы', 'шт', ['½" 10 мм', '½" 20 мм', '½" 30 мм', '½" 50 мм'], '', 'удлинитель'),
    p('th-cap', 'Заглушка латунная ВР', 'шт', T),
    p('th-plug', 'Пробка латунная НР', 'шт', T),
  ]},
  { id: 'valves', name: 'Запорная арматура', items: [
    p('v-ff', 'Кран шаровой полнопроходной ВР-ВР', 'шт', ['½"', '¾"', '1"', '1¼"'], '', 'вентиль кран'),
    p('v-fm', 'Кран шаровой ВР-НР', 'шт', T, '', 'вентиль кран'),
    p('v-un', 'Кран шаровой с американкой', 'шт', ['½"', '¾"']),
    p('v-ang', 'Кран шаровой угловой для подводки', 'шт', ['½"×½"', '½"×⅜"'], 'Под бачок, смеситель', 'кран бачок унитаз'),
    p('v-wm', 'Кран для стиральной машины', 'шт', ['½"×¾"'], 'Со штуцером под шланг', 'стиралка посудомойка'),
    p('v-nut', 'Кран шаровой с накидной гайкой', 'шт', T, 'ВР × накидная гайка', 'накидная гайка полусгон под счётчик'),
    p('v-chk', 'Клапан обратный', 'шт', T),
    p('v-flt', 'Фильтр сетчатый косой', 'шт', T, 'Грубой очистки', 'грязевик фильтр'),
    p('v-prv', 'Редуктор давления', 'шт', ['½"', '¾"'], '', 'регулятор давления'),
  ]},
  { id: 'meter', name: 'Учёт и коллекторы', items: [
    p('m-cnt', 'Счётчик воды ½"', 'шт', ['ХВС', 'ГВС'], 'С комплектом присоединения', 'водомер счетчик'),
    p('m-col', 'Коллектор с кранами ¾"×½"', 'шт', ['2 вых.', '3 вых.', '4 вых.'], '', 'гребенка гребёнка распределитель'),
    p('m-flt', 'Фильтр магистральный 10"', 'шт', ['½"', '¾"'], 'Колба под картридж', 'фильтр тонкой очистки колба'),
    p('m-cart', 'Картридж для фильтра 10"', 'шт', ['вспененный', 'нитяной', 'угольный']),
    p('m-man', 'Манометр 0–10 бар ¼"', 'шт', [], '', 'давление'),
  ]},
  { id: 'sewer', name: 'Канализация', items: [
    p('s-pipe', 'Труба канализационная ПП', 'шт', ['Ø32×250', 'Ø32×500', 'Ø32×1000', 'Ø50×500', 'Ø50×1000', 'Ø50×2000', 'Ø110×500', 'Ø110×1000', 'Ø110×2000'], 'Длина в мм', 'канализация фановая'),
    p('s-45', 'Отвод канализационный 45°', 'шт', ['Ø32', 'Ø50', 'Ø110'], '', 'колено угол'),
    // id «s-87» сохранён, чтобы старые списки не потеряли позицию; в поиске «87» тоже находит
    p('s-87', 'Отвод канализационный 90°', 'шт', ['Ø32', 'Ø50', 'Ø110'], '', 'колено угол 87'),
    p('s-t45', 'Тройник канализационный 45°', 'шт', ['32×32', '50×32', '50×50', '110×50', '110×110'], '', 'косой'),
    p('s-t87', 'Тройник канализационный 90°', 'шт', ['32×32', '50×32', '50×50', '110×50', '110×110'], '', 'прямой 87'),
    p('s-x', 'Крестовина канализационная', 'шт', ['110×110×110', '110×50×50']),
    p('s-red', 'Переход канализационный', 'шт', ['50×32', '110×50'], '', 'редукция эксцентрик'),
    p('s-rev', 'Ревизия', 'шт', ['Ø50', 'Ø110'], '', 'лючок прочистка'),
    p('s-cap', 'Заглушка канализационная', 'шт', ['Ø32', 'Ø50', 'Ø110']),
    p('s-cuff', 'Манжета переходная на чугун', 'шт', ['72×50', '123×110'], '', 'уплотнитель резинка'),
    p('s-wc', 'Гофра для унитаза', 'шт', ['Ø110'], '', 'фановая труба'),
    p('s-air', 'Аэратор канализационный', 'шт', ['Ø50', 'Ø110'], '', 'вакуумный клапан'),
  ]},
  { id: 'hoses', name: 'Подводка и сифоны', items: [
    p('h-flex', 'Подводка гибкая для воды ½" ВР-ВР', 'шт', ['30 см', '40 см', '50 см', '60 см', '80 см', '100 см'], '', 'шланг гибкий'),
    p('h-mix', 'Подводка для смесителя М10×½"', 'шт', ['40 см', '50 см', '60 см'], '', 'шланг гибкий смеситель'),
    p('h-sink', 'Сифон для раковины', 'шт', ['бутылочный', 'трубный']),
    p('h-kit', 'Сифон для мойки', 'шт', ['одинарный', 'двойной'], 'С отводом под стиральную машину'),
    p('h-bath', 'Сифон для ванны (обвязка)', 'шт', ['простой', 'полуавтомат', 'автомат'], '', 'обвязка'),
    p('h-wm', 'Шланг сливной для стиральной машины', 'шт', ['1,5 м', '2 м', '3 м']),
    p('h-drain', 'Трап душевой Ø50', 'шт', ['горизонтальный', 'вертикальный'], '', 'трап слив'),
    p('h-tank', 'Арматура для бачка унитаза', 'компл', ['нижняя подводка', 'боковая подводка'], '', 'бачок поплавок'),
  ]},
  { id: 'fixtures', name: 'Сантехприборы', items: [
    p('f-ms', 'Смеситель для раковины', 'шт', []),
    p('f-mk', 'Смеситель для кухни', 'шт', []),
    p('f-mb', 'Смеситель для ванны с душем', 'шт', []),
    p('f-shw', 'Душевая система', 'компл', []),
    p('f-wc', 'Унитаз-компакт', 'шт', []),
    p('f-inst', 'Инсталляция для подвесного унитаза', 'компл', [], '', 'рама'),
    p('f-btn', 'Кнопка смыва', 'шт', []),
    p('f-basin', 'Раковина', 'шт', []),
    p('f-towel', 'Полотенцесушитель водяной', 'шт', ['500×500', '600×500', '800×500'], '', 'змеевик'),
  ]},
  { id: 'heat', name: 'Отопление', items: [
    p('r-bim', 'Радиатор биметаллический 500 мм', 'шт', ['4 секц.', '6 секц.', '8 секц.', '10 секц.', '12 секц.'], '', 'батарея'),
    p('r-kit', 'Комплект подключения радиатора', 'компл', ['½"', '¾"'], 'Пробки, заглушка, кран Маевского', 'футорки'),
    p('r-br', 'Кронштейн для радиатора', 'шт', ['угловой', 'штыревой']),
    p('r-val', 'Кран радиаторный', 'шт', ['прямой ½"', 'угловой ½"', 'прямой ¾"', 'угловой ¾"'], '', 'вентиль'),
    p('r-th', 'Термоголовка M30×1,5', 'шт', [], '', 'термостат'),
    p('r-may', 'Кран Маевского', 'шт', ['½"', '¾"'], '', 'воздушник'),
    p('r-air', 'Воздухоотводчик автоматический', 'шт', ['⅜"', '½"'], '', 'воздушник'),
  ]},
  { id: 'fix', name: 'Крепёж и расходники', items: [
    p('c-clip', 'Клипса для трубы', 'шт', ['Ø16', 'Ø20', 'Ø25', 'Ø32'], '', 'крепление держатель'),
    p('c-ktr', 'Крепёж трубный (КТР)', 'шт', ['Ø16', 'Ø20', 'Ø25', 'Ø32', 'Ø40', 'Ø50', 'Ø110'], '', 'ктр крепеж трубный кронштейн держатель'),
    p('c-clamp', 'Хомут с резиновым уплотнением', 'шт', ['½" (20–23)', '¾" (25–28)', '1" (32–35)', 'Ø50', 'Ø110'], '', 'хомут'),
    p('c-rod', 'Шпилька М8', 'шт', ['80 мм', '100 мм', '120 мм']),
    p('c-dow', 'Дюбель-гвоздь', 'уп', ['6×40', '6×60']),
    p('c-flax', 'Лён сантехнический', 'шт', ['100 г', '200 г'], '', 'пакля'),
    p('c-paste', 'Паста уплотнительная', 'шт', ['70 г', '250 г']),
    p('c-fum', 'ФУМ-лента', 'шт', ['19 мм × 15 м'], '', 'фум'),
    p('c-thr', 'Нить уплотнительная', 'шт', ['50 м', '150 м']),
    p('c-sil', 'Герметик силиконовый санитарный', 'шт', ['белый', 'прозрачный'], '', 'силикон'),
    p('c-foam', 'Пена монтажная 750 мл', 'шт', []),
    p('c-wc', 'Крепление для унитаза', 'компл', ['к полу', 'к стене'], 'Дюбели, шурупы, шайбы, заглушки', 'крепёж унитаза дюбель шуруп'),
  ]},
  { id: 'insul', name: 'Изоляция', items: [
    p('i-pe', 'Теплоизоляция трубная, вспененный ПЭ', 'м', ['22×6', '28×9', '35×9', '54×9', '110×9'], 'Внутр. диаметр × толщина', 'утеплитель энергофлекс'),
  ]},
];
const OWN = { id: 'own', name: 'Свои позиции' };
const GROUP_ORDER = CATALOG.map(g => g.id).concat(OWN.id);
const GROUP_NAME = Object.fromEntries(CATALOG.map(g => [g.id, g.name]).concat([[OWN.id, OWN.name]]));
const PARTS = [];
CATALOG.forEach(g => g.items.forEach(it => { it.group = g.id; PARTS.push(it); }));
const PART_BY_ID = Object.fromEntries(PARTS.map(x => [x.id, x]));
const UNITS = ['шт', 'м', 'компл', 'уп', 'кг', 'л'];
const INT_UNITS = { 'шт': 1, 'компл': 1, 'уп': 1, 'точка': 1 };
const PRESETS = { 'м': [1, 2, 4, 6, 10, 25, 50], 'шт': [1, 2, 4, 6, 10, 20], 'час': [1, 2, 3, 4, 6, 8] };

/* ---------- Количество и позиции ---------- */
const MAX_QTY = 99999;
const keyOf = (pid, size) => pid + '|' + (size || '');
const fmtQty = q => String(Math.round(q * 100) / 100).replace('.', ',');
function parseQty(s, unit) {
  let n = parseFloat(String(s).replace(',', '.').replace(/[^\d.]/g, ''));
  if (!isFinite(n) || n < 0) n = 0;
  n = INT_UNITS[unit] ? Math.round(n) : Math.round(n * 100) / 100;
  return Math.min(n, MAX_QTY);
}
const plural = (n, a, b, c) => { const m10 = n % 10, m100 = n % 100; return m10 === 1 && m100 !== 11 ? a : (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? b : c); };
const fullName = it => it.name + (it.size ? ' ' + it.size : '');
const findItem = (items, pid, size) => items.find(i => i.key === keyOf(pid, size));
const groupOf = i => i.group || (PART_BY_ID[i.pid] && PART_BY_ID[i.pid].group) || OWN.id;
// Список по группам в порядке каталога, внутри группы — в порядке добавления (поле at)
function sortedGroups(items) {
  const by = {};
  items.forEach(i => { const g = groupOf(i); (by[g] = by[g] || []).push(i); });
  return GROUP_ORDER.filter(g => by[g]).map(g => ({ id: g, name: GROUP_NAME[g] || 'Прочее', items: by[g].sort((a, b) => (a.at || 0) - (b.at || 0)) }))
    .concat(Object.keys(by).filter(g => !GROUP_NAME[g]).map(g => ({ id: g, name: 'Прочее', items: by[g] })));
}

/* ---------- Окно детали ---------- */
// Какой размер открыть: заданный (правка из списка), первый уже добавленный или первый по каталогу
function initialSize(part, items, lockedSize) {
  if (lockedSize !== undefined) return lockedSize;
  const inList = part.sizes.find(s => findItem(items, part.id, s));
  return inList !== undefined ? inList : part.sizes[0];
}
// Что показать в форме для размера: сохранённые количество и примечание или «1» и пусто
function formFor(items, pid, size) {
  const e = findItem(items, pid, size);
  return { qty: e ? fmtQty(e.qty) : '1', note: e ? e.note || '' : '' };
}
// Переключение размера: введённое для прежнего размера запоминается до закрытия окна,
// для нового берётся черновик, а если его нет — сохранённое в списке
function switchSize(drafts, from, form, to, items, pid) {
  const next = Object.assign({}, drafts, { [from]: form });
  return { drafts: next, form: next[to] || formFor(items, pid, to) };
}
// Главная кнопка и «Убрать из списка» (таблица ТР-1 чек-листа)
function qtyForm(part, items, size, qtyText, readOnly) {
  const existing = !!findItem(items, part.id, size);
  const n = parseQty(qtyText, part.unit);
  return {
    existing, n,
    canSave: !readOnly && n > 0,
    label: (existing ? 'Сохранить' : 'Добавить в список') + ' · ' + fmtQty(n) + ' ' + part.unit,
  };
}

/* ---------- Каталог ---------- */
// Строка каталога: какие размеры подсвечены и что написать справа (таблица ТР-3 чек-листа)
function rowState(part, items) {
  const got = items.filter(i => i.pid === part.id);
  const single = got.length === 1 && part.sizes.length === 1 ? got[0] : null;
  return {
    onSizes: new Set(got.map(g => g.size)),
    badge: !got.length ? null : single ? fmtQty(single.qty) + ' ' + part.unit : got.length + ' поз.',
  };
}

/* ---------- Изменение списка ---------- */
// Добавить, изменить или убрать (qty ≤ 0) позицию. Изменённая позиция остаётся на своём месте
// в группе (поле at не меняется) и сохраняет примечание, если новое не передано (кнопки «+» и «−»)
function applyItem(items, entry, qty, note, now) {
  const key = keyOf(entry.pid, entry.size);
  const old = items.find(i => i.key === key);
  const rest = items.filter(i => i.key !== key);
  if (qty <= 0) return rest;
  const item = Object.assign({}, old || {}, entry, { key, qty, at: old ? old.at : now });
  if (note !== undefined) item.note = note;
  return rest.concat(item);
}
// «Вернуть» после удаления: позиция встаёт на прежнее место с прежними количеством и примечанием.
// index — где она стояла в списке: важно, когда у соседей одинаковое время добавления (at), иначе
// при равенстве они поменялись бы местами. Если такую же позицию уже добавили заново — дубля не будет
function restoreItem(items, removed, index) {
  if (items.some(i => i.key === removed.key)) return items;
  const at = index == null ? items.length : Math.max(0, Math.min(index, items.length));
  return items.slice(0, at).concat(removed, items.slice(at));
}
// Кнопки «+» и «−» в списке: шаг 1 для любых единиц, не меньше нуля, не больше предела
const stepQty = (item, delta) => parseQty(Math.max(0, item.qty + delta), item.unit);
// Изменённый объект поднимается в начало: список объектов идёт от последнего изменённого
function bumpJob(list, id, fn, now) {
  const j = list.find(x => x.id === id);
  if (!j) return list;
  return [Object.assign({}, fn(j), { updatedAt: now })].concat(list.filter(x => x.id !== id));
}

/* ---------- Хранение и резервная копия ---------- */
// Размеры, переименованные в каталоге: старый → новый. Раньше в каталоге были только ВР-варианты
const SIZE_RENAMES = {
  'ppr-wall': { '20×½"': '20×½" ВР' },
  'ppr-un': { '20×½"': '20×½" ВР', '25×¾"': '25×¾" ВР', '32×1"': '32×1" ВР' },
};
// Приводит позиции к текущему каталогу: новые размеры, актуальные название/единица/группа.
// Совпавшие после переименования позиции складываются в одну.
function normalizeItems(items) {
  const out = [];
  const byKey = new Map();
  (Array.isArray(items) ? items : []).forEach(i => {
    const part = PART_BY_ID[i.pid];
    if (!part) { out.push(i); return; }
    const size = (SIZE_RENAMES[i.pid] && SIZE_RENAMES[i.pid][i.size]) || i.size;
    const key = keyOf(i.pid, size);
    const ni = Object.assign({}, i, { key, size, name: part.name, unit: part.unit, group: part.group });
    const prev = byKey.get(key);
    if (prev) prev.qty = parseQty(prev.qty + ni.qty, prev.unit);
    else { byKey.set(key, ni); out.push(ni); }
  });
  return out;
}
const normalizeJob = j => Object.assign({ items: [], works: [] }, j, {
  items: normalizeItems(j.items),
  works: Array.isArray(j.works) ? j.works : [],
});
// Объекты из файла копии или null, если это не копия Сантехкомплекта
function backupJobs(data) {
  const incoming = Array.isArray(data) ? data : data && data.jobs;
  if (!Array.isArray(incoming) || incoming.some(j => !j || !j.id || !j.name || !Array.isArray(j.items))) return null;
  return incoming;
}
// Слияние по объекту: из копии берём новый объект или более свежую версию; дублей не бывает
function mergeJobs(current, incoming) {
  const map = new Map(current.map(j => [j.id, j]));
  let added = 0, updated = 0;
  incoming.map(normalizeJob).forEach(j => {
    const cur = map.get(j.id);
    if (!cur) { added++; map.set(j.id, j); }
    else if ((j.updatedAt || 0) >= (cur.updatedAt || 0)) { if ((j.updatedAt || 0) > (cur.updatedAt || 0)) updated++; map.set(j.id, j); }
  });
  return { jobs: Array.from(map.values()).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)), added, updated };
}

/* ---------- Работы: свой прайс мастера и работы в объекте ---------- */
// В объекте работы лежат отдельно от деталей (job.works), поэтому заявка в магазин, Excel и метки
// каталога их не видят. Строка работы устроена как позиция списка (pid «w:…», без размера),
// так что для неё работают те же applyItem, restoreItem и stepQty
const WORK_UNITS = ['шт', 'точка', 'м', 'компл', 'час'];
const MAX_PRICE = 9999999;
const w = (n, name, unit) => ({ id: 'w-' + String(n).padStart(2, '0'), name, unit, price: null, updatedAt: 0 });
// Стартовый прайс: типовые работы без цен — мастер проставит свои и удалит лишнее
const DEFAULT_WORKS = [
  w(2, 'Установка смесителя', 'шт'), w(3, 'Замена смесителя', 'шт'),
  w(4, 'Замена сифона', 'шт'), w(5, 'Установка раковины', 'шт'), w(6, 'Установка унитаза', 'шт'),
  w(7, 'Установка инсталляции с унитазом', 'компл'), w(8, 'Установка ванны', 'шт'), w(9, 'Установка душевой кабины', 'шт'),
  w(10, 'Подключение стиральной машины', 'шт'), w(11, 'Подключение посудомоечной машины', 'шт'),
  w(12, 'Установка водонагревателя', 'шт'), w(13, 'Установка счётчика воды', 'шт'), w(14, 'Замена шарового крана', 'шт'),
  w(15, 'Монтаж радиатора отопления', 'шт'), w(16, 'Монтаж полотенцесушителя', 'шт'),
  w(17, 'Разводка водоснабжения', 'точка'), w(18, 'Разводка канализации', 'точка'), w(19, 'Монтаж трубы', 'м'),
  w(20, 'Прочистка канализации', 'шт'), w(21, 'Почасовая работа', 'час'),
];
// Знак валюты — в одном месте: его же показывают подписи полей цены
const CURRENCY = '$';
// Цена: пусто, 0 или мусор — null («договорная»); пробелы и знаки валюты допускаются; до центов
function parsePrice(s) {
  const t = String(s == null ? '' : s).replace(/\s|\$|₽|руб\.?/gi, '').replace(',', '.').replace(/[^\d.]/g, '');
  const n = parseFloat(t);
  if (!isFinite(n) || n <= 0) return null;
  return Math.min(Math.round(n * 100) / 100, MAX_PRICE);
}
// «$1 500», «$1 500,50» — знак перед числом, тысячи через неразрывный пробел; null — «договорная»
function fmtMoney(n) {
  if (n == null) return 'договорная';
  const [i, f] = String(Math.round(n * 100) / 100).split('.');
  return CURRENCY + i.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + (f ? ',' + f.padEnd(2, '0') : '');
}
// Цена в поле ввода: 1500 → «1500», 1500.5 → «1500,5»; null → пусто
const priceInput = n => (n == null ? '' : String(n).replace('.', ','));
// Строка работы для объекта из записи прайса
const workEntry = (work, price) => ({ pid: 'w:' + work.id, wid: work.id, name: work.name, size: '', unit: work.unit, price });
const lineSum = i => (i.price == null ? null : Math.round(i.qty * i.price * 100) / 100);
// Итог по работам объекта: сумма тех, где цена есть, и сколько договорных
function worksTotal(works) {
  let sum = 0, unpriced = 0;
  (works || []).forEach(i => { const s = lineSum(i); if (s == null) unpriced++; else sum += s; });
  return { sum: Math.round(sum * 100) / 100, unpriced, count: (works || []).length };
}
// «2 шт × $1 500 = $3 000» или «1 шт, цена договорная»
const workLine = i => fmtQty(i.qty) + ' ' + i.unit + (i.price == null ? ', цена договорная' : ' × ' + fmtMoney(i.price) + ' = ' + fmtMoney(lineSum(i)));
// Поиск по своему прайсу: все слова запроса, без разницы е/ё и регистра
const fold = s => String(s).toLowerCase().replace(/ё/g, 'е');
function filterWorks(list, q) {
  const words = fold(q).split(/\s+/).filter(Boolean);
  return words.length ? list.filter(x => words.every(wd => fold(x.name).includes(wd))) : list;
}
// Запись прайса из копии: только с id, названием и известной единицей
const isWork = x => x && x.id && typeof x.name === 'string' && x.name.trim() && WORK_UNITS.includes(x.unit);
// Слияние прайса из резервной копии: новые работы добавляются, совпавшие по id — более свежая версия
function mergeWorkLists(current, incoming) {
  const map = new Map(current.map(x => [x.id, x]));
  let added = 0, updated = 0;
  (Array.isArray(incoming) ? incoming : []).filter(isWork).forEach(x => {
    const cur = map.get(x.id);
    const item = Object.assign({}, x, { price: x.price == null ? null : parsePrice(x.price) });
    if (!cur) { added++; map.set(x.id, item); }
    else if ((x.updatedAt || 0) > (cur.updatedAt || 0)) { updated++; map.set(x.id, item); }
  });
  return { list: Array.from(map.values()), added, updated };
}
// Текст для клиента: работы с ценами и итог (детали — в заявке магазину, сюда не попадают)
function buildClientText(job, date) {
  const works = job.works || [];
  const t = worksTotal(works);
  const lines = ['Объект: ' + job.name];
  if (job.address) lines.push('Адрес: ' + job.address);
  lines.push('Дата: ' + date, '', 'РАБОТЫ');
  works.slice().sort((a, b) => (a.at || 0) - (b.at || 0)).forEach(i => lines.push('• ' + i.name + ' — ' + workLine(i) + (i.note ? ' (' + i.note + ')' : '')));
  lines.push('');
  if (t.unpriced === t.count) lines.push('Стоимость работ — договорная');
  else lines.push('Итого за работы: ' + fmtMoney(t.sum) + (t.unpriced ? ' (без договорных: ' + t.unpriced + ')' : ''));
  return lines.join('\n');
}
// Свой прайс текстом: «• Замена смесителя — $1 500 / шт»
function buildPriceListText(list) {
  return ['Прайс на работы', ''].concat(list.map(x => '• ' + x.name + ' — ' + (x.price == null ? 'договорная' : fmtMoney(x.price) + ' / ' + x.unit))).join('\n');
}

/* ---------- Пин-код при входе ---------- */
// «Замок от детей»: не даёт случайно открыть списки. Не защита от взрослого с компьютером —
// данные всё равно лежат в браузере. Сам пин не хранится: только отпечаток PBKDF2 со случайной солью
const PIN_LEN = 4;
const PIN_LOCK_AFTER = 10 * 60 * 1000; // свернули дольше — при возврате снова пин
const PIN_MAX_TRIES = 5;               // столько неверных подряд — и пауза
const PIN_PAUSE = 30 * 1000;
const PIN_ITER = 100000;
const isPin = s => new RegExp('^\\d{' + PIN_LEN + '}$').test(String(s));
// Запереть ли при запуске: пин есть, а в этом сеансе ещё не открывали — или открыли, но свернули надолго
function pinLockedOnStart({ hasPin, unlocked, hiddenAt, now }) {
  if (!hasPin) return false;
  if (!unlocked) return true;
  return hiddenAt != null && now - hiddenAt >= PIN_LOCK_AFTER;
}
const pinLockedOnReturn = (hiddenAt, now) => hiddenAt != null && now - hiddenAt >= PIN_LOCK_AFTER;
// Неверный пин: считаем попытки; на пятой — пауза, счётчик с нуля
function pinFail(tries, now) {
  const fails = ((tries && tries.fails) || 0) + 1;
  return fails >= PIN_MAX_TRIES ? { fails: 0, until: now + PIN_PAUSE } : { fails, until: (tries && tries.until) || 0 };
}
// Сколько секунд ещё ждать (0 — можно вводить)
const pinWait = (tries, now) => Math.max(0, Math.ceil((((tries && tries.until) || 0) - now) / 1000));
const toHex = buf => Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, '0')).join('');
const newSalt = () => toHex(globalThis.crypto.getRandomValues(new Uint8Array(16)));
async function hashPin(pin, salt) {
  const enc = new TextEncoder();
  const key = await globalThis.crypto.subtle.importKey('raw', enc.encode(String(pin)), 'PBKDF2', false, ['deriveBits']);
  const bits = await globalThis.crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations: PIN_ITER }, key, 256);
  return toHex(bits);
}
// Запись для хранения: { v, salt, hash } — без самого пина
async function makePinRecord(pin, salt) {
  const s = salt || newSalt();
  return { v: 1, salt: s, hash: await hashPin(pin, s) };
}
async function checkPin(pin, record) {
  if (!record || !isPin(pin)) return false;
  return (await hashPin(pin, record.salt)) === record.hash;
}

/* ---------- Текст для мессенджера ---------- */
function buildText(job, date) {
  const lines = ['Объект: ' + job.name];
  if (job.address) lines.push('Адрес: ' + job.address);
  lines.push('Дата: ' + date, '');
  sortedGroups(job.items).forEach(g => {
    lines.push(g.name.toUpperCase());
    g.items.forEach(i => lines.push('• ' + fullName(i) + ' — ' + fmtQty(i.qty) + ' ' + i.unit + (i.note ? ' (' + i.note + ')' : '')));
    lines.push('');
  });
  lines.push('Всего позиций: ' + job.items.length);
  return lines.join('\n');
}

return {
  CATALOG, OWN, GROUP_ORDER, GROUP_NAME, PARTS, PART_BY_ID, UNITS, INT_UNITS, PRESETS, MAX_QTY, SIZE_RENAMES,
  keyOf, fmtQty, parseQty, plural, fullName, findItem, groupOf, sortedGroups,
  initialSize, formFor, switchSize, qtyForm, rowState,
  applyItem, restoreItem, stepQty, bumpJob,
  WORK_UNITS, DEFAULT_WORKS, MAX_PRICE, CURRENCY, parsePrice, fmtMoney, priceInput, workEntry, lineSum, worksTotal, workLine,
  filterWorks, mergeWorkLists, buildClientText, buildPriceListText,
  PIN_LEN, PIN_LOCK_AFTER, PIN_MAX_TRIES, PIN_PAUSE, isPin, pinLockedOnStart, pinLockedOnReturn, pinFail, pinWait,
  hashPin, makePinRecord, checkPin,
  normalizeItems, normalizeJob, backupJobs, mergeJobs, buildText,
};
});
