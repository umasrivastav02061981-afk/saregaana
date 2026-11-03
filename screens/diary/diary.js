/* ==========================================
   SAREGAANA MUSIC DIARY
   Phase 3 — Rich Text + Photo Attachments
========================================== */

Saregaana.register('diary', (function () {
  'use strict';

  const S = window.Saregaana;
  const MAX_PHOTOS = 8;
  const MAX_FILE_SIZE = 8 * 1024 * 1024;
  const ALLOWED_TYPES = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif'
  ];

  let root = null;
  let entries = [];
  let activeFilter = 'all';
  let searchTerm = '';
  let editingId = null;
  let existingPhotos = [];
  let removedPhotoIds = [];
  let draftPhotos = [];
  let objectUrls = [];
  let offs = [];

  /* ---------- HELPERS ---------- */

  function localDate() {
    const d = new Date();
    return [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, '0'),
      String(d.getDate()).padStart(2, '0')
    ].join('-');
  }

  function formatDate(value) {
    if (!value) return 'Date not set';

    const d = new Date(value + 'T12:00:00');

    if (Number.isNaN(d.getTime())) return value;

    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  }

  function toast(message) {
    if (typeof S.toast === 'function') S.toast(message);
  }

  function makeButton(label, action, id) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.dataset.action = action;
    if (id) b.dataset.id = id;
    return b;
  }

  function escapeText(value) {
    return String(value || '');
  }

  function registerUrl(url) {
    objectUrls.push(url);
    return url;
  }

  function clearObjectUrls() {
    objectUrls.forEach(url => URL.revokeObjectURL(url));
    objectUrls = [];
  }

  function clearDraftPhotos() {
    clearObjectUrls();
    draftPhotos = [];
    existingPhotos = [];
    removedPhotoIds = [];

    const preview = root && root.querySelector('#mdPhotoPreview');
    if (preview) preview.textContent = '';
  }

  /* ---------- RICH TEXT SANITISER ---------- */

  const ALLOWED_TAGS = new Set([
    'P', 'BR', 'STRONG', 'B', 'EM', 'I', 'U',
    'H2', 'H3', 'UL', 'OL', 'LI', 'BLOCKQUOTE'
  ]);

  const BLOCK_TAGS = new Set([
    'P', 'H2', 'H3', 'LI', 'BLOCKQUOTE'
  ]);

  function cleanNode(node, output) {
    if (node.nodeType === Node.TEXT_NODE) {
      output.appendChild(document.createTextNode(node.nodeValue || ''));
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const tag = node.tagName;

    if (
      tag === 'SCRIPT' || tag === 'STYLE' ||
      tag === 'IFRAME' || tag === 'OBJECT' ||
      tag === 'EMBED' || tag === 'SVG' ||
      tag === 'MATH' || tag === 'FORM' ||
      tag === 'INPUT' || tag === 'VIDEO' ||
      tag === 'AUDIO'
    ) {
      return;
    }

    if (!ALLOWED_TAGS.has(tag)) {
      Array.from(node.childNodes).forEach(child => {
        cleanNode(child, output);
      });
      return;
    }

    const clean = document.createElement(tag.toLowerCase());

    Array.from(node.childNodes).forEach(child => {
      cleanNode(child, clean);
    });

    output.appendChild(clean);
  }

  function sanitiseHtml(html) {
    const parser = new DOMParser();
    const parsed = parser.parseFromString(
      String(html || ''),
      'text/html'
    );

    const result = document.createElement('div');

    Array.from(parsed.body.childNodes).forEach(node => {
      cleanNode(node, result);
    });

    return result.innerHTML;
  }

  function htmlToText(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(
      String(html || ''),
      'text/html'
    );

    return (doc.body.textContent || '')
      .replace(/\u00a0/g, ' ')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
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

      root.querySelector('#mdEntryCount').textContent =
        entries.length;

      root.querySelector('#mdTrashCount').textContent =
        (trash || []).length;

      const photoResults = await Promise.all(
        entries.map(entry => S.db.getDiaryPhotos(entry.id))
      );

      if (!root) return;

      root.querySelector('#mdPhotoCount').textContent =
        photoResults.reduce(
          (total, photos) => total + (photos || []).length,
          0
        );

      renderEntries();

    } catch (error) {
      S.log('diary:refresh', error);
      toast('Could not load Diary entries');
    }
  }

  /* ---------- ENTRY LIST ---------- */

  function renderEntries() {
    if (!root) return;

    const container = root.querySelector('#mdEntries');
    const empty = root.querySelector('#mdEmpty');
    const emptyTitle = root.querySelector('#mdEmptyTitle');
    const emptyText = root.querySelector('#mdEmptyText');
    const emptyAdd = root.querySelector('#mdEmptyAdd');

    container.textContent = '';

    let filtered = entries.slice();

    if (activeFilter === 'favorites') {
      filtered = filtered.filter(entry => entry.favorite);
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();

      filtered = filtered.filter(entry => (
        (entry.title || '').toLowerCase().includes(term) ||
        (entry.body || '').toLowerCase().includes(term) ||
        (entry.mood || '').toLowerCase().includes(term)
      ));
    }

    if (!filtered.length) {
      empty.hidden = false;

      if (!entries.length) {
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
    preview.textContent = body.length > 145
      ? body.slice(0, 145) + '…'
      : body;

    const full = document.createElement('div');
    full.className = 'md-entry-full';
    full.hidden = true;

    if (entry.bodyHtml) {
      full.innerHTML = sanitiseHtml(entry.bodyHtml);
    } else {
      full.textContent = body;
    }

    const photoArea = document.createElement('div');
    photoArea.className = 'md-entry-photos';
    photoArea.hidden = true;

    const actions = document.createElement('div');
    actions.className = 'md-entry-actions';

    actions.append(
      makeButton('Read Memory', 'read', entry.id),
      makeButton(
        entry.favorite ? '♥ Favourited' : '♡ Favourite',
        'favorite',
        entry.id
      ),
      makeButton('Edit', 'edit', entry.id),
      makeButton('Move to Trash', 'trash', entry.id)
    );

    card.append(top, title, preview, full, photoArea, actions);
    return card;
  }

  async function loadCardPhotos(card, entryId) {
    const area = card.querySelector('.md-entry-photos');
    if (!area || area.dataset.loaded === 'yes') return;

    area.textContent = '';

    try {
      const photos = await S.db.getDiaryPhotos(entryId);

      if (!root || !card.isConnected) return;

      (photos || []).forEach(photo => {
        if (!photo.blob) return;

        const img = document.createElement('img');
        img.alt = 'Diary photograph';
        img.loading = 'lazy';
        img.src = registerUrl(URL.createObjectURL(photo.blob));
        area.appendChild(img);
      });

      area.dataset.loaded = 'yes';
      area.hidden = area.children.length === 0;

    } catch (error) {
      S.log('diary:load-card-photos', error);
      toast('Could not load attached photos');
    }
  }

  /* ---------- EDITOR ---------- */

  function runEditorCommand(command, value) {
    const editor = root && root.querySelector('#mdBody');
    if (!editor) return;

    editor.focus();

    if (command === 'formatBlock') {
      document.execCommand('formatBlock', false, value);
    } else {
      document.execCommand(command, false, null);
    }
  }

  function renderPhotoPreview() {
    const preview = root.querySelector('#mdPhotoPreview');
    preview.textContent = '';

    existingPhotos
      .filter(photo => !removedPhotoIds.includes(photo.id))
      .forEach(photo => {
        if (!photo.blob) return;

        const item = document.createElement('div');
        item.className = 'md-photo-item';

        const img = document.createElement('img');
        img.alt = 'Attached photograph';
        img.src = registerUrl(URL.createObjectURL(photo.blob));

        const remove = makeButton('×', 'remove-existing-photo', photo.id);
        remove.className = 'md-photo-remove';
        remove.setAttribute('aria-label', 'Remove photo');

        item.append(img, remove);
        preview.appendChild(item);
      });

    draftPhotos.forEach((file, index) => {
      const item = document.createElement('div');
      item.className = 'md-photo-item';

      const img = document.createElement('img');
      img.alt = 'New photograph preview';
      img.src = registerUrl(URL.createObjectURL(file));

      const remove = makeButton('×', 'remove-draft-photo', String(index));
      remove.className = 'md-photo-remove';
      remove.setAttribute('aria-label', 'Remove photo');

      item.append(img, remove);
      preview.appendChild(item);
    });
  }

  async function openForm(entry) {
    if (!root) return;

    clearDraftPhotos();

    const wrap = root.querySelector('#mdFormWrap');
    const heading = root.querySelector('#mdFormHeading');
    const title = root.querySelector('#mdTitle');
    const date = root.querySelector('#mdDate');
    const mood = root.querySelector('#mdMood');
    const body = root.querySelector('#mdBody');

    editingId = entry ? entry.id : null;

    heading.textContent = entry ? 'Edit Memory' : 'Write an Entry';
    title.value = entry ? entry.title || '' : '';
    date.value = entry ? entry.entryDate || localDate() : localDate();
    mood.value = entry ? entry.mood || 'No mood' : 'No mood';

    body.innerHTML = entry
      ? sanitiseHtml(entry.bodyHtml || '')
      : '';

    root.querySelector('#mdSave').textContent =
      entry ? 'Update Memory' : 'Save Memory';

    wrap.hidden = false;

    if (entry) {
      try {
        existingPhotos = await S.db.getDiaryPhotos(entry.id) || [];
      } catch (error) {
        S.log('diary:edit-photos', error);
        toast('Could not load existing photos');
      }
    }

    renderPhotoPreview();

    wrap.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });

    title.focus();
  }

  function closeForm() {
    if (!root) return;

    root.querySelector('#mdEntryForm').reset();
    root.querySelector('#mdBody').innerHTML = '';
    root.querySelector('#mdFormWrap').hidden = true;

    editingId = null;
    clearDraftPhotos();
  }

  /* ---------- PHOTO INPUT ---------- */

  function addPhotoFiles(fileList) {
    const files = Array.from(fileList || []);
    let added = 0;

    const currentCount =
      existingPhotos.filter(p => !removedPhotoIds.includes(p.id)).length +
      draftPhotos.length;

    files.forEach(file => {
      if (!ALLOWED_TYPES.includes(file.type)) {
        toast('Unsupported image format');
        return;
      }

      if (file.size > MAX_FILE_SIZE) {
        toast('Each photo must be 8 MB or smaller');
        return;
      }

      if (currentCount + added >= MAX_PHOTOS) {
        toast('You can attach up to 8 photos');
        return;
      }

      draftPhotos.push(file);
      added++;
    });

    renderPhotoPreview();
  }

  /* ---------- SAVE ENTRY ---------- */

  async function saveEntry(event) {
    event.preventDefault();
    if (!root) return;

    const title = root.querySelector('#mdTitle').value.trim();
    const date = root.querySelector('#mdDate').value || localDate();
    const mood = root.querySelector('#mdMood').value;

    const bodyHtml = sanitiseHtml(
      root.querySelector('#mdBody').innerHTML
    );

    const body = htmlToText(bodyHtml);

    if (!title) {
      toast('Please enter a title');
      return;
    }

    const wasEditing = !!editingId;
    const previous = wasEditing
      ? entries.find(entry => entry.id === editingId)
      : null;

    const id = wasEditing ? editingId : S.uid();
    const saveButton = root.querySelector('#mdSave');

    const newPhotoIds = [];
    let entrySaved = false;

    saveButton.disabled = true;
    saveButton.textContent = 'Saving...';

    try {
      for (const file of draftPhotos) {
        const photoId = await S.db.saveDiaryPhoto(id, file);
        newPhotoIds.push(photoId);
      }

      const keptPhotoIds = existingPhotos
        .filter(photo => !removedPhotoIds.includes(photo.id))
        .map(photo => photo.id);

      const record = {
        id,
        title,
        entryDate: date,
        mood,
        body,
        bodyHtml,
        photoIds: keptPhotoIds.concat(newPhotoIds),
        favorite: previous ? !!previous.favorite : false,
        createdAt: previous
          ? previous.createdAt
          : Date.now()
      };

      await S.db.saveDiaryEntry(record);
      entrySaved = true;

      // Delete removed old photos only after the entry is safely saved.
      for (const photoId of removedPhotoIds) {
        try {
          await S.db.deleteDiaryPhoto(photoId);
        } catch (cleanupError) {
          S.log('diary:old-photo-cleanup', cleanupError);
        }
      }

      closeForm();
      await refresh();

      toast(wasEditing ? 'Memory updated' : 'Memory saved');

    } catch (error) {
      S.log('diary:save', error);

      // Roll back newly created photo records only if the entry itself
      // did not save. Never remove photos referenced by a saved entry.
      if (!entrySaved) {
        for (const photoId of newPhotoIds) {
          try {
            await S.db.deleteDiaryPhoto(photoId);
          } catch (cleanupError) {
            S.log('diary:photo-rollback', cleanupError);
          }
        }
      }

      toast('Could not save this memory');

    } finally {
      if (root && root.querySelector('#mdSave')) {
        saveButton.disabled = false;
        saveButton.textContent = wasEditing
          ? 'Update Memory'
          : 'Save Memory';
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

      toast(!entry.favorite
        ? 'Added to favourites'
        : 'Removed from favourites');

    } catch (error) {
      S.log('diary:favorite', error);
      toast('Could not update favourite');
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
      toast('Entry moved to Trash');
    } catch (error) {
      S.log('diary:trash', error);
      toast('Could not move entry to Trash');
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

    if (button.dataset.command) {
      runEditorCommand(
        button.dataset.command,
        button.dataset.value
      );
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

    if (action === 'remove-existing-photo') {
      if (!removedPhotoIds.includes(id)) {
        removedPhotoIds.push(id);
      }
      renderPhotoPreview();
      return;
    }

    if (action === 'remove-draft-photo') {
      const index = Number(id);
      if (Number.isInteger(index)) {
        draftPhotos.splice(index, 1);
      }
      renderPhotoPreview();
      return;
    }

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

      if (!full.hidden) {
        await loadCardPhotos(card, id);
      }

    } else if (action === 'edit') {
      await openForm(entry);

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
      handleClick(event).catch(error => {
        S.log('diary:click', error);
        toast('Something went wrong');
      });
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
    const photoHandler = event => {
      addPhotoFiles(event.target.files);
      event.target.value = '';
    };

    root.addEventListener('click', clickHandler);
    root.addEventListener('submit', submitHandler);

    root.querySelector('#mdSearch')
      .addEventListener('input', searchHandler);

    root.querySelector('#mdPhotoInput')
      .addEventListener('change', photoHandler);

    offs.push(() => {
      if (!root) return;

      root.removeEventListener('click', clickHandler);
      root.removeEventListener('submit', submitHandler);

      root.querySelector('#mdSearch')
        ?.removeEventListener('input', searchHandler);
        root.querySelector('#mdPhotoInput')
        ?.removeEventListener('change', photoHandler);
    });

    await refresh();

    offs.push(S.bus.on('diary:changed', refresh));
  }
  /* ---------- DESTROY ---------- */

  function destroy() {
    offs.forEach(off => {
      try {
        off();
      } catch (error) {}
    });

    offs = [];
    clearObjectUrls();
    entries = [];
    draftPhotos = [];
    existingPhotos = [];
    removedPhotoIds = [];
    root = null;
    editingId = null;
  }

  return { init, destroy };

})());