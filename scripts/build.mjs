// 수집한 유튜브 목록(data/youtube.json) + 손으로 다듬은 정보(curated.json) → 사이트용 docs/data/covers.json
//   node scripts/build.mjs
//
// 우선순위: curated.json에 적은 값 > 제목·설명에서 자동으로 뽑은 값.
// curated.json에만 있고 아직 수집되지 않은 영상도 그대로 사이트에 나온다.
import { path, readJSON, writeJSON, kstDate, log } from './lib.mjs';
import { memberMatchers, readTitle, coverKind, cleanText, cleanCredit, looksLikeCover } from './parse.mjs';

const norm = (s) => String(s || '').replace(/\s+/g, '').toLowerCase();
const dayNum = (d) => Date.parse(d + 'T00:00:00Z') / 86400e3;
const uniq = (a) => [...new Set(a)];

async function main() {
  const cfg = await readJSON(path('members.json'));
  const members = cfg.members.filter((m) => m.enabled !== false);
  const order = new Map(members.map((m, i) => [m.key, i]));
  const cache = await readJSON(path('data', 'youtube.json'), { updatedAt: null, channels: {} });
  const curated = await readJSON(path('curated.json'), { videos: {}, noVideo: [] });
  const matchers = memberMatchers(members, cfg.units || []);
  const sortKeys = (keys) => uniq(keys).filter((k) => order.has(k)).sort((a, b) => order.get(a) - order.get(b));

  const byId = new Map();

  // 1) 유튜브에서 수집한 영상
  for (const slot of Object.values(cache.channels)) {
    for (const v of slot.videos || []) {
      const cur = curated.videos?.[v.id] || {};
      if (cur.hide) continue;
      const title = cleanText(v.title);
      // 손으로 넣은 영상이 아니면, 수집 기준이 바뀌었을 때 예전에 모아 둔 것도 다시 걸러낸다
      if (!cur.t && !looksLikeCover(title)) continue;
      const parsed = readTitle(title, matchers);
      const m = sortKeys(cur.m || [v.m, ...parsed.m].filter(Boolean));
      const g = cur.g || parsed.g || (!m.length ? '스텔라이브' : '');
      byId.set(v.id, {
        id: v.id,
        d: kstDate(v.pub),
        t: cur.t || parsed.t || title,
        o: cur.o || parsed.o || cleanCredit(v.o || ''),
        c: cur.c || cleanCredit(v.c || ''),
        m,
        g,
        x: cur.x || (cur.t ? '' : parsed.x) || '', // 손으로 정리한 곡에는 자동으로 뽑은 참여자를 붙이지 않는다
        n: cur.n || '',
        k: cur.k || coverKind({ title, dur: v.dur, shorts: v.shorts, memberCount: m.length, group: g }),
        yt: title,
        auto: !cur.t, // 곡명을 자동으로 뽑았는지 (사이트에서 원래 제목을 같이 보여줌)
      });
    }
  }

  // 2) curated.json에만 있는 영상 (수집 전이거나, 제목에 "cover"가 없어 자동으로 못 잡는 영상)
  for (const [id, cur] of Object.entries(curated.videos || {})) {
    if (byId.has(id) || cur.hide || !cur.t || !cur.d) continue;
    byId.set(id, {
      id, d: cur.d, t: cur.t, o: cur.o || '', c: cur.c || '', m: sortKeys(cur.m || []),
      g: cur.g || '', x: cur.x || '', n: cur.n || '', k: cur.k || '개인', yt: '', auto: false,
    });
  }

  // 3) 영상 주소를 모르는 곡: 같은 멤버가 같은 날(±1일) 올린 자동 수집 영상이 있으면 그 영상으로 본다
  const covers = [...byId.values()];
  for (const e of curated.noVideo || []) {
    let hits = covers.filter((c) => c.auto && c.id && e.m.some((k) => c.m.includes(k)) && Math.abs(dayNum(c.d) - dayNum(e.d)) <= 1);
    if (hits.length > 1) {
      const byTitle = hits.filter((c) => norm(c.yt).includes(norm(e.t)));
      if (byTitle.length === 1) hits = byTitle;
    }
    if (hits.length === 1) {
      const c = hits[0];
      c.t = e.t;
      c.o = e.o || c.o;
      c.m = sortKeys([...e.m, ...c.m]);
      if (e.k && e.k !== '개인') c.k = e.k;
      else if (c.k === '개인' && c.m.length > 1) c.k = '협동';
      c.auto = false;
    } else if (hits.length === 0) {
      covers.push({ id: '', d: e.d, t: e.t, o: e.o || '', c: '', m: sortKeys(e.m), g: e.g || '', x: e.x || '', n: e.n || '', k: e.k || '개인', yt: '', auto: false });
    } // 여러 개가 걸리면 어느 영상인지 알 수 없으니 자동 수집된 것만 둔다
  }

  covers.sort((a, b) => (a.d < b.d ? 1 : a.d > b.d ? -1 : a.t.localeCompare(b.t, 'ko')));

  // 채널을 실제로 읽어온 멤버 (아니면 사이트에서 "함께 부른 곡만 나와요"로 표시)
  const collected = new Set();
  for (const m of members) {
    if ((m.youtube || []).some((ch) => cache.channels[ch]?.uploads)) collected.add(m.key);
  }

  const out = {
    updatedAt: cache.updatedAt || null,
    members: members.map((m) => ({ key: m.key, name: m.name, short: m.short || m.name, unit: m.unit || '', ch: (m.youtube || []).length > 0, collected: collected.has(m.key) })),
    covers: covers.map((c) => {
      const o = { id: c.id, d: c.d, t: c.t, m: c.m, k: c.k };
      for (const f of ['o', 'c', 'g', 'x', 'n']) if (c[f]) o[f] = c[f];
      if (c.auto && c.yt) o.yt = c.yt;
      return o;
    }),
  };
  await writeJSON(path('docs', 'data', 'covers.json'), out);
  log(`커버 ${out.covers.length}곡 (자동 수집 채널 ${collected.size}명, 주소 없는 곡 ${out.covers.filter((c) => !c.id).length})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
