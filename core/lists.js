/* ===== lists.js — playlists: create, rename, add/remove songs, favourites + the pick sheets =====
   Data is saved by db.js. Screens call these helpers and listen to 'playlists:changed'. */
(function () {
  'use strict';
  const S = window.Saregaana;
  const FAV = 'fav';
  const now = () => Date.now();

  function h(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  const get = (id) => S.library.playlist(id);
  const all = () => S.library.playlists.slice().sort((a, b) => (a.id === FAV ? -1 : b.id === FAV ? 1 : b.updated - a.updated));
  const save = (pl) => S.db.putPlaylist(Object.assign({}, pl, { updated: now() }));
  async function ensureFav() {
    if (!get(FAV)) await S.db.putPlaylist({ id: FAV, name: 'Favourites', songIds: [], created: now(), updated: now() });
  }

  const api = {
    FAV,
    async init() { await ensureFav(); },
    all, get,
    songs(id) { const p = get(id); return p ? p.songIds.map((x) => S.library.get(x)).filter(Boolean) : []; },
    seconds(id) { return api.songs(id).reduce((n, s) => n + (s.duration || 0), 0); },

    async create(name) {
      const pl = { id: S.uid(), name: (name || '').trim() || 'New playlist', songIds: [], created: now(), updated: now() };
      await S.db.putPlaylist(pl);
      return pl;
    },
    async rename(id, name) {
      const p = get(id);
      if (!p || id === FAV) return;
      await save(Object.assign({}, p, { name: (name || '').trim() || p.name }));
    },
    async remove(id) { if (id !== FAV) await S.db.deletePlaylist(id); },

    async addSongs(id, songIds) {
      const p = get(id);
      if (!p) return 0;
      const have = new Set(p.songIds);
      const add = songIds.filter((x) => !have.has(x) && S.library.get(x));
      if (!add.length) return 0;
      await save(Object.assign({}, p, { songIds: p.songIds.concat(add) }));
      return add.length;
    },
    async removeSong(id, songId) {
      const p = get(id);
      if (p) await save(Object.assign({}, p, { songIds: p.songIds.filter((x) => x !== songId) }));
    },
    async move(id, songId, dir) {
      const p = get(id);
      if (!p) return;
      const a = p.songIds.slice();
      const i = a.indexOf(songId), j = i + dir;
      if (i < 0 || j < 0 || j >= a.length) return;
      [a[i], a[j]] = [a[j], a[i]];
      await save(Object.assign({}, p, { songIds: a }));
    },

    isFav(songId) { const p = get(FAV); return !!p && p.songIds.includes(songId); },
    async toggleFav(song) {
      await ensureFav();
      if (api.isFav(song.id)) { await api.removeSong(FAV, song.id); return false; }
      await api.addSongs(FAV, [song.id]);
      return true;
    },

    /* ---- sheet: add ONE song to playlists (tap to add / remove) ---- */
    pick(song) {
      const box = h('div');
      const list = h('div', 'md-list');
      const paint = () => {
        list.textContent = '';
        all().forEach((p) => {
          const has = p.songIds.includes(song.id);
          const b = h('button', 'md-item' + (has ? ' on' : ''));
          b.type = 'button';
          b.append(h('span', 'md-ic', p.id === FAV ? '♥' : '♪'), h('span', 'md-it', p.name), h('span', 'md-ck', has ? '✓' : '+'));
          b.onclick = async () => {
            try {
              if (has) { await api.removeSong(p.id, song.id); S.toast('Removed from ' + p.name); }
              else { await api.addSongs(p.id, [song.id]); S.toast('Added to ' + p.name); }
            } catch (e) { S.log('lists', e); S.toast('Could not change the playlist'); }
            paint();
          };
          list.appendChild(b);
        });
      };
      const row = h('div', 'md-new');
      const inp = h('input'); inp.type = 'text'; inp.placeholder = 'New playlist name'; inp.maxLength = 40;
      const add = h('button', 'md-btn ghost', 'Create'); add.type = 'button';
      add.onclick = async () => {
        const name = inp.value.trim();
        if (!name) { S.toast('Type a name first'); return; }
        try {
          const pl = await api.create(name);
          await api.addSongs(pl.id, [song.id]);
          inp.value = '';
          S.toast('Added to ' + pl.name);
        } catch (e) { S.log('lists', e); S.toast('Could not create the playlist'); }
        paint();
      };
      row.append(inp, add);
      box.append(h('p', 'md-hint', song.title), list, row);
      paint();
      S.modal.open({ title: 'Add to playlist', content: box, actions: [{ label: 'Done', kind: 'primary' }] });
    },

    /* ---- sheet: add MANY songs to one playlist ---- */
    pickSongs(id) {
      const p = get(id);
      if (!p) return;
      const have = new Set(p.songIds);
      const cand = S.library.list.filter((s) => !have.has(s.id));
      if (!cand.length) { S.toast(S.library.list.length ? 'All your songs are already in this playlist' : 'Add songs to the app first'); return; }

      const box = h('div');
      const search = h('input'); search.type = 'search'; search.placeholder = 'Search songs'; search.className = 'md-search';
      const info = h('p', 'md-hint', '0 selected');
      const list = h('div', 'md-list tall');
      const chosen = new Set();

      cand.forEach((s) => {
        const lab = h('label', 'md-check');
        lab.dataset.q = (s.title + ' ' + s.artist + ' ' + s.film).toLowerCase();
        const cb = h('input'); cb.type = 'checkbox';
        cb.onchange = () => { if (cb.checked) chosen.add(s.id); else chosen.delete(s.id); info.textContent = chosen.size + ' selected'; };
        const meta = h('span', 'md-ct');
        meta.append(h('b', '', s.title), h('small', '', [s.artist, s.film].filter(Boolean).join(' · ') || 'Unknown artist'));
        lab.append(cb, meta);
        list.appendChild(lab);
      });
      search.oninput = () => {
        const q = search.value.trim().toLowerCase();
        list.querySelectorAll('.md-check').forEach((l) => { l.hidden = !!q && !l.dataset.q.includes(q); });
      };
      box.append(search, info, list);

      S.modal.open({
        title: 'Add songs to “' + p.name + '”', content: box,
        actions: [
          { label: 'Add selected', kind: 'primary', onClick: async () => {
              if (!chosen.size) { S.toast('Select some songs first'); return false; }
              const n = await api.addSongs(id, Array.from(chosen));
              S.toast(n + (n === 1 ? ' song added' : ' songs added'));
          } },
          { label: 'Cancel', kind: 'ghost' }
        ]
      });
    }
  };

  S.lists = api;
})();
