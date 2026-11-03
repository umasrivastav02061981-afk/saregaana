/* ==========================================
   SAREGAANA MUSIC DIARY
   Phase 2 — Entry Management
========================================== */

Saregaana.register('diary', (function () {
  'use strict';

  const S = window.Saregaana;

  let root = null;
  let entries = [];
  let activeFilter = 'all';
  let searchTerm = '';
  let editingId = null;
  let offs = [];

  /* ---------- HELPERS ---------- */

  function localDate() {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  function formatDate(value) {
    if (!value) return 'Date not set';

    const date = new Date(value + 'T12:00:00');

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  }

  function createButton(label, action, id) {
    const button = document.createElement('button');

    button.type = 'button';
    button.textContent = label;
    button.dataset.action = action;

    if (id) button.dataset.id = id;

    return button;
  }

  function showToast(message) {
    if (typeof S.toast === 'function') {
      S.toast(message);
    }
  }

  /* ---------- LOAD DATA ---------- */

  async function refresh() {
    if (!root) return;

    try {
      const [allEntries, trash] = await Promise.all([
        S.db.getDiaryEntries(),
        S.db.getTrashedDiaryEntries()
      ]);

      if (!root) return;

      entries = allEntries || [];

      const entryCount = root.querySelector('#mdEntryCount');
      const trashCount = root.querySelector('#mdTrashCount');
      const photoCount = root.querySelector('#mdPhotoCount');

      if (entryCount) {
        entryCount.textContent = entries.length;
      }

      if (trashCount) {
        trashCount.textContent = trash.length;
      }

      if (photoCount) {
        const photoResults = await Promise.all(
          entries.map(entry =>
            S.db.getDiaryPhotos(entry.id)
          )
        );

        photoCount.textContent = photoResults.reduce(
          (total, photos) => total + photos.length,
          0
        );
      }

      renderEntries();

    } catch (error) {
      S.log('diary:refresh', error);
      showToast('Could not load Diary entries');
    }
  }

  /* ---------- RENDER ENTRIES ---------- */

  function renderEntries() {
    if (!root) return;

    const container = root.querySelector('#mdEntries');
    const empty = root.querySelector('#mdEmpty');
    const emptyTitle = root.querySelector('#mdEmptyTitle');
    const emptyText = root.querySelector('#mdEmptyText');
    const emptyAdd = root.querySelector('#mdEmptyAdd');

    if (!container || !empty) return;

    container.textContent = '';

    let filtered = entries.slice();

    if (activeFilter === 'favorites') {
      filtered = filtered.filter(entry => entry.favorite);
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();

      filtered = filtered.filter(entry => {
        return (
          (entry.title || '').toLowerCase().includes(term) ||
          (entry.body || '').toLowerCase().includes(term) ||
          (entry.mood || '').toLowerCase().includes(term)
        );
      });
    }

    if (filtered.length === 0) {
      empty.hidden = false;

      if (entries.length === 0) {
        emptyTitle.textContent = 'Your story starts here.';
        emptyText.textContent =
          'Create your first diary entry and give your memories a permanent place.';
        emptyAdd.hidden = false;
      } else {
        emptyTitle.textContent = 'No memories found.';
        emptyText.textContent =
          'Try another search or change your current filter.';
        emptyAdd.hidden = true;
      }

      return;
    }

    empty.hidden = true;

    const fragment = document.createDocumentFragment();

    filtered.forEach(entry => {
      fragment.appendChild(createEntryCard(entry));
    });

    container.appendChild(fragment);
  }

  function createEntryCard(entry) {
    const card = document.createElement('article');
    card.className = 'md-entry-card';
    card.dataset.id = entry.id;

    const top = document.createElement('div');
    top.className = 'md-entry-top';

    const mood = document.createElement('span');
    mood.className = 'md-entry-mood';
    mood.textContent = entry.mood || 'No mood';

    const date = document.createElement('span');
    date.className = 'md-entry-date';
    date.textContent = formatDate(entry.entryDate);

    top.append(mood, date);

    const title = document.createElement('h3');
    title.textContent = entry.title || 'Untitled Memory';

    const preview = document.createElement('p');
    preview.className = 'md-entry-preview';

    const body = entry.body || 'No written memory yet.';

    preview.textContent =
      body.length > 145
        ? body.slice(0, 145) + '…'
        : body;

    const full = document.createElement('div');
    full.className = 'md-entry-full';
    full.hidden = true;
    full.textContent = body;

    const actions = document.createElement('div');
    actions.className = 'md-entry-actions';

    actions.append(
      createButton('Read Memory', 'read', entry.id),
      createButton(
        entry.favorite ? '♥ Favourited' : '♡ Favourite',
        'favorite',
        entry.id
      ),
      createButton('Edit', 'edit', entry.id),
      createButton('Move to Trash', 'trash', entry.id)
    );

    card.append(
      top,
      title,
      preview,
      full,
      actions
    );

    return card;
  }

  /* ---------- FORM ---------- */

  function openForm(entry) {
    if (!root) return;

    const wrap = root.querySelector('#mdFormWrap');
    const heading = root.querySelector('#mdFormHeading');

    const title = root.querySelector('#mdTitle');
    const date = root.querySelector('#mdDate');
    const mood = root.querySelector('#mdMood');
    const body = root.querySelector('#mdBody');

    editingId = entry ? entry.id : null;

    heading.textContent = entry
      ? 'Edit Memory'
      : 'Write an Entry';

    title.value = entry ? entry.title || '' : '';
    date.value = entry
      ? entry.entryDate || localDate()
      : localDate();

    mood.value = entry
      ? entry.mood || 'No mood'
      : 'No mood';

    body.value = entry ? entry.body || '' : '';

    wrap.hidden = false;

    root.querySelector('#mdSave').textContent = entry
      ? 'Update Memory'
      : 'Save Memory';

    wrap.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });

    title.focus();
  }

  function closeForm() {
    if (!root) return;

    const form = root.querySelector('#mdEntryForm');

    form.reset();

    root.querySelector('#mdFormWrap').hidden = true;

    editingId = null;
  }

  async function saveEntry(event) {
    event.preventDefault();

    if (!root) return;

    const title = root.querySelector('#mdTitle').value.trim();
    const date = root.querySelector('#mdDate').value;
    const mood = root.querySelector('#mdMood').value;
    const body = root.querySelector('#mdBody').value.trim();

    if (!title) {
      showToast('Please enter a title');
      return;
    }

    const previous = editingId
      ? entries.find(entry => entry.id === editingId)
      : null;

    const record = {
      title,
      entryDate: date || localDate(),
      mood,
      body,
      favorite: previous ? !!previous.favorite : false
    };

    if (editingId) {
      record.id = editingId;
      record.createdAt = previous
        ? previous.createdAt
        : Date.now();
    }

    const saveButton = root.querySelector('#mdSave');
    saveButton.disabled = true;
    saveButton.textContent = 'Saving...';

    try {
      await S.db.saveDiaryEntry(record);

      closeForm();
      await refresh();

      showToast(
        editingId
          ? 'Memory updated'
          : 'Memory saved'
      );

    } catch (error) {
      S.log('diary:save', error);
      showToast('Could not save this memory');

    } finally {
      if (root && root.querySelector('#mdSave')) {
        const button = root.querySelector('#mdSave');
        button.disabled = false;
        button.textContent = 'Save Memory';
      }
    }
  }

  /* ---------- FAVOURITES ---------- */

  async function toggleFavorite(id) {
    const entry = entries.find(item => item.id === id);

    if (!entry) return;

    try {
      await S.db.saveDiaryEntry({
        ...entry,
        favorite: !entry.favorite
      });

      await refresh();

      showToast(
        !entry.favorite
          ? 'Added to favourites'
          : 'Removed from favourites'
      );

    } catch (error) {
      S.log('diary:favorite', error);
      showToast('Could not update favourite');
    }
  }

  /* ---------- TRASH ---------- */

  async function moveToTrash(id) {
    const entry = entries.find(item => item.id === id);

    if (!entry) return;

    let confirmed = false;

    if (S.modal && typeof S.modal.confirm === 'function') {
      confirmed = await S.modal.confirm({
        title: 'Move to Trash?',
        text: `Move "${entry.title}" to your Diary Recycle Bin? You can restore it later.`,
        yes: 'Move to Trash',
        danger: true
      });
    } else {
      confirmed = window.confirm(
        'Move this diary entry to Trash?'
      );
    }

    if (!confirmed) return;

    try {
      await S.db.moveDiaryToTrash(id);
      await refresh();

      showToast('Entry moved to Trash');

    } catch (error) {
      S.log('diary:trash', error);
      showToast('Could not move entry to Trash');
    }
  }

  /* ---------- CLICK HANDLER ---------- */

  async function handleClick(event) {
    if (!root) return;

    const button = event.target.closest('button');

    if (!button || !root.contains(button)) return;

    if (button.id === 'mdNewEntry' ||
        button.id === 'mdEmptyAdd') {
      openForm(null);
      return;
    }

    if (button.id === 'mdCancel') {
      closeForm();
      return;
    }

    if (button.dataset.filter) {
      activeFilter = button.dataset.filter;

      root.querySelectorAll('.md-filter').forEach(item => {
        item.classList.toggle(
          'active',
          item.dataset.filter === activeFilter
        );
      });

      renderEntries();
      return;
    }

    const action = button.dataset.action;
    const id = button.dataset.id;

    if (!action || !id) return;

    const entry = entries.find(item => item.id === id);

    if (!entry) return;

    if (action === 'read') {
      const card = button.closest('.md-entry-card');
      const full = card.querySelector('.md-entry-full');

      full.hidden = !full.hidden;

      button.textContent = full.hidden
        ? 'Read Memory'
        : 'Close Memory';

    } else if (action === 'edit') {
      openForm(entry);

    } else if (action === 'favorite') {
      await toggleFavorite(id);

    } else if (action === 'trash') {
      await moveToTrash(id);
    }
  }

  /* ---------- INITIALISE ---------- */

  async function init(mount) {
    root = mount;

    entries = [];
    activeFilter = 'all';
    searchTerm = '';
    editingId = null;
    offs = [];

    const clickHandler = event => {
      handleClick(event);
    };

    const submitHandler = event => {
      if (event.target.id === 'mdEntryForm') {
        saveEntry(event);
      }
    };

    const searchHandler = event => {
      searchTerm = event.target.value.trim();
      renderEntries();
    };

    root.addEventListener('click', clickHandler);
    root.addEventListener('submit', submitHandler);

    root.querySelector('#mdSearch')
      .addEventListener('input', searchHandler);

    offs.push(() => {
      if (!root) return;

      root.removeEventListener('click', clickHandler);
      root.removeEventListener('submit', submitHandler);
    });

    await refresh();

    offs.push(
      S.bus.on('diary:changed', refresh)
    );
  }

  /* ---------- DESTROY ---------- */

  function destroy() {
    offs.forEach(off => {
      try {
        off();
      } catch (error) {}
    });

    offs = [];
    entries = [];
    root = null;
    editingId = null;
  }

  return {
    init,
    destroy
  };

})());