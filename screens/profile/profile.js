/* ===== profile.js — local listener profile =====
   Uses S.store for profile preferences.
   Uses S.library for live collection information.
   No online account or server required.
*/

Saregaana.register('profile', (function () {
  'use strict';

  const S = window.Saregaana;

  const DEFAULT_PROFILE = {
    name: 'Music Lover',
    bio: 'A little music, a lot of memories.',
    avatar: '🎙️'
  };

  const AVATARS = [
    '🎙️', '🎧', '🎼', '🎵',
    '🎸', '🎹', '📻', '💿',
    '🎻', '🎺', '🎷', '🎤'
  ];

  let mount = null;
  let offs = [];
  let listeners = [];

  function getProfile() {
    const saved = S.store.get('profile', {});
    return Object.assign({}, DEFAULT_PROFILE, saved || {});
  }

  function saveProfile(profile) {
    S.store.set('profile', profile);
    render();
    S.toast('Profile updated successfully');
  }

  function listen(element, event, callback) {
    if (!element) return;

    element.addEventListener(event, callback);
    listeners.push(() => {
      element.removeEventListener(event, callback);
    });
  }

  function render() {
    if (!mount) return;

    const profile = getProfile();

    const name = S.$('#pfName', mount);
    const bio = S.$('#pfBio', mount);
    const avatar = S.$('#pfAvatar', mount);

    if (name) name.textContent = profile.name;
    if (bio) bio.textContent = profile.bio;
    if (avatar) avatar.textContent = profile.avatar;

    const songs = S.library.list || [];
    const playlists = S.library.playlists || [];
    const favourites = S.library.playlist('fav');

    const songCount = S.$('#pfSongs', mount);
    const playlistCount = S.$('#pfPlaylists', mount);
    const favouriteCount = S.$('#pfFavourites', mount);

    if (songCount) {
      songCount.textContent = songs.length;
    }

    if (playlistCount) {
      playlistCount.textContent =
        playlists.filter(p => p.id !== 'fav').length;
    }

    if (favouriteCount) {
      favouriteCount.textContent =
        favourites ? favourites.songIds.length : 0;
    }
  }

  /* ---------- Edit profile sheet ---------- */

  function editProfile() {
    if (!S.modal) {
      S.toast('Profile editor is unavailable');
      return;
    }

    const profile = getProfile();

    const box = document.createElement('div');
    box.className = 'pf-modal';

    const nameLabel = document.createElement('label');
    nameLabel.textContent = 'Your display name';

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.maxLength = 28;
    nameInput.value = profile.name;
    nameInput.placeholder = 'Enter your name';

    nameLabel.appendChild(nameInput);

    const bioLabel = document.createElement('label');
    bioLabel.textContent = 'A little note about you';

    const bioInput = document.createElement('textarea');
    bioInput.maxLength = 90;
    bioInput.value = profile.bio;
    bioInput.placeholder = 'Your music, your memories...';

    bioLabel.appendChild(bioInput);

    box.append(nameLabel, bioLabel);

    S.modal.open({
      title: 'Edit your profile',
      content: box,
      actions: [
        {
          label: 'Save profile',
          kind: 'primary',

          onClick: function () {
            const name = nameInput.value.trim();
            const bio = bioInput.value.trim();

            if (!name) {
              S.toast('Please enter a display name');
              nameInput.focus();
              return false;
            }

            saveProfile(Object.assign({}, profile, {
              name: name,
              bio: bio || DEFAULT_PROFILE.bio
            }));
          }
        },
        {
          label: 'Cancel',
          kind: 'ghost'
        }
      ]
    });
  }

  /* ---------- Avatar selection sheet ---------- */

  function chooseAvatar() {
    if (!S.modal) return;

    const box = document.createElement('div');
    box.className = 'pf-modal';

    const hint = document.createElement('p');
    hint.className = 'md-hint';
    hint.textContent = 'Choose an avatar for your music identity.';

    const grid = document.createElement('div');
    grid.className = 'pf-avatar-grid';

    AVATARS.forEach(function (symbol) {
      const button = document.createElement('button');

      button.type = 'button';
      button.className = 'pf-avatar-choice';
      button.textContent = symbol;
      button.setAttribute('aria-label', 'Choose ' + symbol);

      button.addEventListener('click', function () {
        const profile = getProfile();
        profile.avatar = symbol;

        saveProfile(profile);
        S.modal.close();
      });

      grid.appendChild(button);
    });

    box.append(hint, grid);

    S.modal.open({
      title: 'Choose your avatar',
      content: box,
      actions: [
        {
          label: 'Close',
          kind: 'ghost'
        }
      ]
    });
  }

  /* ---------- Navigation ---------- */

  function setupNavigation() {
    S.$$('.pf-link[data-go]', mount).forEach(function (button) {
      listen(button, 'click', function () {
        const destination = button.dataset.go;

        if (destination) {
          S.buzz(8);
          S.go(destination);
        }
      });
    });
  }

  /* ---------- Screen lifecycle ---------- */

  async function init(element) {
    mount = element;

    offs = [];
    listeners = [];

    listen(S.$('#pfEdit', mount), 'click', editProfile);
    listen(S.$('#pfEditLink', mount), 'click', editProfile);
    listen(S.$('#pfAvatar', mount), 'click', chooseAvatar);

    setupNavigation();

    // Refresh collection numbers whenever library data changes.
    offs.push(S.bus.on('library:changed', render));
    offs.push(S.bus.on('playlists:changed', render));

    render();
  }

  function destroy() {
    offs.forEach(function (off) {
      try { off(); } catch (e) {}
    });

    listeners.forEach(function (remove) {
      try { remove(); } catch (e) {}
    });

    offs = [];
    listeners = [];
    mount = null;
  }

  return {
    init: init,
    destroy: destroy
  };

})());