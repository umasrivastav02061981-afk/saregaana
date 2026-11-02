
/* ===== settings.js — Saregaana settings screen =====
   Uses the existing core APIs:
   S.store, S.db, S.library, S.bus, S.modal, S.toast.
*/

Saregaana.register('settings', (function () {
  'use strict';

  const S = window.Saregaana;

  const THEMES = [
    'radio',
    'gramophone',
    'cassette'
  ];

  let root = null;
  let offs = [];

  /* ---------- Helpers ---------- */

  function get(selector) {
    return root ? root.querySelector(selector) : null;
  }

  function listen(element, event, callback) {
    if (!element) return;

    element.addEventListener(event, callback);

    offs.push(function () {
      element.removeEventListener(event, callback);
    });
  }

  function formatBytes(bytes) {
    if (!bytes || bytes <= 0) return '0 B';

    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const index = Math.min(
      Math.floor(Math.log(bytes) / Math.log(1024)),
      units.length - 1
    );

    const value = bytes / Math.pow(1024, index);

    return value.toFixed(index === 0 ? 0 : 2) +
      ' ' + units[index];
  }

  /* ---------- Theme settings ---------- */

  function applyTheme(theme, save) {
    if (!THEMES.includes(theme)) {
      theme = 'radio';
    }

    document.body.dataset.theme = theme;

    if (save !== false) {
      S.store.set('theme', theme);
    }

    renderThemes();
  }

  function renderThemes() {
    if (!root) return;

    const current = document.body.dataset.theme || 'radio';

    root.querySelectorAll('[data-theme]').forEach(function (button) {
      const selected = button.dataset.theme === current;

      button.classList.toggle('selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
  }

  /* ---------- Collection overview ---------- */

  function renderCounts() {
    if (!root) return;

    const songs = S.library.list || [];
    const playlists = S.library.playlists || [];

    const songCount = get('#stSongCount');
    const playlistCount = get('#stPlaylistCount');

    if (songCount) {
      songCount.textContent = songs.length;
    }

    if (playlistCount) {
      playlistCount.textContent = playlists.filter(function (p) {
        return p.id !== 'fav';
      }).length;
    }
  }

  /* ---------- Storage information ---------- */

  async function refreshStorage() {
    if (!root) return;

    const currentRoot = root;

    const usedEl = get('#stStorageUsed');
    const barEl = get('#stStorageBar');
    const percentEl = get('#stStoragePercent');
    const quotaEl = get('#stStorageQuota');

    if (!usedEl || !barEl) return;

    usedEl.textContent = 'Checking…';
    percentEl.textContent = 'Calculating usage';

    try {
      const result = await S.db.usage();

      // The user may have left Settings while the request was running.
      if (root !== currentRoot) return;

      const used = result.used || 0;
      const quota = result.quota || 0;

      usedEl.textContent = formatBytes(used);
      quotaEl.textContent = quota
        ? formatBytes(quota) + ' available limit'
        : 'Limit unavailable';

      if (quota > 0) {
        const percent = Math.min(
          100,
          Math.round((used / quota) * 100)
        );

        barEl.style.width = percent + '%';
        percentEl.textContent = percent + '% of estimated quota used';
      } else {
        barEl.style.width = '0%';
        percentEl.textContent = 'Usage estimate available';
      }

    } catch (error) {
      if (root !== currentRoot) return;

      usedEl.textContent = 'Unavailable';
      quotaEl.textContent = '';
      percentEl.textContent = 'Could not read browser storage';
      S.log('settings:storage', error);
    }
  }

  /* ---------- Persistent storage ---------- */

  async function checkPersistence() {
    if (!root) return;

    const status = get('#stPersistStatus');
    if (!status) return;

    try {
      if (
        navigator.storage &&
        typeof navigator.storage.persisted === 'function'
      ) {
        const isPersisted = await navigator.storage.persisted();

        if (!root || !status.isConnected) return;

        status.textContent = isPersisted
          ? 'Your browser has granted persistent storage.'
          : 'Your browser has not granted persistent storage yet.';
      } else {
        status.textContent =
          'Persistent storage status is not supported by this browser.';
      }
    } catch (error) {
      status.textContent = 'Could not check storage protection.';
      S.log('settings:persistence-check', error);
    }
  }

  async function requestPersistence() {
    const button = get('#stPersist');
    const status = get('#stPersistStatus');

    if (!button || !status) return;

    button.disabled = true;
    button.textContent = 'Checking…';

    try {
      const granted = await S.db.persist();

      if (granted) {
        status.textContent =
          'Persistent storage has been granted by your browser.';
        S.toast('Persistent storage enabled');
      } else {
        await checkPersistence();

        if (root) {
          S.toast('Your browser did not grant the request');
        }
      }

    } catch (error) {
      S.log('settings:persistence', error);
      status.textContent = 'Could not request persistent storage.';
      S.toast('Storage request failed');

    } finally {
      if (root && button.isConnected) {
        button.disabled = false;
        button.textContent = 'Request';
      }
    }
  }

  /* ---------- Error log ---------- */

  function openErrorLog() {
    if (!S.modal) {
      S.toast('Error log is unavailable');
      return;
    }

    const entries = Array.isArray(S.errors) ? S.errors : [];

    const content = document.createElement('div');
    const pre = document.createElement('pre');

    pre.className = 'st-log';

    if (!entries.length) {
      pre.textContent = 'No errors have been recorded.\n\n' +
        'Saregaana is looking clear!';
    } else {
      pre.textContent = entries.map(function (item, index) {
        const date = item.t
          ? new Date(item.t).toLocaleString()
          : 'Unknown time';

        return [
          '[' + (index + 1) + '] ' + date,
          'Area: ' + (item.where || 'Unknown'),
          'Message: ' + (item.msg || 'No message'),
          '------------------------------'
        ].join('\n');
      }).join('\n');
    }

    content.appendChild(pre);

    const actions = [];

    if (entries.length) {
      actions.push({
        label: 'Clear error log',
        kind: 'danger',
        onClick: function () {
          S.clearErrors();
          S.toast('Error log cleared');
        }
      });
    }

    actions.push({
      label: 'Close',
      kind: 'ghost'
    });

    S.modal.open({
      title: 'App error log',
      content: content,
      actions: actions
    });
  }

  /* ---------- Navigation ---------- */

  function openProfile() {
    S.buzz(8);
    S.go('profile');
  }

  /* ---------- Screen lifecycle ---------- */

  function init(mount) {
    root = mount;
    offs = [];

    // Restore the current saved theme.
    const savedTheme = S.store.get('theme', 'radio');
    applyTheme(savedTheme, false);

    // Theme selection.
    root.querySelectorAll('[data-theme]').forEach(function (button) {
      listen(button, 'click', function () {
        applyTheme(button.dataset.theme, true);
        S.buzz(8);
        S.toast('Theme updated');
      });
    });

    // Storage controls.
    listen(get('#stRefreshStorage'), 'click', refreshStorage);
    listen(get('#stPersist'), 'click', requestPersistence);

    // Profile and diagnostics.
    listen(get('#stProfile'), 'click', openProfile);
    listen(get('#stErrors'), 'click', openErrorLog);

    // Live collection counts.
    offs.push(S.bus.on('library:changed', renderCounts));
    offs.push(S.bus.on('playlists:changed', renderCounts));

    renderCounts();
    refreshStorage();
    checkPersistence();
  }

  function destroy() {
    offs.forEach(function (off) {
      try {
        off();
      } catch (error) {}
    });

    offs = [];
    root = null;
  }

  return {
    init: init,
    destroy: destroy
  };

})());
