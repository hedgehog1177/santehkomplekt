(function () {
'use strict';
const { useState, useEffect, useMemo, useRef } = React;
const html = htm.bind(React.createElement);
// Каталог и правила работы со списком — в core.js (там же их проверяют тесты)
const {
  CATALOG, OWN, GROUP_ORDER, GROUP_NAME, PARTS, PART_BY_ID, UNITS, PRESETS,
  keyOf, fmtQty, parseQty, plural, fullName, findItem, groupOf, sortedGroups,
  initialSize, formFor, switchSize, qtyForm, rowState,
  applyItem, restoreItem, stepQty, bumpJob, normalizeJob, backupJobs, mergeJobs,
} = SantehCore;

const fuse = new Fuse(PARTS.map(x => Object.assign({}, x, { sizesText: x.sizes.join(' '), groupName: GROUP_NAME[x.group] })), {
  keys: [{ name: 'name', weight: 3 }, { name: 'alias', weight: 2 }, { name: 'sizesText', weight: 1 }, { name: 'groupName', weight: 1 }, { name: 'spec', weight: 0.5 }],
  threshold: 0.38, ignoreLocation: true, minMatchCharLength: 2,
});
// Поиск включается с 2 символов или с одного знака дроби дюймов
const FRACTION = /^[½¾¼⅜⅝⅞]$/;
const isSearchQuery = q => q.length >= 2 || FRACTION.test(q);
const SEARCH_LIMIT = 40;
const UNDO_MS = 5000; // сколько держится «Вернуть» после удаления позиции

/* ---------- Утилиты ---------- */
const uid = () => (window.crypto && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2, 10));
// Прокрутка к группе каталога так, чтобы её заголовок оказался сразу под липкой шапкой (высота шапки меняется)
function scrollToGroup(id) {
  const el = document.getElementById('g-' + id);
  if (!el) return;
  const top = document.querySelector('.top');
  const offset = (top ? top.getBoundingClientRect().bottom : 0) + 8;
  window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - offset, behavior: 'smooth' });
}
// Размер для экрана: знаки дробей дюйма (½ ¾…) крупнее и обычным шрифтом — в моноширинном они сжаты в одну клетку
const sizeView = s => String(s).split(/([½¾¼⅜⅝⅞])/).map((p, k) => (k % 2 ? html`<span class="frac" key=${k}>${p}</span>` : p));
const today = () => new Date().toLocaleDateString('ru-RU');
const lsGet = k => Platform.storage.get(k);
const lsSet = (k, v) => Platform.storage.set(k, v);

/* ---------- Иконки ---------- */
const IconSearch = () => html`<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>`;
const IconChev = () => html`<svg class="chev" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m7 10 5 5 5-5"/></svg>`;
const IconBook = () => html`<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h6v14H4zM14 5h6v14h-6z"/><path d="M6 9h2M16 9h2M6 12h2M16 12h2"/></svg>`;
const IconList = () => html`<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M9 6h11M9 12h11M9 18h11"/><path d="m3.5 6 1 1 2-2M3.5 12l1 1 2-2M3.5 18l1 1 2-2"/></svg>`;

/* ---------- Мелкие компоненты ---------- */
function Sheet({ onClose, label, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    if (ref.current) ref.current.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, []);
  return html`<div class="scrim" onClick=${e => { if (e.target === e.currentTarget) onClose(); }}>
    <div class="sheet" role="dialog" aria-modal="true" aria-label=${label} tabIndex="-1" ref=${ref}>
      <div class="grab"></div>
      ${children}
    </div>
  </div>`;
}

function ConfirmButton({ label, confirmLabel, onConfirm, className, disabled }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => { if (!armed) return; const t = setTimeout(() => setArmed(false), 3500); return () => clearTimeout(t); }, [armed]);
  return html`<button type="button" disabled=${disabled} className=${'btn danger ' + (armed ? 'armed ' : '') + (className || '')}
    onClick=${() => { if (armed) { setArmed(false); onConfirm(); } else setArmed(true); }}>${armed ? confirmLabel : label}</button>`;
}

function QtyInput({ value, onChange, unit }) {
  const n = parseQty(value, unit);
  const step = 1;
  return html`<div class="big">
    <button type="button" aria-label="Меньше" onClick=${() => onChange(fmtQty(Math.max(0, n - step)))}>−</button>
    <label class="val">
      <input id="qty-input" inputMode="decimal" enterKeyHint="done" autoComplete="off" aria-label="Количество" value=${value}
        onFocus=${e => e.target.select()} onChange=${e => onChange(e.target.value)} />
      <span class="unit">${unit}</span>
    </label>
    <button type="button" aria-label="Больше" onClick=${() => onChange(fmtQty(n + step))}>+</button>
  </div>
  <div class="presets" aria-label="Быстрый выбор">
    ${(PRESETS[unit] || PRESETS['шт']).map(v => html`<button type="button" key=${v} onClick=${() => onChange(fmtQty(v))}>${v}</button>`)}
  </div>`;
}

/* ---------- Окно выбора количества ---------- */
function QtySheet({ part, job, lockedSize, onClose, onSave, readOnly }) {
  const sizes = lockedSize !== undefined ? [lockedSize] : part.sizes;
  const [start] = useState(() => { const s = initialSize(part, job.items, lockedSize); return { size: s, form: formFor(job.items, part.id, s) }; });
  const [size, setSize] = useState(start.size);
  const [qty, setQty] = useState(start.form.qty);
  const [note, setNote] = useState(start.form.note);
  // Введённое, но не сохранённое по каждому размеру — чтобы переключение размеров его не сбрасывало
  const drafts = useRef({});
  const pick = s => {
    const r = switchSize(drafts.current, size, { qty, note }, s, job.items, part.id);
    drafts.current = r.drafts;
    setSize(s); setQty(r.form.qty); setNote(r.form.note);
  };
  const f = qtyForm(part, job.items, size, qty, readOnly);
  const save = () => onSave({ pid: part.id, name: part.name, size, unit: part.unit, group: part.group }, f.n, note.trim());
  return html`<${Sheet} onClose=${onClose} label=${part.name}><form onSubmit=${e => { e.preventDefault(); if (f.canSave) save(); }}>
    <h3>${part.name}</h3>
    ${part.spec ? html`<div class="sub">${part.spec}</div>` : null}
    ${sizes.length > 1 || sizes[0] ? html`<div class="field">
      <span class="lbl">Размер</span>
      <div class="sizes">${sizes.map(s => { const e = findItem(job.items, part.id, s); return html`<button type="button" key=${s} className="size" aria-pressed=${s === size}
        onClick=${() => pick(s)}>${sizeView(s)}${e ? html`<span class="dot">${fmtQty(e.qty)}</span>` : null}</button>`; })}</div>
    </div>` : null}
    <div class="field"><span class="lbl">Количество</span><${QtyInput} value=${qty} onChange=${setQty} unit=${part.unit} /></div>
    <div class="field"><label class="lbl" htmlFor="qty-note">Примечание</label>
      <input id="qty-note" enterKeyHint="done" placeholder="Например: хром, белый, производитель" value=${note} onChange=${e => setNote(e.target.value)} /></div>
    <div class="sheet-actions">
      <button type="submit" className="btn primary block" disabled=${!f.canSave}>${f.label}</button>
      ${f.existing ? html`<button type="button" className="btn danger block" disabled=${readOnly} onClick=${() => onSave({ pid: part.id, size }, 0)}>Убрать из списка</button>` : null}
    </div>
  </form><//>`;
}

/* ---------- Своя позиция ---------- */
function OwnSheet({ onClose, onSave, readOnly, initialName }) {
  const [name, setName] = useState(initialName || '');
  const [size, setSize] = useState('');
  const [unit, setUnit] = useState('шт');
  const [group, setGroup] = useState(OWN.id);
  const [qty, setQty] = useState('1');
  const [note, setNote] = useState('');
  const n = parseQty(qty, unit);
  const ok = name.trim() && n > 0 && !readOnly;
  const save = () => onSave({ pid: 'own-' + uid(), name: name.trim(), size: size.trim(), unit, group }, n, note.trim());
  return html`<${Sheet} onClose=${onClose} label="Своя позиция"><form onSubmit=${e => { e.preventDefault(); if (ok) save(); }}>
    <h3>Своя позиция</h3>
    <div class="sub">Для того, чего нет в каталоге</div>
    <div class="field"><label class="lbl" htmlFor="own-name">Наименование</label>
      <input id="own-name" enterKeyHint="done" value=${name} onChange=${e => setName(e.target.value)} placeholder="Например: Насос циркуляционный 25-40" /></div>
    <div class="two">
      <div class="field"><label class="lbl" htmlFor="own-size">Размер</label>
        <input id="own-size" enterKeyHint="done" value=${size} onChange=${e => setSize(e.target.value)} placeholder=${'½", Ø20…'} /></div>
      <div class="field"><label class="lbl" htmlFor="own-unit">Ед. изм.</label>
        <select id="own-unit" value=${unit} onChange=${e => setUnit(e.target.value)}>${UNITS.map(u => html`<option key=${u} value=${u}>${u}</option>`)}</select></div>
    </div>
    <div class="field"><label class="lbl" htmlFor="own-group">Группа</label>
      <select id="own-group" value=${group} onChange=${e => setGroup(e.target.value)}>
        ${GROUP_ORDER.map(g => html`<option key=${g} value=${g}>${GROUP_NAME[g]}</option>`)}
      </select></div>
    <div class="field"><span class="lbl">Количество</span><${QtyInput} value=${qty} onChange=${setQty} unit=${unit} /></div>
    <div class="field"><label class="lbl" htmlFor="own-note">Примечание</label>
      <input id="own-note" enterKeyHint="done" value=${note} onChange=${e => setNote(e.target.value)} /></div>
    <button type="submit" className="btn primary block" disabled=${!ok}>Добавить в список · ${fmtQty(n)} ${unit}</button>
  </form><//>`;
}

/* ---------- Объекты ---------- */
// Версия, которая реально работает на устройстве (по офлайн-кэшу) — для поддержки: «какая у тебя версия?»
function AppVersion() {
  const [v, setV] = useState(null);
  useEffect(() => { let alive = true; Platform.getVersion().then(x => { if (alive) setV(x); }); return () => { alive = false; }; }, []);
  return v ? html`<p class="app-version">${v}</p>` : null;
}

// Тема оформления: по умолчанию тёмная, выбор запоминается на телефоне (theme.js)
function ThemePicker() {
  const [mode, setMode] = useState(() => SantehTheme.read());
  return html`<div class="field">
    <span class="lbl" id="theme-lbl">Тема</span>
    <div class="sizes theme-pick" role="group" aria-labelledby="theme-lbl">
      ${SantehTheme.MODES.map(m => html`<button type="button" key=${m.id} className="size" aria-pressed=${m.id === mode}
        onClick=${() => setMode(SantehTheme.set(m.id))}>${m.label}</button>`)}
    </div>
  </div>`;
}

function RestoreButton({ onRestore }) {
  return html`<label className="btn" style=${{ justifyContent: 'center' }}>Загрузить из файла
    <input id="restore-file" type="file" accept=".json,application/json" hidden onChange=${e => { const f = e.target.files[0]; e.target.value = ''; if (f) onRestore(f); }} /></label>`;
}

function JobsSheet({ jobs, currentId, onPick, onCreate, onRename, onDelete, onClose, readOnly, onBackup, onRestore }) {
  const cur = jobs.find(j => j.id === currentId);
  const [mode, setMode] = useState(jobs.length ? 'list' : 'new');
  const [name, setName] = useState(mode === 'edit' && cur ? cur.name : '');
  const [addr, setAddr] = useState('');
  const startEdit = () => { setName(cur.name); setAddr(cur.address || ''); setMode('edit'); };
  if (mode !== 'list') {
    const isEdit = mode === 'edit';
    const ok = name.trim() && !readOnly;
    const submit = () => { isEdit ? onRename(cur.id, name.trim(), addr.trim()) : onCreate(name.trim(), addr.trim()); };
    return html`<${Sheet} onClose=${onClose} label=${isEdit ? 'Объект' : 'Новый объект'}><form onSubmit=${e => { e.preventDefault(); if (ok) submit(); }}>
      <h3>${isEdit ? 'Данные объекта' : 'Новый объект'}</h3>
      <div class="field"><label class="lbl" htmlFor="job-name">Название</label>
        <input id="job-name" enterKeyHint="done" value=${name} onChange=${e => setName(e.target.value)} placeholder="Кв. 45, санузел и кухня" /></div>
      <div class="field"><label class="lbl" htmlFor="job-addr">Адрес и контакт</label>
        <input id="job-addr" enterKeyHint="done" value=${addr} onChange=${e => setAddr(e.target.value)} placeholder="ул. Садовая, 12 — Ирина, +7…" /></div>
      <div class="sheet-actions">
        <button type="submit" className="btn primary block" disabled=${!ok}>${isEdit ? 'Сохранить' : 'Создать объект'}</button>
        ${jobs.length ? html`<button type="button" className="btn block" onClick=${() => setMode('list')}>Назад к объектам</button>` : null}
        ${isEdit ? html`<${ConfirmButton} className="block" disabled=${readOnly} label="Удалить объект" confirmLabel="Нажмите ещё раз, чтобы удалить объект и список" onConfirm=${() => onDelete(cur.id)} />` : null}
      </div>
      ${!jobs.length ? html`<div class="field">
        <span class="lbl">Есть резервная копия?</span>
        <${RestoreButton} onRestore=${onRestore} />
        <span class="sub" style=${{ marginTop: 0, fontSize: '13px' }}>Загрузите файл копии — объекты и списки вернутся.</span>
      </div>` : null}
    </form><//>`;
  }
  return html`<${Sheet} onClose=${onClose} label="Объекты">
    <h3>Объекты</h3>
    <div class="jobs">
      ${jobs.map(j => html`<button type="button" key=${j.id} className="jrow" aria-current=${j.id === currentId} onClick=${() => onPick(j.id)}>
        <span class="body"><span class="name">${j.name}</span>
          <span class="meta">${j.address ? j.address + ' · ' : ''}${j.items.length} ${plural(j.items.length, 'позиция', 'позиции', 'позиций')}</span></span>
        ${j.id === currentId ? html`<span class="badge">открыт</span>` : null}
      </button>`)}
    </div>
    <div class="two">
      <button type="button" className="btn" disabled=${!cur || readOnly} onClick=${startEdit}>Изменить текущий</button>
      <button type="button" className="btn primary" disabled=${readOnly} onClick=${() => { setName(''); setAddr(''); setMode('new'); }}>+ Новый объект</button>
    </div>
    <div class="field">
      <span class="lbl">Резервная копия</span>
      <div class="two">
        <button type="button" className="btn" disabled=${!jobs.length} onClick=${onBackup}>Сохранить в файл</button>
        <${RestoreButton} onRestore=${onRestore} />
      </div>
      <span class="sub" style=${{ marginTop: 0, fontSize: '13px' }}>Списки хранятся только на этом телефоне. Файл копии можно перенести на другой телефон.</span>
    </div>
    <${ThemePicker} />
    <a className="btn block" href="help.html">Как пользоваться приложением</a>
    <${AppVersion} />
  <//>`;
}

/* ---------- Текст для мессенджера ---------- */
const buildText = job => SantehCore.buildText(job, today());
function TextSheet({ job, onClose }) {
  const ref = useRef(null);
  useEffect(() => { if (ref.current) { ref.current.focus(); ref.current.select(); } }, []);
  return html`<${Sheet} onClose=${onClose} label="Текст списка">
    <h3>Текст списка</h3>
    <div class="sub">Буфер обмена недоступен. Текст выделен — скопируйте его вручную.</div>
    <textarea ref=${ref} className="textout" readOnly value=${buildText(job)}></textarea>
  <//>`;
}

/* ---------- Каталог ---------- */
function CatalogView({ job, query, onPick, onOwn }) {
  const rowFor = part => {
    const r = rowState(part, job.items);
    return html`<button type="button" key=${part.id} className="row" onClick=${() => onPick(part)}>
      <span class="body">
        <span class="name">${part.name}</span>
        ${part.sizes[0] ? html`<span class="marks">${part.sizes.map(s => html`<span key=${s} className=${'mark' + (r.onSizes.has(s) ? ' on' : '')}>${sizeView(s)}</span>`)}</span>` : (part.spec ? html`<span class="spec">${part.spec}</span>` : null)}
      </span>
      ${r.badge ? html`<span class="badge">${r.badge}</span>` : html`<span class="plus" aria-hidden="true">+</span>`}
    </button>`;
  };
  const q = query.trim();
  if (isSearchQuery(q)) {
    // Одиночная дробь (½, ¾…) — точный отбор по размерам: нечёткий поиск по одному символу не работает
    const all = FRACTION.test(q)
      ? PARTS.filter(x => x.sizes.some(s => s.includes(q)))
      : fuse.search(q).map(r => PART_BY_ID[r.item.id]);
    const res = all.slice(0, SEARCH_LIMIT);
    const found = !res.length ? 'В каталоге ничего не нашлось.'
      : all.length > res.length ? `Показаны первые ${res.length} из ${all.length} — уточните запрос` : 'Найдено: ' + res.length;
    return html`<div>
      <p class="found">${found}</p>
      ${res.length ? html`<div class="card" style=${{ marginTop: '8px' }}>${res.map(rowFor)}</div>` : null}
      <button type="button" className="add-own" onClick=${() => onOwn(q)}>+ Добавить «${q}» как свою позицию</button>
    </div>`;
  }
  return html`<div>
    ${CATALOG.map(g => html`<section class="group" id=${'g-' + g.id} key=${g.id}>
      <div class="group-h"><h2>${g.name}</h2><span>${g.items.length}</span></div>
      <div class="card">${g.items.map(rowFor)}</div>
    </section>`)}
    <button type="button" className="add-own" onClick=${() => onOwn('')}>+ Своя позиция, которой нет в каталоге</button>
  </div>`;
}

/* ---------- Список ---------- */
function ListView({ job, onEdit, onStep, onClear, onCopy, onShare, onExcel, canExcel, readOnly, goCatalog }) {
  if (!job.items.length) {
    return html`<div class="empty">
      <h2>Список пока пуст</h2>
      <p>Откройте каталог, нажмите на нужную деталь и выберите количество. Позиция появится здесь, сгруппированная по разделам.</p>
      <button type="button" className="btn primary" onClick=${goCatalog}>Открыть каталог</button>
      <a className="btn" href="help.html">Как пользоваться приложением</a>
    </div>`;
  }
  return html`<div>
    <div class="summary">
      <h1>${job.name}</h1>
      <span class="count">${job.items.length} ${plural(job.items.length, 'позиция', 'позиции', 'позиций')}</span>
    </div>
    <div class="actions">
      ${onShare ? html`<button type="button" className="btn primary" onClick=${onShare}>Отправить</button>` : null}
      <button type="button" className=${onShare ? 'btn' : 'btn primary'} onClick=${onCopy}>Копировать текстом</button>
      ${canExcel ? html`<button type="button" className="btn" onClick=${onExcel}>Excel</button>` : null}
      <${ConfirmButton} label="Очистить" confirmLabel="Точно очистить?" disabled=${readOnly} onConfirm=${onClear} />
    </div>
    ${sortedGroups(job.items).map(g => html`<section class="group" key=${g.id}>
      <div class="group-h"><h2>${g.name}</h2><span>${g.items.length}</span></div>
      <div class="card">${g.items.map(i => html`<div class="lrow" key=${i.key}>
        <button type="button" className="body" onClick=${() => onEdit(i)}>
          <span class="name">${i.name}${i.size ? html` <span class="mark">${sizeView(i.size)}</span>` : null}</span>
          ${i.note ? html`<span class="note">${i.note}</span>` : null}
        </button>
        <div class="step">
          <button type="button" aria-label=${'Уменьшить: ' + fullName(i)} disabled=${readOnly} onClick=${() => onStep(i, -1)}>−</button>
          <span class="v">${fmtQty(i.qty)}<small>${i.unit}</small></span>
          <button type="button" aria-label=${'Увеличить: ' + fullName(i)} disabled=${readOnly} onClick=${() => onStep(i, 1)}>+</button>
        </div>
      </div>`)}</div>
    </section>`)}
  </div>`;
}


/* ---------- Хранение на устройстве ---------- */
const JOBS_KEY = 'santeh.jobs.v1';
function loadJobs() {
  try {
    const list = JSON.parse(lsGet(JOBS_KEY) || 'null');
    if (Array.isArray(list)) return list.map(normalizeJob);
  } catch (e) { /* повреждённые данные — начнём с примера */ }
  return null;
}
const exampleJob = () => SantehCore.exampleJob(Date.now());
const safeName = s => s.replace(/[\\/:*?"<>|]+/g, ' ').trim().slice(0, 120);

/* ---------- Приложение ---------- */
function App() {
  const [jobs, setJobs] = useState(() => loadJobs() || [exampleJob()]);
  const [currentId, setCurrentId] = useState(lsGet('santeh.current'));
  const [tab, setTab] = useState(lsGet('santeh.tab') === 'list' ? 'list' : 'catalog');
  const [query, setQuery] = useState('');
  const [sheet, setSheet] = useState(null);
  const [toast, setToast] = useState(null);
  const [canInstall, setCanInstall] = useState(false);
  const toastTimer = useRef(0);
  // Уведомление; с undo — с кнопкой «Вернуть» и держится дольше, пока идёт полоска-таймер
  const say = (text, undo) => {
    setToast({ text, undo, id: Date.now() });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), undo ? UNDO_MS : 2600);
  };

  useEffect(() => {
    const s = JSON.stringify(jobs);
    if (lsGet(JOBS_KEY) === s) return; // уже сохранено (например, пришло из другой вкладки)
    if (!lsSet(JOBS_KEY, s)) say('Не удалось сохранить: память браузера недоступна');
  }, [jobs]);
  // Приложение открыто ещё в одной вкладке: берём её изменения, чтобы не затереть их своими
  useEffect(() => Platform.storage.onExternalChange(JOBS_KEY, () => { const l = loadJobs(); if (l) setJobs(l); }), []);
  useEffect(() => {
    Platform.requestPersistence();
    if (Platform.wasUpdated()) say('Приложение обновлено до новой версии');
    return Platform.onInstallChange(setCanInstall);
  }, []);
  // Кнопка «Назад» закрывает открытое окно, а не приложение
  useEffect(() => { Platform.setBackHandler(sheet ? () => setSheet(null) : null); }, [!!sheet]);

  const job = jobs.find(j => j.id === currentId) || jobs[0] || null;
  useEffect(() => { if (job) lsSet('santeh.current', job.id); }, [job && job.id]);
  useEffect(() => { lsSet('santeh.tab', tab); window.scrollTo(0, 0); }, [tab]);

  // Изменённый объект поднимается в начало: список объектов идёт от последнего изменённого
  const updateJob = (id, fn) => setJobs(list => bumpJob(list, id, fn, Date.now()));
  function setItem(entry, qty, note) {
    if (!job) return;
    updateJob(job.id, j => Object.assign({}, j, { items: applyItem(j.items, entry, qty, note, Date.now()) }));
  }
  function createJob(name, address) {
    const nj = { id: uid(), name, address, items: [], createdAt: Date.now(), updatedAt: Date.now() };
    setJobs(list => [nj].concat(list));
    setCurrentId(nj.id); setSheet(null); setTab('catalog');
    say('Объект создан: ' + name);
  }
  function deleteJob(id) {
    setJobs(list => list.filter(j => j.id !== id));
    setSheet(null); say('Объект удалён');
  }

  async function copyText() {
    if (await Platform.copyText(buildText(job))) say('Список скопирован — вставьте в мессенджер');
    else setSheet({ type: 'text' });
  }
  async function shareText() {
    const r = await Platform.shareText('Запчасти — ' + job.name, buildText(job));
    if (r === 'unsupported') copyText();
  }
  async function offerFile(blob, filename, title, savedMsg) {
    try {
      const r = await Platform.saveFile(blob, filename, title);
      if (r === 'saved') say(savedMsg);
    } catch (e) {
      say('Не удалось сохранить файл');
    }
  }
  async function exportExcel() {
    const rows = [['Объект', job.name], ['Адрес', job.address || ''], ['Дата', today()], [],
      ['№', 'Группа', 'Наименование', 'Размер', 'Кол-во', 'Ед.', 'Примечание']];
    let n = 0;
    sortedGroups(job.items).forEach(g => g.items.forEach(i => rows.push([++n, g.name, i.name, i.size || '', i.qty, i.unit, i.note || ''])));
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 5 }, { wch: 24 }, { wch: 44 }, { wch: 14 }, { wch: 8 }, { wch: 7 }, { wch: 30 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Запчасти');
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    await offerFile(blob, safeName('Запчасти — ' + job.name) + '.xlsx', 'Запчасти — ' + job.name, 'Файл Excel сохранён в «Загрузки»');
  }
  async function backup() {
    const blob = new Blob([JSON.stringify({ app: 'santehkomplekt', version: 1, savedAt: new Date().toISOString(), jobs }, null, 1)], { type: 'application/json' });
    await offerFile(blob, 'Сантехкомплект-копия-' + today().replace(/\./g, '-') + '.json', 'Резервная копия', 'Копия сохранена в «Загрузки»');
  }
  async function restore(file) {
    try {
      const data = JSON.parse(await file.text());
      const incoming = backupJobs(data);
      if (!incoming) throw new Error('format');
      const { jobs: merged, added, updated } = mergeJobs(jobs, incoming);
      setJobs(merged);
      setSheet(null);
      const parts = [added && 'добавлено объектов: ' + added, updated && 'обновлено: ' + updated].filter(Boolean).join(', ');
      say(parts ? parts[0].toUpperCase() + parts.slice(1) : 'Новых объектов нет — всё из копии уже есть на телефоне');
    } catch (e) {
      say('Это не файл копии Сантехкомплекта');
    }
  }
  const canShareText = Platform.canShareText;
  const listCount = job ? job.items.length : 0;
  const groupCounts = useMemo(() => {
    const c = {};
    if (job) job.items.forEach(i => { const g = groupOf(i); c[g] = (c[g] || 0) + 1; });
    return c;
  }, [job]);

  let content;
  if (!job) content = html`<div class="empty">
      <h2>Начните с объекта</h2>
      <p>Каждый объект — отдельный список запчастей: квартира, дом, котельная. Создайте первый, затем выбирайте детали из каталога.</p>
      <button type="button" className="btn primary" onClick=${() => setSheet({ type: 'jobs' })}>Создать объект</button>
      <a className="btn" href="help.html">Как пользоваться приложением</a>
    </div>`;
  else if (tab === 'catalog') content = html`<${CatalogView} job=${job} query=${query}
      onPick=${part => setSheet({ type: 'qty', part })} onOwn=${name => setSheet({ type: 'own', name })} />`;
  else content = html`<${ListView} job=${job} readOnly=${false} canExcel=${true}
      onEdit=${i => setSheet({ type: 'qty', part: PART_BY_ID[i.pid] || { id: i.pid, name: i.name, unit: i.unit, group: i.group, sizes: [i.size || ''], spec: '' }, size: i.size || '' })}
      onStep=${(i, d) => {
        const q = stepQty(i, d); setItem(i, q);
        if (q > 0) return;
        // Убрали «−» до нуля — 5 секунд можно вернуть; вернётся в тот же объект, даже если уже открыт другой
        const jobId = job.id, index = job.items.findIndex(x => x.key === i.key);
        say('Убрано: ' + fullName(i), () => {
          updateJob(jobId, j => Object.assign({}, j, { items: restoreItem(j.items, i, index) }));
          say('Вернули: ' + fullName(i));
        });
      }}
      onClear=${() => { updateJob(job.id, j => Object.assign({}, j, { items: [] })); say('Список очищен'); }}
      onCopy=${copyText} onShare=${canShareText ? shareText : null} onExcel=${exportExcel} goCatalog=${() => setTab('catalog')} />`;

  return html`<div class="wrap">
    <header class="top">
      <div class="top-row">
        <button type="button" className="job-btn" onClick=${() => setSheet({ type: 'jobs' })}>
          <span class="meta"><span class="eyebrow">Объект</span><span class="job-name">${job ? job.name : 'Не выбран'}</span></span>
          <${IconChev} />
        </button>
        <a className="help-btn" href="help.html" aria-label="Справка: как пользоваться приложением" title="Справка">?</a>
      </div>
      ${job && tab === 'catalog' ? html`<div class="search">
          <${IconSearch} />
          <input id="search" type="search" placeholder="Поиск: муфта 20, американка, ½…" value=${query} onChange=${e => setQuery(e.target.value)} aria-label="Поиск по каталогу" />
          ${query ? html`<button type="button" className="clear" aria-label="Очистить поиск" onClick=${() => setQuery('')}>×</button>` : null}
        </div>
        ${!isSearchQuery(query.trim()) ? html`<nav class="chips" aria-label="Разделы каталога">${CATALOG.map(g => html`<button type="button" key=${g.id} className="chip"
          onClick=${() => scrollToGroup(g.id)}>
          ${g.name}${groupCounts[g.id] ? html`<span class="n">${groupCounts[g.id]}</span>` : null}</button>`)}</nav>` : null}` : null}
    </header>
    ${canInstall ? html`<div class="notice bar"><span>Установите приложение на главный экран — оно будет работать без интернета.</span><button type="button" className="btn primary" onClick=${() => Platform.install()}>Установить</button></div>` : null}
    <main>${content}</main>

    ${job ? html`<nav class="tabbar" aria-label="Разделы"><div class="in">
      <button type="button" className="tab" aria-current=${tab === 'catalog' ? 'page' : undefined} onClick=${() => setTab('catalog')}><${IconBook} />Каталог</button>
      <button type="button" className="tab" aria-current=${tab === 'list' ? 'page' : undefined} onClick=${() => setTab('list')}><${IconList} />Список
        ${listCount ? html`<span class="cnt">${listCount}</span>` : null}</button>
    </div></nav>` : null}

    ${sheet && sheet.type === 'qty' && job ? html`<${QtySheet} key=${sheet.part.id + (sheet.size || '')} part=${sheet.part} job=${job} lockedSize=${sheet.size} readOnly=${false}
      onClose=${() => setSheet(null)}
      onSave=${(entry, qty, note) => { setItem(entry, qty, note); setSheet(null);
        say(qty > 0 ? fullName(entry) + ' — ' + fmtQty(qty) + ' ' + entry.unit : 'Убрано из списка'); }} />` : null}
    ${sheet && sheet.type === 'own' && job ? html`<${OwnSheet} initialName=${sheet.name} readOnly=${false} onClose=${() => setSheet(null)}
      onSave=${(entry, qty, note) => { setItem(entry, qty, note); setSheet(null); setQuery(''); say(fullName(entry) + ' — ' + fmtQty(qty) + ' ' + entry.unit); }} />` : null}
    ${sheet && sheet.type === 'jobs' ? html`<${JobsSheet} jobs=${jobs} currentId=${job && job.id} readOnly=${false}
      onClose=${() => setSheet(null)} onPick=${id => { setCurrentId(id); setSheet(null); }}
      onCreate=${createJob} onDelete=${deleteJob} onBackup=${backup} onRestore=${restore}
      onRename=${(id, name, address) => { updateJob(id, j => Object.assign({}, j, { name, address })); setSheet(null); say('Сохранено'); }} />` : null}
    ${sheet && sheet.type === 'text' && job ? html`<${TextSheet} job=${job} onClose=${() => setSheet(null)} />` : null}
    ${toast ? html`<div class=${'toast' + (toast.undo ? ' has-act' : '')} key=${toast.id} role="status" aria-live="polite">
      <span>${toast.text}</span>
      ${toast.undo ? html`<button type="button" className="toast-act" onClick=${toast.undo}>Вернуть</button>
        <span class="toast-timer" aria-hidden="true" style=${{ animationDuration: UNDO_MS + 'ms' }}></span>` : null}
    </div>` : null}
  </div>`;
}

ReactDOM.createRoot(document.getElementById('root')).render(html`<${App} />`);
})();
