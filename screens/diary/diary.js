/* ===== Music Diary — Phase 1 foundation ===== */

Saregaana.register('diary', (function () {
  'use strict';

  const S = window.Saregaana;

  let root = null;
  let offs = [];

  async function refresh() {
    if (!root) return;

    try {
      const [entries, trash] = await Promise.all([
        S.db.getDiaryEntries(),
        S.db.getTrashedDiaryEntries()
      ]);

      const entryCount = root.querySelector('#mdEntryCount');
      const trashCount = root.querySelector('#mdTrashCount');
      const photoCount = root.querySelector('#mdPhotoCount');

      if (entryCount) entryCount.textContent = entries.length;
      if (trashCount) trashCount.textContent = trash.length;

      if (photoCount) {
        const total = await Promise.all(
          entries.map(async entry => {
            const photos = await S.db.getDiaryPhotos(entry.id);
            return photos.length;
          })
        );

        photoCount.textContent = total.reduce(
          (sum, count) => sum + count,
          0
        );
      }

    } catch (error) {
      S.log('diary:refresh', error);
      S.toast('Could not load Diary information');
    }
  }

  async function init(mount) {
    root = mount;
    offs = [];

    await refresh();

    offs.push(
      S.bus.on('diary:changed', refresh)
    );
  }

  function destroy() {
    offs.forEach(off => off());
    offs = [];
    root = null;
  }

  return { init, destroy };

})());