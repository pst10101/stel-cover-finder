// 스텔라이브 커버곡 총정리 — 목록 불러오기, 검색·필터·정렬
(function () {
  'use strict';

  var KIND_ORDER = ['개인', '협동', '3D 라이브', '쇼츠', '플레이리스트'];
  var $q = document.getElementById('q');
  var $sort = document.getElementById('sort');
  var $members = document.getElementById('members');
  var $kinds = document.getElementById('kinds');
  var $list = document.getElementById('list');
  var $count = document.getElementById('count');
  var $status = document.getElementById('status');
  var $updated = document.getElementById('updated');

  var state = { q: '', member: '', kind: '', sort: 'new' };
  var covers = [];
  var members = [];
  var byKey = {};

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  // 페이지 안에 목록이 들어 있으면 그걸 쓰고, 아니면 data/covers.json을 받아온다
  function loadData() {
    var inline = document.getElementById('cover-data');
    if (inline) return Promise.resolve(JSON.parse(inline.textContent));
    return fetch('data/covers.json', { cache: 'no-cache' }).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    });
  }

  // ---- 주소에 검색 상태 남기기 (링크로 공유) ----
  function readUrl() {
    try {
      var p = new URLSearchParams(location.search);
      state.q = p.get('q') || '';
      state.member = p.get('m') || '';
      state.kind = p.get('k') || '';
      state.sort = p.get('sort') || 'new';
    } catch (e) { /* 주소를 못 읽는 환경이면 기본값 */ }
  }
  function writeUrl() {
    try {
      var p = new URLSearchParams();
      if (state.q) p.set('q', state.q);
      if (state.member) p.set('m', state.member);
      if (state.kind) p.set('k', state.kind);
      if (state.sort !== 'new') p.set('sort', state.sort);
      var s = p.toString();
      history.replaceState(null, '', location.pathname + (s ? '?' + s : ''));
    } catch (e) { /* 미리보기 화면 등에서는 주소를 못 바꿀 수 있다 */ }
  }

  function chip(label, count, pressed, onClick, tip, todo) {
    var b = el('button', 'chip' + (todo ? ' todo' : ''));
    b.type = 'button';
    b.setAttribute('aria-pressed', pressed ? 'true' : 'false');
    b.appendChild(document.createTextNode(label));
    if (count != null) b.appendChild(el('span', 'n', String(count)));
    if (tip) b.title = tip;
    b.addEventListener('click', onClick);
    return b;
  }

  // 멤버는 기수("N기")별로 한 줄씩, 네 칸 격자에 맞춰 놓는다. 기수가 없는 멤버(대표 등)는 마지막 줄에 모은다.
  function memberRows() {
    var rows = [];
    var etc = { gen: '', name: '', list: [] };
    members.forEach(function (m) {
      var p = /^(\d+기)\s*(.*)$/.exec(m.unit || '');
      if (!p) { etc.list.push(m); return; }
      var row = rows.filter(function (r) { return r.gen === p[1]; })[0];
      if (!row) rows.push((row = { gen: p[1], name: '', list: [] }));
      if (!row.name) row.name = p[2];
      row.list.push(m);
    });
    if (etc.list.length) {
      var same = etc.list.every(function (m) { return m.unit === etc.list[0].unit; });
      etc.gen = same && etc.list[0].unit ? etc.list[0].unit : '그 외';
      rows.push(etc);
    }
    return rows;
  }

  function buildFilters() {
    $members.textContent = '';
    memberRows().forEach(function (u) {
      var row = el('div', 'unit');
      var label = el('span', 'unit-label');
      label.appendChild(el('span', 'gen', u.gen));
      if (u.name) label.appendChild(el('span', 'uname', u.name));
      row.appendChild(label);
      u.list.forEach(function (m) {
        var n = covers.filter(function (c) { return c.m.indexOf(m.key) !== -1; }).length;
        var tip = m.collected ? (m.grad ? '졸업 멤버' : '') : (m.ch ? '이 멤버 채널은 아직 읽어오지 못했어요. 함께 부른 곡만 나와요.' : '이 멤버 채널은 수집하지 않아요. 함께 부른 곡만 나와요.');
        row.appendChild(chip(m.short, n, state.member === m.key, function () {
          state.member = state.member === m.key ? '' : m.key;
          update();
        }, tip, !m.collected));
      });
      $members.appendChild(row);
    });

    $kinds.textContent = '';
    $kinds.appendChild(el('span', 'unit-label', '종류'));
    var box = el('div', 'kchips');
    box.appendChild(chip('전체', null, state.kind === '', function () { state.kind = ''; update(); }));
    KIND_ORDER.forEach(function (k) {
      var n = covers.filter(function (c) { return c.k.indexOf(k) !== -1; }).length;
      if (!n) return;
      box.appendChild(chip(k, n, state.kind === k, function () {
        state.kind = state.kind === k ? '' : k;
        update();
      }));
    });
    $kinds.appendChild(box);
  }

  function matches(c) {
    if (state.member && c.m.indexOf(state.member) === -1) return false;
    if (state.kind && c.k.indexOf(state.kind) === -1) return false;
    if (!state.q) return true;
    var terms = state.q.toLowerCase().split(/\s+/).filter(Boolean);
    return terms.every(function (t) { return c._hay.indexOf(t) !== -1 || c._tight.indexOf(t) !== -1; });
  }

  var SORTS = {
    'new': function (a, b) { return a.d < b.d ? 1 : a.d > b.d ? -1 : a.t.localeCompare(b.t, 'ko'); },
    'old': function (a, b) { return a.d < b.d ? -1 : a.d > b.d ? 1 : a.t.localeCompare(b.t, 'ko'); },
    'title': function (a, b) { return a.t.localeCompare(b.t, 'ko') || (a.d < b.d ? -1 : 1); },
    'orig': function (a, b) {
      var x = a.o || a.c || '', y = b.o || b.c || '';
      if (!x !== !y) return x ? -1 : 1; // 원곡자를 모르는 곡은 맨 뒤로
      return x.localeCompare(y, 'ko') || a.t.localeCompare(b.t, 'ko');
    }
  };

  function who(c) {
    var s = c.g ? c.g : c.m.map(function (k) { return byKey[k] ? byKey[k].short : k; }).join(', ');
    return c.x ? (s ? s + ', ' : '') + c.x : s;
  }

  function link(c) {
    if (c.id) return 'https://www.youtube.com/watch?v=' + c.id;
    var name = c.m.length && byKey[c.m[0]] ? byKey[c.m[0]].name : '스텔라이브';
    return 'https://www.youtube.com/results?search_query=' + encodeURIComponent(name + ' ' + c.t + ' cover');
  }

  function headButton(label, asc, desc) {
    var on = state.sort === asc || state.sort === desc;
    var b = el('button', null, on ? label + (state.sort === desc && asc !== desc ? ' ↓' : ' ↑') : label);
    b.type = 'button';
    b.setAttribute('data-on', on ? '1' : '0');
    b.addEventListener('click', function () {
      state.sort = state.sort === desc && asc !== desc ? asc : desc;
      update();
    });
    return b;
  }

  function render() {
    var rows = covers.filter(matches).sort(SORTS[state.sort] || SORTS['new']);
    $count.textContent = '';
    $count.appendChild(el('b', null, rows.length + '곡'));
    $count.appendChild(document.createTextNode(' / 전체 ' + covers.length + '곡'));

    $list.textContent = '';
    if (!rows.length) {
      var e = el('li', 'empty', '조건에 맞는 커버곡이 없어요. 검색어를 줄이거나 필터를 풀어 보세요.');
      e.appendChild(document.createElement('br'));
      var r = el('button', null, '필터 초기화');
      r.type = 'button';
      r.addEventListener('click', function () {
        state.q = ''; state.member = ''; state.kind = '';
        update();
      });
      e.appendChild(r);
      $list.appendChild(e);
      return;
    }

    var head = el('li', 'head');
    [headButton('날짜', 'old', 'new'), headButton('곡명', 'title', 'title'), headButton('원곡자', 'orig', 'orig')].forEach(function (b) {
      var s = el('span'); s.appendChild(b); head.appendChild(s);
    });
    head.appendChild(el('span', null, '멤버'));
    head.appendChild(el('span', null, '종류'));
    $list.appendChild(head);

    var frag = document.createDocumentFragment();
    rows.forEach(function (c) {
      var li = el('li', 'row');
      li.appendChild(el('time', 'd', c.d.replace(/-/g, '.')));
      var t = el('span', 't');
      var a = el('a', null, c.t);
      a.href = link(c);
      a.target = '_blank';
      a.rel = 'noopener';
      if (c.yt) a.title = c.yt; // 자동으로 뽑은 곡명이면 원래 영상 제목을 같이 알려준다
      t.appendChild(a);
      if (!c.id) t.appendChild(el('small', null, '검색 링크'));
      if (c.n) t.appendChild(el('small', null, c.n));
      li.appendChild(t);
      var o = el('span', 'o', c.o || '');
      if (c.c && c.c !== c.o) o.appendChild(el('small', null, '작곡 ' + c.c));
      li.appendChild(o);
      li.appendChild(el('span', 'm', who(c)));
      // 종류 태그는 여러 개일 수 있다 (3D 라이브 + 쇼츠). 다른 태그가 있으면 '개인'은 생략
      var k = el('span', 'k');
      var show = c.k.length > 1 ? c.k.filter(function (name) { return name !== '개인'; }) : c.k;
      show.forEach(function (name) { k.appendChild(el('span', 'tag' + (name === '협동' ? ' duo' : ''), name)); });
      li.appendChild(k);
      frag.appendChild(li);
    });
    $list.appendChild(frag);
  }

  function update() {
    $q.value = state.q;
    $sort.value = SORTS[state.sort] ? state.sort : (state.sort = 'new');
    buildFilters();
    render();
    writeUrl();
  }

  function renderStatus(data) {
    var short = function (m) { return m.short; };
    if (!data.updatedAt) {
      $status.hidden = false;
      $status.appendChild(el('b', null, '아직 유튜브 자동 수집 전이에요. '));
      $status.appendChild(document.createTextNode('지금은 미리 모아 둔 ' + covers.length + '곡만 보여요. 점선으로 된 멤버는 다른 멤버와 함께 부른 곡만 나와요.'));
      return;
    }
    var d = new Date(data.updatedAt + 9 * 3600 * 1000).toISOString().slice(0, 10).replace(/-/g, '.');
    $updated.textContent = d + ' 갱신';
    var failed = members.filter(function (m) { return m.ch && !m.collected; });
    if (failed.length) {
      $status.hidden = false;
      $status.appendChild(el('b', null, '채널을 아직 읽어오지 못한 멤버가 있어요. '));
      $status.appendChild(document.createTextNode(failed.map(short).join('·') + ' — 이 멤버들은 다른 멤버와 함께 부른 곡만 나와요.'));
    }
  }

  $q.addEventListener('input', function () { state.q = $q.value.trim(); render(); writeUrl(); });
  $sort.addEventListener('change', function () { state.sort = $sort.value; render(); writeUrl(); });

  loadData().then(function (data) {
    members = data.members || [];
    members.forEach(function (m) { byKey[m.key] = m; });
    covers = data.covers || [];
    covers.forEach(function (c) {
      if (!Array.isArray(c.k)) c.k = [c.k || '개인'];
      var names = c.m.map(function (k) { return byKey[k] ? byKey[k].name + ' ' + byKey[k].short : ''; }).join(' ');
      var hay = [c.t, c.o, c.c, names, c.g, c.x, c.n, c.k.join(' '), c.d, c.yt].filter(Boolean).join(' ').toLowerCase();
      c._hay = hay;
      c._tight = hay.replace(/\s+/g, '');
    });
    readUrl();
    if (state.member && !byKey[state.member]) state.member = '';
    renderStatus(data);
    update();
  }).catch(function (e) {
    $count.textContent = '목록을 불러오지 못했어요. 잠시 뒤에 새로고침해 주세요. (' + e.message + ')';
  });
})();
