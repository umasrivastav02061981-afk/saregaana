/* ===== stats.js — Year on Vinyl ===== */

Saregaana.register('stats', (function () {
  'use strict';

  const S = window.Saregaana;

  let mount = null;
  let offHistory = null;

  function get(selector) {
    return S.$(selector, mount);
  }

  function formatDuration(seconds) {
    seconds = Math.floor(Math.max(0, seconds || 0));

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0) return hours + 'h ' + minutes + 'm';
    if (minutes > 0) return minutes + ' min';

    return seconds + ' sec';
  }

  function formatCount(number) {
    return new Intl.NumberFormat().format(number || 0);
  }

  function dateKey(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');

    return y + '-' + m + '-' + d;
  }

  function create(tag, className, value) {
    const element = document.createElement(tag);

    if (className) element.className = className;
    if (value !== undefined) element.textContent = value;

    return element;
  }

  function makeWeek(snapshot) {
    const result = [];
    const today = new Date();

    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - i);

      const key = dateKey(date);
      const day = snapshot.days[key] || { seconds: 0 };

      result.push({
        label: date.toLocaleDateString(undefined, {
          weekday: 'short'
        }),
        seconds: day.seconds || 0
      });
    }

    return result;
  }

  function renderWeek(snapshot) {
    const chart = get('#stWeekChart');
    if (!chart) return;

    chart.textContent = '';

    const week = makeWeek(snapshot);
    const max = Math.max(1, ...week.map(day => day.seconds));

    const total = week.reduce(
      (sum, day) => sum + day.seconds,
      0
    );

    get('#stWeekTotal').textContent = formatDuration(total);

    week.forEach(day => {
      const column = create('div', 'st-chart-day');

      const track = create('div', 'st-bar-track');
      const fill = create('div', 'st-bar-fill');

      const height = day.seconds > 0
        ? Math.max(4, (day.seconds / max) * 100)
        : 0;

      fill.style.height = height + '%';

      track.appendChild(fill);

      column.append(
        track,
        create('small', '', day.label)
      );

      column.title = formatDuration(day.seconds);

      chart.appendChild(column);
    });
  }

  function renderSongList(selector, songs, mode) {
    const list = get(selector);
    if (!list) return;

    list.textContent = '';

    if (!songs.length) {
      const empty = create('div', 'st-empty');

      empty.append(
        create('strong', '', 'Your playlist of memories starts here'),
        create(
          'span',
          '',
          'Play some music and your listening activity will appear here.'
        )
      );

      list.appendChild(empty);
      return;
    }

    songs.forEach((song, index) => {
      const row = create('div', 'st-song');

      const rank = create(
        'span',
        'st-rank',
        String(index + 1).padStart(2, '0')
      );

      const copy = create('div', 'st-song-copy');

      copy.append(
        create('strong', '', song.title || 'Unknown song'),
        create('small', '', song.artist || 'Unknown artist')
      );

      let detail = '';

      if (mode === 'top') {
        detail = formatDuration(song.seconds);
      } else {
        detail = new Date(song.lastPlayed).toLocaleDateString(
          undefined,
          { day: 'numeric', month: 'short' }
        );
      }

      row.append(
        rank,
        copy,
        create('span', 'st-song-time', detail)
      );

      list.appendChild(row);
    });
  }

  function render() {
    if (!mount || !S.history) return;

    const snapshot = S.history.snapshot();

    get('#stTotalTime').textContent =
      formatDuration(snapshot.totalSeconds);

    get('#stPlays').textContent =
      formatCount(snapshot.totalPlays);

    get('#stDays').textContent =
      formatCount(snapshot.daysListened);

    get('#stTracks').textContent =
      formatCount(snapshot.tracksPlayed);

    renderWeek(snapshot);

    renderSongList(
      '#stTopSongs',
      snapshot.topSongs,
      'top'
    );

    renderSongList(
      '#stRecentSongs',
      snapshot.recentSongs,
      'recent'
    );
  }

  function init(element) {
    mount = element;

    render();

    offHistory = S.bus.on('history:changed', render);
  }

  function destroy() {
    if (offHistory) {
      offHistory();
      offHistory = null;
    }

    mount = null;
  }

  return {
    init,
    destroy
  };

})());