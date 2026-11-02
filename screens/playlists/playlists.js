/* ===== playlists.js — cassette playlists: list, detail, rename, delete, reorder ===== */
Saregaana.register('playlists', (function () {
  'use strict';
  const S = window.Saregaana;
  let root, el = {}, offs = [], stopWatch = null;
  let openId = null;                                  // playlist being viewed (null = the cassette shelf)

  const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');
  const ids = (list) => list.map((s) => s.id);
  function h(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  const minutes = (sec) => (sec ? Math.max(1, Math.round(sec / 60)) + ' min' : '0 min');

  /* ---------- one cassette ---------- */
  function cassette(pl, big) {
    const b = h(big ? 'div' : 'button', 'cs' + (big ? ' big' : '') + (pl.id === S.lists.FAV ? ' fav' : ''));
    if (!big) b.type = 'button';
    const p = S.posters.palette(pl.id);
    b.style.setProperty('--c1', p.p1);
    b.style.setProperty('--c2', p.p2);
    b.innerHTML = '<div class="cs-body"><div class="cs-label"><b></b><small></small></div><div class="cs-win"><i class="cs-reel"></i><i class="cs-reel"></i></div><div class="cs-foot"></div></div>';
    b.querySelector('b').textContent = pl.name;
    b.querySelector('small').textContent = plural(S.lists.songs(pl.id).length, 'song') + ' · ' + minutes(S.lists.seconds(pl.id));
    return b;
  }

  /* ---------- the shelf ---------- */
  function viewShelf() {
    const box = h('div');
    const grid = h('div', 'ls-grid');
    const lists = S.lists.all();
    lists.forEach((pl) => {
      const c = cassette(pl, false);
      c.onclick = () => { openId = pl.id; render(); (root.closest('#screen') || {}).scrollTop = 0; };
      grid.appendChild(c);
    });
    box.appendChild(grid);
    if (lists.length <= 1) box.appendChild(h('p', 'ls-tip', 'Tap “+ New” to make your first playlist. Add songs to Favourites with the heart on the Now Playing screen.'));
    return box;
  }

  /* ---------- one playlist ---------- */
  function songSheet(pl, song) {
    const p = h('p', 'md-hint', [song.artist, song.film].filter(Boolean).join(' · ') || 'Unknown artist');
    S.modal.open({
      title: song.title, content: p,
      actions: [
        { label: '↑ Move up', kind: 'ghost', onClick: () => S.lists.move(pl.id, song.id, -1) },
        { label: '↓ Move down', kind: 'ghost', onClick: () => S.lists.move(pl.id, song.id, 1) },
        { label: 'Remove from playlist', kind: 'danger', onClick: async () => { await S.lists.removeSong(pl.id, song.id); S.toast('Removed from ' + pl.name); } },
        { label: 'Cancel', kind: 'ghost' }
      ]
    });
  }

  function renameSheet(pl) {
    const box = h('div');
    const w = h('label', 'md-field');
    w.appendChild(h('span', '', 'Playlist name'));
    const i = h('input'); i.type = 'text'; i.value = pl.name; i.maxLength = 40;
    w.appendChild(i); box.appendChild(w);
    S.modal.open({
      title: 'Rename playlist', content: box,
      actions: [
        { label: 'Save', kind: 'primary', onClick: async () => {
            if (!i.value.trim()) { S.toast('Name cannot be empty'); return false; }
            await S.lists.rename(pl.id, i.value);
        } },
        { label: 'Cancel', kind: 'ghost' }
      ]
    });
  }

  async function confirmDelete(pl) {
    const ok = await S.modal.confirm({ title: 'Delete playlist?', text: '“' + pl.name + '” will be deleted. Your songs stay in the library.', yes: 'Delete', danger: true });
    if (!ok) return;
    try { openId = null; await S.lists.remove(pl.id); S.toast('Playlist deleted'); }
    catch (e) { S.log('lists', e); S.toast('Could not delete the playlist'); }
  }

  function viewDetail(pl) {
    const songs = S.lists.songs(pl.id);
    const box = h('div');

    const back = h('button', 'ls-back');
    back.type = 'button';
    back.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5 8 12l7 7"/></svg>Playlists';
    back.onclick = () => { openId = null; render(); };
    box.appendChild(back);

    const head = h('div', 'ls-dh');
    const dt = h('div', 'ls-dt');
    dt.append(h('h2', '', pl.name), h('p', '', plural(songs.length, 'song') + ' · ' + minutes(S.lists.seconds(pl.id))));
    head.append(cassette(pl, true), dt);
    box.appendChild(head);

    const acts = h('div', 'ls-acts');
    const mk = (label, cls, fn) => { const b = h('button', 'ls-act ' + cls, label); b.type = 'button'; b.onclick = fn; acts.appendChild(b); };
    if (songs.length) {
      mk('▶ Play', 'main', () => S.bus.emit('song:play', { ids: ids(songs), index: 0 }));
      mk('⤮ Shuffle', '', () => S.player.play(ids(songs), 0, { shuffleOnce: true }));
    }
    mk('+ Add songs', songs.length ? '' : 'main', () => S.lists.pickSongs(pl.id));
    if (pl.id !== S.lists.FAV) {
      mk('Rename', '', () => renameSheet(pl));
      mk('Delete', 'danger', () => confirmDelete(pl));
    }
    box.appendChild(acts);

    if (!songs.length) {
      const e = h('div', 'ls-empty');
      e.append(h('h2', '', 'This tape is empty'), h('p', '', pl.id === S.lists.FAV ? 'Tap the heart on the Now Playing screen to add favourites.' : 'Tap “+ Add songs” to fill it.'));
      box.appendChild(e);
      return box;
    }
    const ul = h('ul', 'ls-list');
    const idl = ids(songs);
    songs.forEach((song, i) => ul.appendChild(S.row.create(song, {
      onClick: () => S.bus.emit('song:play', { ids: idl, index: i }),
      onMore: () => songSheet(pl, song)
    })));
    stopWatch = S.row.watch(ul);
    box.appendChild(ul);
    return box;
  }

  /* ---------- draw ---------- */
  function render() {
    if (stopWatch) { stopWatch(); stopWatch = null; }
    let node;
    const pl = openId ? S.lists.get(openId) : null;
    if (pl) node = viewDetail(pl); else { openId = null; node = viewShelf(); }
    el.lsHead.hidden = !!pl;
    el.lsView.textContent = '';
    el.lsView.appendChild(node);
  }

  function newSheet() {
    const box = h('div');
    const w = h('label', 'md-field');
    w.appendChild(h('span', '', 'Playlist name'));
    const i = h('input'); i.type = 'text'; i.placeholder = 'e.g. Rainy day romance'; i.maxLength = 40;
    w.appendChild(i); box.appendChild(w);
    S.modal.open({
      title: 'New playlist', content: box,
      actions: [
        { label: 'Create', kind: 'primary', onClick: async () => {
            if (!i.value.trim()) { S.toast('Type a name first'); return false; }
            const pl = await S.lists.create(i.value);
            openId = pl.id;
            render();
            if (S.library.list.length) setTimeout(() => S.lists.pickSongs(pl.id), 420);
        } },
        { label: 'Cancel', kind: 'ghost' }
      ]
    });
  }

  function init(mount) {
    root = mount; offs = []; openId = null;
    el.lsHead = root.querySelector('.ls-head');
    el.lsView = root.querySelector('#lsView');
    root.querySelector('#lsNew').addEventListener('click', newSheet);
    root.querySelector('#lsStudio').addEventListener('click', () => {
  S.go('mixtape');
});
    offs.push(S.bus.on('playlists:changed', render));
    offs.push(S.bus.on('library:changed', render));
    render();
  }

  function destroy() {
    offs.forEach((f) => f()); offs = [];
    if (stopWatch) { stopWatch(); stopWatch = null; }
  }

  return { init, destroy };
})());
