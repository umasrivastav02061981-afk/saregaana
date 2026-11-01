/* ===== add.js — pick songs from phone storage and save them in the app ===== */
Saregaana.register('add', (function () {
  'use strict';
  const S = window.Saregaana;
  let root, el = {}, offs = [], busy = false;

  const AUDIO_EXT = /\.(mp3|m4a|aac|flac|wav|ogg|opus|mp4)$/i;

  function mb(n) { return n >= 1073741824 ? (n / 1073741824).toFixed(1) + ' GB' : Math.round(n / 1048576) + ' MB'; }

  async function showStorage() {
    const u = await S.db.usage();
    el.adStore.textContent = u.quota
      ? 'Phone storage used by Saregaana: ' + mb(u.used) + ' of ' + mb(u.quota) + ' available'
      : '';
  }

  /* ---------- the songs list ---------- */
  function renderList() {
    const songs = S.library.list;
    el.adCount.textContent = songs.length;
    el.adEmpty.hidden = songs.length > 0;
    el.adList.textContent = '';
    const ids = songs.map((s) => s.id);
    songs.forEach((song, i) => {
      el.adList.appendChild(S.row.create(song, {
        onClick: () => S.bus.emit('song:play', { ids, index: i }),
        onDelete: async (sg) => {
          const ok = await S.modal.confirm({ title: 'Delete song?', text: '“' + sg.title + '” will be removed from this phone.', yes: 'Delete', danger: true });
          if (!ok) return;
          try { await S.db.removeSong(sg.id); S.toast('Song deleted'); }
          catch (e) { S.log('delete', e); S.toast('Could not delete the song'); }
        }
      }));
    });
  }

  /* ---------- adding files ---------- */
  function logLine(name) {
    const li = document.createElement('li');
    const a = document.createElement('span'); a.textContent = name;
    const b = document.createElement('span'); b.textContent = 'reading…';
    li.append(a, b);
    el.adLog.prepend(li);
    return (cls, text) => { li.className = cls; b.textContent = text; };
  }

  async function handle(files) {
    if (busy) return;
    const list = Array.from(files).filter((f) => /^audio\//.test(f.type) || AUDIO_EXT.test(f.name));
    if (!list.length) { S.toast('No songs found'); return; }

    busy = true;
    el.adProg.hidden = false;
    el.adLog.textContent = '';
    let added = 0, skipped = 0, failed = 0;

    for (let i = 0; i < list.length; i++) {
      const f = list[i];
      el.adProgText.textContent = 'Saving ' + (i + 1) + ' of ' + list.length + '…';
      el.adBarFill.style.width = (i / list.length) * 100 + '%';
      const mark = logLine(f.name);
      try {
        const sig = f.name + '|' + f.size + '|' + f.lastModified;
        if (S.library.hasSig(sig)) { skipped++; mark('skip', 'already added'); continue; }
        const m = await S.tags.read(f);
        await S.db.addSong({
          title: m.title, artist: m.artist, film: m.film, year: m.year,
          duration: m.duration, mime: f.type || 'audio/mpeg', sig
        }, f, m.cover);
        added++; mark('ok', 'saved');
      } catch (e) {
        failed++; mark('bad', 'failed');
        S.log('add:' + f.name, e);
      }
    }

    el.adBarFill.style.width = '100%';
    el.adProgText.textContent = added + ' saved' + (skipped ? ' · ' + skipped + ' already there' : '') + (failed ? ' · ' + failed + ' failed' : '');
    busy = false;
    el.adFile.value = '';

    if (added) {
      S.bus.emit('library:changed');
      S.toast(added + (added === 1 ? ' song added' : ' songs added'));
      S.db.persist();                           // ask Android to keep them safe
    }
    showStorage();
  }

  function init(mount) {
    root = mount; offs = []; busy = false;
    ['adPick', 'adFile', 'adProg', 'adBarFill', 'adProgText', 'adLog', 'adStore', 'adCount', 'adList', 'adEmpty']
      .forEach((id) => { el[id] = root.querySelector('#' + id); });

    el.adPick.addEventListener('click', () => el.adFile.click());
    el.adFile.addEventListener('change', () => handle(el.adFile.files));

    offs.push(S.bus.on('library:changed', renderList));
    offs.push(S.row.watch(el.adList));            // highlight the playing song
    renderList();
    showStorage();
  }

  function destroy() { offs.forEach((f) => f()); offs = []; }

  return { init, destroy };
})());
