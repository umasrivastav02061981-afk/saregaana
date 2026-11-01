/* ===== library.js — Songs / Films / Singers / Eras, search, edit song info, film posters ===== */
Saregaana.register('library', (function () {
  'use strict';
  const S = window.Saregaana;
  let root, el = {}, offs = [], stopWatch = null, timer = 0;
  const st = { tab: 'songs', q: '', sort: 'recent', detail: null };

  const UNK_FILM = 'Unknown film', UNK_SINGER = 'Unknown singer';
  const ERAS = [
    { id: 'old',      name: 'Old Classics',    range: 'Before 1990',  test: (y) => y > 0 && y < 1990 },
    { id: 'nineties', name: 'Golden Nineties', range: '1990 – 1999',  test: (y) => y >= 1990 && y <= 1999 },
    { id: 'romance',  name: 'Romance Years',   range: '2000 – 2018',  test: (y) => y >= 2000 && y <= 2018 },
    { id: 'new',      name: 'After 2018',      range: '2019 onwards', test: (y) => y > 2018 },
    { id: 'none',     name: 'No year yet',     range: 'Edit a song to add its year', test: (y) => !y }
  ];

  /* ---------- small helpers ---------- */
  const lc = (s) => (s || '').toLowerCase();
  const cmp = (a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' });
  const all = () => S.library.list;
  const ids = (list) => list.map((s) => s.id);
  const filmOf = (s) => (s.film || '').trim() || UNK_FILM;
  const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');
  const eraById = (id) => ERAS.find((e) => e.id === id);
  function singersOf(s) {
    const p = (s.artist || '').split(/\s*(?:,|&|;|\/|\bfeat\.?|\bft\.?)\s*/i).map((x) => x.trim()).filter(Boolean);
    return p.length ? p : [UNK_SINGER];
  }
  function h(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  const matches = (s) => !st.q || lc([s.title, s.artist, s.film].join(' ')).includes(st.q);

  function groupBy(keyFn) {
    const m = new Map();
    all().forEach((s) => keyFn(s).forEach((k) => { if (!m.has(k)) m.set(k, []); m.get(k).push(s); }));
    return Array.from(m, ([name, list]) => ({ name, list }));
  }
  const unknownLast = (unk) => (a, b) => (a.name === unk ? 1 : b.name === unk ? -1 : cmp(a.name, b.name));

  function empty(title, text, withAdd) {
    const d = h('div', 'lb-empty');
    d.append(h('h2', '', title), h('p', '', text));
    if (withAdd) { const b = h('button', '', '+ Add songs'); b.onclick = () => S.go('add'); d.appendChild(b); }
    return d;
  }
  const noSongs = () => empty('Your library is empty', 'Add songs from your phone and they will show up here.', true);
  const noMatch = () => empty('No matches', 'Try another word, or clear the search.', false);

  /* ---------- song list ---------- */
  function songList(list) {
    const ul = h('ul', 'lb-list');
    const idl = ids(list);
    list.forEach((song, i) => ul.appendChild(S.row.create(song, {
      onClick: () => S.bus.emit('song:play', { ids: idl, index: i }),
      onMore: () => editSong(song)
    })));
    stopWatch = S.row.watch(ul);
    return ul;
  }

  /* ---------- the 4 tabs ---------- */
  function viewSongs() {
    if (!all().length) return noSongs();
    let list = all().filter(matches);
    if (!list.length) return noMatch();
    if (st.sort === 'az') list = list.slice().sort((a, b) => cmp(a.title, b.title));
    return songList(list);
  }

  function viewFilms() {
    if (!all().length) return noSongs();
    const groups = groupBy((s) => [filmOf(s)]).filter((g) => !st.q || lc(g.name).includes(st.q) || g.list.some(matches)).sort(unknownLast(UNK_FILM));
    if (!groups.length) return noMatch();
    const grid = h('div', 'lb-grid');
    groups.forEach((g) => {
      const year = (g.list.find((s) => s.year) || {}).year || '';
      grid.appendChild(S.poster.create({
        title: g.name, sub: plural(g.list.length, 'song'), year, song: g.list[0],
        onClick: () => openDetail({ type: 'film', name: g.name })
      }));
    });
    return grid;
  }

  function viewSingers() {
    if (!all().length) return noSongs();
    const groups = groupBy(singersOf).filter((g) => !st.q || lc(g.name).includes(st.q) || g.list.some(matches)).sort(unknownLast(UNK_SINGER));
    if (!groups.length) return noMatch();
    const ul = h('div', 'lb-list');
    groups.forEach((g) => {
      const b = h('button', 'lb-singer');
      b.type = 'button';
      const p = S.posters.palette(g.name);
      const av = h('span', 'lb-av', Array.from(g.name)[0].toUpperCase());
      av.style.background = 'linear-gradient(160deg,' + p.p1 + ',' + p.p2 + ' 160%)';
      const meta = h('span', 'lb-sg-meta');
      meta.append(h('b', '', g.name), h('span', '', plural(g.list.length, 'song')));
      b.append(av, meta, h('span', 'lb-chev', '›'));
      b.onclick = () => openDetail({ type: 'singer', name: g.name });
      ul.appendChild(b);
    });
    return ul;
  }

  function viewEras() {
    if (!all().length) return noSongs();
    const grid = h('div', 'lb-eras');
    ERAS.forEach((e) => {
      const n = all().filter((s) => e.test(s.year || 0)).length;
      if (!n && e.id !== 'old' && e.id !== 'nineties' && e.id !== 'romance') return;   // hide empty extra eras
      const p = S.posters.palette(e.id);
      const b = h('button', 'lb-era');
      b.type = 'button';
      b.style.setProperty('--p1', p.p1); b.style.setProperty('--p2', p.p2);
      b.append(h('b', '', String(n)), h('span', '', e.name), h('small', '', e.range));
      b.onclick = () => { if (n) openDetail({ type: 'era', id: e.id }); else S.toast('No songs in this era yet'); };
      grid.appendChild(b);
    });
    return grid;
  }

  /* ---------- detail page (one film / singer / era) ---------- */
  function detailList(d) {
    if (d.type === 'film') return all().filter((s) => filmOf(s) === d.name);
    if (d.type === 'singer') return all().filter((s) => singersOf(s).includes(d.name));
    const e = eraById(d.id);
    return all().filter((s) => e.test(s.year || 0));
  }

  function viewDetail(list) {
    const d = st.detail;
    const box = h('div', 'lb-detail');

    const back = h('button', 'lb-back');
    back.type = 'button';
    back.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5 8 12l7 7"/></svg>Library';
    back.onclick = () => { st.detail = null; render(); };
    box.appendChild(back);

    const head = h('div', 'lb-dh');
    const dt = h('div', 'lb-dt');
    let title, sub;
    if (d.type === 'film') {
      const year = (list.find((s) => s.year) || {}).year;
      title = d.name; sub = plural(list.length, 'song') + ' · ' + (year || 'year not set');
      head.appendChild(S.poster.create({ title: d.name, year: year || '', song: list[0], big: true, onClick: null }));
    } else if (d.type === 'singer') {
      title = d.name; sub = plural(list.length, 'song');
    } else {
      const e = eraById(d.id); title = e.name; sub = e.range + ' · ' + plural(list.length, 'song');
    }
    dt.append(h('h2', '', title), h('p', '', sub));
    head.appendChild(dt);
    box.appendChild(head);

    const acts = h('div', 'lb-acts');
    const mk = (label, cls, fn) => { const b = h('button', 'lb-act ' + cls, label); b.type = 'button'; b.onclick = fn; acts.appendChild(b); };
    mk('▶ Play', 'main', () => S.bus.emit('song:play', { ids: ids(list), index: 0 }));
    mk('⤮ Shuffle', '', () => S.player.play(ids(list), 0, { shuffleOnce: true }));
    if (d.type === 'film') {
      mk('Poster', '', () => posterSheet(list[0]));
      mk('Set year', '', () => yearSheet(list));
    }
    box.appendChild(acts);
    box.appendChild(songList(list));
    return box;
  }

  function openDetail(d) { st.detail = d; render(); (root.closest('#screen') || {}).scrollTop = 0; }

  /* ---------- sheets (edit song, poster, year) ---------- */
  function field(label, type, value, attrs) {
    const w = h('label', 'md-field');
    w.appendChild(h('span', '', label));
    const i = h('input'); i.type = type; i.value = value == null ? '' : value;
    Object.keys(attrs || {}).forEach((k) => i.setAttribute(k, attrs[k]));
    w.appendChild(i);
    return { wrap: w, input: i };
  }

  function editSong(song) {
    const form = h('div');
    const fTitle = field('Song name', 'text', song.title, { autocomplete: 'off' });
    const fArtist = field('Singer', 'text', song.artist, { autocomplete: 'off' });
    const fFilm = field('Film', 'text', song.film, { autocomplete: 'off', list: 'lbFilms' });
    const fYear = field('Year', 'number', song.year || '', { inputmode: 'numeric', min: '1900', max: '2100', placeholder: 'e.g. 1994' });
    const dl = h('datalist'); dl.id = 'lbFilms';
    Array.from(new Set(all().map((s) => (s.film || '').trim()).filter(Boolean))).sort(cmp).forEach((f) => { const o = h('option'); o.value = f; dl.appendChild(o); });
    form.append(fTitle.wrap, fArtist.wrap, fFilm.wrap, fYear.wrap, dl, h('p', 'md-hint', 'The year decides which radio station and era this song belongs to.'));

    S.modal.open({
      title: 'Edit song', content: form,
      actions: [
        { label: 'Save', kind: 'primary', onClick: async () => {
            const title = fTitle.input.value.trim();
            if (!title) { S.toast('Song name cannot be empty'); return false; }
            const y = parseInt(fYear.input.value, 10);
            await S.db.updateSong(song.id, { title, artist: fArtist.input.value.trim(), film: fFilm.input.value.trim(), year: y >= 1900 && y <= 2100 ? y : 0 });
            S.toast('Song updated');
        } },
        { label: 'Poster', kind: 'ghost', onClick: () => { setTimeout(() => posterSheet(song), 380); } },
        { label: 'Delete', kind: 'danger', onClick: () => {
            setTimeout(async () => {
              const ok = await S.modal.confirm({ title: 'Delete song?', text: '“' + song.title + '” will be removed from this phone.', yes: 'Delete', danger: true });
              if (!ok) return;
              try { await S.db.removeSong(song.id); S.toast('Song deleted'); } catch (e) { S.log('delete', e); S.toast('Could not delete the song'); }
            }, 380);
        } }
      ]
    });
  }

  function posterSheet(song) {
    const box = h('div');
    const file = h('input'); file.type = 'file'; file.accept = 'image/*'; file.hidden = true;
    const hint = h('p', 'md-hint', 'Pick a picture from your gallery. Every song of “' + (song.film || song.title) + '” will use it. It is saved on this phone.');
    box.append(file, hint);

    file.onchange = async () => {
      if (!file.files[0]) return;
      try { await S.posters.set(song, file.files[0]); S.toast('Poster saved'); S.modal.close(); }
      catch (e) { S.log('poster', e); S.toast('Could not use that picture'); }
    };
    S.modal.open({
      title: 'Film poster', content: box,
      actions: [
        { label: 'Choose picture', kind: 'primary', onClick: () => { file.click(); return false; } },
        { label: 'Use default', kind: 'ghost', onClick: async () => { await S.posters.clear(song); S.toast('Default poster restored'); } },
        { label: 'Cancel', kind: 'ghost' }
      ]
    });
  }

  function yearSheet(list) {
    const box = h('div');
    const y = field('Year of the film', 'number', (list.find((s) => s.year) || {}).year || '', { inputmode: 'numeric', min: '1900', max: '2100', placeholder: 'e.g. 1994' });
    box.append(y.wrap, h('p', 'md-hint', 'Sets this year on all ' + plural(list.length, 'song') + ' of this film.'));
    S.modal.open({
      title: 'Set year', content: box,
      actions: [
        { label: 'Save', kind: 'primary', onClick: async () => {
            const v = parseInt(y.input.value, 10);
            if (!(v >= 1900 && v <= 2100)) { S.toast('Enter a year like 1994'); return false; }
            await S.db.updateMany(ids(list), { year: v });
            S.toast('Year saved');
        } },
        { label: 'Cancel', kind: 'ghost' }
      ]
    });
  }

  /* ---------- draw the screen ---------- */
  function render() {
    if (stopWatch) { stopWatch(); stopWatch = null; }
    let node;
    if (st.detail) {
      const list = detailList(st.detail);
      if (list.length) node = viewDetail(list); else st.detail = null;   // group vanished (edited / deleted)
    }
    const inDetail = !!st.detail;
    if (!inDetail) node = { songs: viewSongs, films: viewFilms, singers: viewSingers, eras: viewEras }[st.tab]();

    el.lbSearchWrap.hidden = inDetail;
    el.lbTabs.hidden = inDetail;
    el.lbTools.hidden = inDetail || st.tab !== 'songs';
    el.lbCount.textContent = plural(all().length, 'song');
    el.lbView.textContent = '';
    el.lbView.appendChild(node);
  }

  function init(mount) {
    root = mount; offs = []; st.detail = null;
    ['lbCount', 'lbSearchWrap', 'lbSearch', 'lbClear', 'lbTabs', 'lbTools', 'lbView', 'lbShuffleAll']
      .forEach((id) => { el[id] = root.querySelector('#' + id); });

    S.$$('#lbTabs button', root).forEach((b) => b.addEventListener('click', () => {
      st.tab = b.dataset.tab;
      S.$$('#lbTabs button', root).forEach((x) => x.classList.toggle('on', x === b));
      render();
    }));
    S.$$('.lb-chip[data-sort]', root).forEach((b) => b.addEventListener('click', () => {
      st.sort = b.dataset.sort;
      S.$$('.lb-chip[data-sort]', root).forEach((x) => x.classList.toggle('on', x === b));
      render();
    }));
    el.lbSearch.addEventListener('input', () => {
      el.lbClear.hidden = !el.lbSearch.value;
      clearTimeout(timer);
      timer = setTimeout(() => { st.q = lc(el.lbSearch.value.trim()); render(); }, 130);
    });
    el.lbClear.addEventListener('click', () => { el.lbSearch.value = ''; el.lbClear.hidden = true; st.q = ''; render(); el.lbSearch.focus(); });
    el.lbShuffleAll.addEventListener('click', () => {
      if (!all().length) { S.toast('Add songs first'); return; }
      S.player.play(ids(all()), 0, { shuffleOnce: true });
    });

    offs.push(S.bus.on('library:changed', render));
    render();
  }

  function destroy() {
    clearTimeout(timer);
    offs.forEach((f) => f()); offs = [];
    if (stopWatch) { stopWatch(); stopWatch = null; }
  }

  return { init, destroy };
})());
