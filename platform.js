/* Сантехкомплект — платформенный слой.
 *
 * Всё, что отличается между браузером (PWA) и Android-приложением (APK на Capacitor),
 * собрано здесь. app.js обращается к среде только через window.Platform, поэтому
 * логика приложения тестируется в браузере, а при сборке APK меняется лишь этот файл.
 *
 * Интерфейс:
 *   Platform.kind                      'web' | 'android'
 *   Platform.storage.get(key)          строка или null
 *   Platform.storage.set(key, value)   true, если сохранено
 *   Platform.requestPersistence()      просит браузер не удалять данные при нехватке места
 *   Platform.copyText(text)            true, если скопировано
 *   Platform.canShareText              есть ли системное меню «Поделиться»
 *   Platform.shareText(title, text)    'shared' | 'cancelled' | 'unsupported'
 *   Platform.saveFile(blob, name, title) 'shared' | 'saved' | 'cancelled'
 *   Platform.setBackHandler(fn|null)   пока задан fn, кнопка «Назад» вызывает его
 *   Platform.onInstallChange(cb)       cb(можно ли установить), возвращает отписку
 *   Platform.install()                 показывает системное окно установки
 *   Platform.onUpdateChange(cb)        cb(есть ли новая версия), возвращает отписку
 *   Platform.applyUpdate()             переходит на новую версию
 */
(function () {
  'use strict';

  const Cap = window.Capacitor;
  const native = !!(Cap && typeof Cap.isNativePlatform === 'function' && Cap.isNativePlatform());
  const plugin = name => (native && Cap.Plugins && Cap.Plugins[name]) || null;

  /* ---------- Общее для обеих платформ ---------- */

  // localStorage есть и в браузере, и во встроенном браузере Android-приложения
  const storage = {
    get(key) { try { return localStorage.getItem(key); } catch (e) { return null; } },
    set(key, value) { try { localStorage.setItem(key, value); return true; } catch (e) { return false; } },
  };

  function requestPersistence() {
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  }

  // Простое событие с подпиской: хранит последнее значение и сразу отдаёт его новым подписчикам
  function signal(initial) {
    let value = initial;
    const subs = new Set();
    return {
      get: () => value,
      set(v) { value = v; subs.forEach(cb => cb(v)); },
      on(cb) { subs.add(cb); cb(value); return () => subs.delete(cb); },
    };
  }

  /* ---------- Браузер (PWA) ---------- */

  function makeWeb() {
    const installable = signal(false);
    const updateReady = signal(false);
    let installEvt = null;
    let waitingReg = null;

    window.addEventListener('beforeinstallprompt', e => {
      e.preventDefault();
      installEvt = e;
      installable.set(true);
    });
    window.addEventListener('appinstalled', () => { installEvt = null; installable.set(false); });

    if ('serviceWorker' in navigator && location.protocol !== 'file:') {
      window.addEventListener('load', () => {
        const hadController = !!navigator.serviceWorker.controller;
        const ready = reg => { waitingReg = reg; updateReady.set(true); };
        navigator.serviceWorker.register('sw.js').then(reg => {
          if (reg.waiting && hadController) ready(reg);
          reg.addEventListener('updatefound', () => {
            const w = reg.installing;
            if (!w) return;
            w.addEventListener('statechange', () => {
              if (w.state === 'installed' && navigator.serviceWorker.controller) ready(reg);
            });
          });
          setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
        }).catch(() => { /* без офлайн-режима приложение всё равно работает */ });
        let reloaded = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (!hadController || reloaded) return;
          reloaded = true;
          location.reload();
        });
      });
    }

    // Кнопка «Назад» на Android в PWA — это шаг назад по истории.
    // Пока открыто окно, держим в истории лишнюю запись и перехватываем её.
    let backFn = null;
    let trapped = false;
    let ignorePop = false;
    window.addEventListener('popstate', () => {
      if (ignorePop) { ignorePop = false; return; }
      if (!trapped) return;
      trapped = false;
      const fn = backFn;
      backFn = null;
      if (fn) fn();
    });
    function setBackHandler(fn) {
      backFn = fn || null;
      if (fn && !trapped) {
        history.pushState({ santehBack: true }, '');
        trapped = true;
      } else if (!fn && trapped) {
        trapped = false;
        ignorePop = true;
        history.back();
      }
    }

    function download(blob, filename) {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    }

    return {
      kind: 'web',
      storage,
      requestPersistence,
      async copyText(text) {
        try { await navigator.clipboard.writeText(text); return true; } catch (e) { return false; }
      },
      canShareText: !!navigator.share,
      async shareText(title, text) {
        if (!navigator.share) return 'unsupported';
        try { await navigator.share({ title, text }); return 'shared'; }
        catch (e) { return e && e.name === 'AbortError' ? 'cancelled' : 'unsupported'; }
      },
      async saveFile(blob, filename, title) {
        const file = new File([blob], filename, { type: blob.type });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          try { await navigator.share({ files: [file], title }); return 'shared'; }
          catch (e) { if (e && e.name === 'AbortError') return 'cancelled'; }
        }
        download(blob, filename);
        return 'saved';
      },
      setBackHandler,
      onInstallChange: installable.on,
      async install() {
        if (!installEvt) return;
        installEvt.prompt();
        try { await installEvt.userChoice; } catch (e) { /* окно закрыто */ }
        installEvt = null;
        installable.set(false);
      },
      onUpdateChange: updateReady.on,
      applyUpdate() {
        if (waitingReg && waitingReg.waiting) waitingReg.waiting.postMessage('skipWaiting');
        else location.reload();
      },
    };
  }

  /* ---------- Android-приложение (Capacitor) ----------
   * Нужны модули @capacitor/share, @capacitor/filesystem, @capacitor/app, @capacitor/clipboard.
   * Эта ветка проверяется при сборке APK: в браузере она не выполняется. */

  function makeAndroid() {
    const Share = plugin('Share');
    const Filesystem = plugin('Filesystem');
    const App = plugin('App');
    const Clipboard = plugin('Clipboard');
    const isCancel = e => /cancel/i.test(String((e && (e.message || e.errorMessage)) || e));

    let backFn = null;
    if (App) {
      App.addListener('backButton', () => {
        if (backFn) { const fn = backFn; backFn = null; fn(); return; }
        if (App.minimizeApp) App.minimizeApp(); else App.exitApp();
      });
    }

    const toBase64 = blob => new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result).split(',')[1]);
      r.onerror = () => reject(r.error);
      r.readAsDataURL(blob);
    });

    const off = () => () => {};
    return {
      kind: 'android',
      storage,
      requestPersistence() { /* данные приложения и так не удаляются системой */ },
      async copyText(text) {
        try {
          if (Clipboard) await Clipboard.write({ string: text });
          else await navigator.clipboard.writeText(text);
          return true;
        } catch (e) { return false; }
      },
      canShareText: !!Share,
      async shareText(title, text) {
        if (!Share) return 'unsupported';
        try { await Share.share({ title, text, dialogTitle: title }); return 'shared'; }
        catch (e) { return isCancel(e) ? 'cancelled' : 'unsupported'; }
      },
      async saveFile(blob, filename, title) {
        // Файл кладём во временную папку приложения и отдаём в меню «Поделиться»:
        // оттуда его можно отправить в мессенджер или сохранить в «Файлы» / на Диск
        const { uri } = await Filesystem.writeFile({ path: filename, data: await toBase64(blob), directory: 'CACHE' });
        try { await Share.share({ title, files: [uri], dialogTitle: title }); return 'shared'; }
        catch (e) { if (isCancel(e)) return 'cancelled'; throw e; }
      },
      setBackHandler(fn) { backFn = fn || null; },
      onInstallChange: off,   // приложение уже установлено
      install() {},
      onUpdateChange: off,    // обновление — новой версией APK
      applyUpdate() {},
    };
  }

  window.Platform = Object.freeze(native ? makeAndroid() : makeWeb());
})();
