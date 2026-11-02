
/* SAREGAANA — MIXTAPE STUDIO
   Uses the existing playlist engine. No database migration. */

Saregaana.register('mixtape', (function () {
  'use strict';

  const S = window.Saregaana;
  const META_KEY = 'mixtapes';

  let root, el = {}, offs = [];
  let selected = new Set();
  let selectedColor = '#762b36';

  const getMeta = () => S.store.get(META_KEY, {});
  const saveMeta = (data) => S.store.set(META_KEY, data);

  function h(tag, cls, value) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (value != null) n.textContent = value;
    return n;
  }

  function updatePreview() {
    const title = el.title.value.trim() || 'Untitled Mixtape';
    const mood = el.mood.value;
    el.previewTitle.textContent = title;
    el.previewMood.textContent = el.note.value.trim() || mood;
    el.previewCount.textContent = selected.size + ' TRACKS';
    el.preview.style.setProperty('--mx-tone', selectedColor);
    el.selected.textContent = selected.size + ' selected';
  }

  function renderSongs() {
    const query = el.search.value.trim().toLowerCase();
    const songs = S.library.list.filter(song => {
      const haystack = [song.title, song.artist, song.film].join(' ').toLowerCase();
      return haystack.includes(query);
    });

    el.songList.textContent = '';
    el.noSongs.hidden = S.library.list.length > 0;

    songs.forEach(song => {
      const label = h('label', 'mx-song');
      const art = h('span', 'mx-song-art', '♪');
      const info = h('span', 'mx-song-info');
      info.append(
        h('b', '', song.title),
        h('small', '', [song.artist, song.film].filter(Boolean).join(' · ') || 'Unknown artist')
      );

      const check = document.createElement('input');
      check.type = 'checkbox';
      check.checked = selected.has(song.id);
      check.setAttribute('aria-label', 'Add ' + song.title);

      check.addEventListener('change', () => {
        if (check.checked) selected.add(song.id);
        else selected.delete(song.id);
        updatePreview();
      });

      label.append(art, info, check);
      el.songList.appendChild(label);
    });

    if (S.library.list.length && !songs.length) {
      el.songList.appendChild(h('p', 'mx-empty', 'No songs match your search.'));
    }
  }

  function renderSaved() {
    const meta = getMeta();
    el.saved.textContent = '';

    const entries = Object.entries(meta).filter(([id]) => {
      return !!S.lists.get(id);
    });

    if (!entries.length) {
      el.saved.appendChild(h('p', 'mx-empty',
        'Your mixtape collection is waiting. Create your first one above.'
      ));
      return;
    }

    entries.forEach(([id, data]) => {
      const playlist = S.lists.get(id);
      if (!playlist) return;

      const card = h('article', 'mx-saved-card');
      const art = h('div', 'mx-saved-art', '♪');
      art.style.setProperty('--mx-tone', data.color || '#762b36');

      const info = h('div', 'mx-saved-info');
      info.append(
        h('b', '', playlist.name),
        h('small', '', playlist.songIds.length + ' songs · ' + (data.mood || 'Personal collection'))
      );

      const actions = h('div', 'mx-saved-actions');
      const play = h('button', '', '▶ Play');
      play.type = 'button';
      play.disabled = !playlist.songIds.length;
      play.addEventListener('click', () => {
        S.bus.emit('song:play', { ids: playlist.songIds.slice(), index: 0 });
      });

      const remove = h('button', 'delete', 'Delete');
      remove.type = 'button';
      remove.addEventListener('click', async () => {
        const ok = await S.modal.confirm({
          title: 'Delete this mixtape?',
          text: 'The mixtape will be removed, but the original songs will remain in your library.',
          yes: 'Delete',
          danger: true
        });
        if (!ok) return;

        try {
          await S.lists.remove(id);
          const latest = getMeta();
          delete latest[id];
          saveMeta(latest);
          renderSaved();
          S.toast('Mixtape deleted');
        } catch (error) {
          S.log('mixtape-delete', error);
          S.toast('Could not delete this mixtape');
        }
      });

      actions.append(play, remove);
      card.append(art, info, actions);
      el.saved.appendChild(card);
    });
  }

  async function createMixtape() {
    const name = el.title.value.trim();

    if (!name) {
      S.toast('Give your mixtape a title first');
      el.title.focus();
      return;
    }

    if (!selected.size) {
      S.toast('Choose at least one song');
      return;
    }

    const ids = Array.from(selected).filter(id => S.library.get(id));
    if (!ids.length) {
      S.toast('Those songs are no longer in your library');
      return;
    }

    el.create.disabled = true;
    el.create.textContent = 'CREATING YOUR MIXTAPE…';

    try {
      const playlist = await S.lists.create(name);
      await S.lists.addSongs(playlist.id, ids);

      const meta = getMeta();
      meta[playlist.id] = {
        color: selectedColor,
        mood: el.mood.options[el.mood.selectedIndex].text,
        note: el.note.value.trim(),
        created: Date.now()
      };
      saveMeta(meta);

      selected.clear();
      el.title.value = '';
      el.note.value = '';
      el.mood.selectedIndex = 0;
      el.search.value = '';

      updatePreview();
      renderSongs();
      renderSaved();

      S.toast('Your mixtape has been created!');
      S.buzz(35);
    } catch (error) {
      S.log('mixtape-create', error);
      S.toast('Could not create your mixtape');
    } finally {
      el.create.disabled = false;
      el.create.innerHTML = 'CREATE MY MIXTAPE <span>↗</span>';
    }
  }

  function chooseColor(button) {
    selectedColor = button.dataset.color;
    root.querySelectorAll('.mx-swatch').forEach(swatch => {
      swatch.classList.toggle('active', swatch === button);
    });
    updatePreview();
  }

  function init(mount) {
    root = mount;
    offs = [];
    selected = new Set();
    selectedColor = '#762b36';

    const ids = [
      'mxBack', 'mxPreview', 'mxPreviewTitle', 'mxPreviewMood',
      'mxPreviewCount', 'mxTitle', 'mxNote', 'mxMood',
      'mxSwatches', 'mxSelected', 'mxSearch', 'mxSongList',
      'mxNoSongs', 'mxCreate', 'mxSaved'
    ];

    ids.forEach(id => {
      const key = id.replace(/^mx/, '');
      el[key.charAt(0).toLowerCase() + key.slice(1)] =
        root.querySelector('#' + id);
    });

    el.back.addEventListener('click', () => S.go('playlists'));
    el.title.addEventListener('input', updatePreview);
    el.note.addEventListener('input', updatePreview);
    el.mood.addEventListener('change', updatePreview);
    el.search.addEventListener('input', renderSongs);
    el.create.addEventListener('click', createMixtape);

    el.swatches.addEventListener('click', event => {
      const button = event.target.closest('.mx-swatch');
      if (button) chooseColor(button);
    });

    offs.push(S.bus.on('library:changed', renderSongs));
    offs.push(S.bus.on('playlists:changed', renderSaved));

    renderSongs();
    renderSaved();
    updatePreview();
  }

  function destroy() {
    offs.forEach(off => off());
    offs = [];
  }

  return { init, destroy };
})());
