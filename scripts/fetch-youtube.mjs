// 멤버 유튜브 채널에서 커버곡 영상 수집 (YouTube Data API v3 — 공식 API, 키 필요)
//   YOUTUBE_API_KEY=... node scripts/fetch-youtube.mjs          → 새로 올라온 영상만
//   YOUTUBE_API_KEY=... node scripts/fetch-youtube.mjs --full   → 전체 새로고침
//
// 채널 업로드 목록을 훑어서 제목이 커버처럼 보이는 영상만 자세히 받아 data/youtube.json에 쌓는다.
// 키가 없으면 아무것도 안 하고 넘어간다. (그때는 curated.json의 손으로 모은 목록만 사이트에 나옴)
// YouTube API 정책상 저장한 데이터는 주기적으로 새로 받아야 해서, 워크플로가 매주 --full을 돌린다.
import { path, readJSON, writeJSON, getJSON, HttpError, redact, log } from './lib.mjs';
import { isoDuration, looksLikeCover, parseCredits } from './parse.mjs';

const KEY = process.env.YOUTUBE_API_KEY;
const API = process.env.YOUTUBE_API_BASE || 'https://www.googleapis.com/youtube/v3';
const FULL = process.argv.includes('--full');
// 하루 기본 한도는 10,000. 다시보기 사이트와 같은 키를 쓰면 한도를 나눠 쓰니까 낮게 잡아둔다.
const BUDGET = Number(process.env.YOUTUBE_QUOTA_BUDGET || 2000);
const SEEN_KEEP = 300; // 채널마다 "여기까지는 이미 봤다"를 알기 위해 기억해 두는 최근 영상 수

let used = 0;
class QuotaStop extends Error {}

async function yt(endpoint, params) {
  if (used >= BUDGET) throw new QuotaStop(`이번 실행 한도(${BUDGET}) 도달`);
  const u = new URL(`${API}/${endpoint}`);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  u.searchParams.set('key', KEY);
  used += 1; // channels / playlistItems / videos 모두 1회 = 1 유닛
  try {
    return await getJSON(u);
  } catch (e) {
    if (e instanceof HttpError && e.status === 403 && /quota/i.test(e.body)) throw new QuotaStop('YouTube 일일 한도 초과');
    if (e instanceof HttpError) throw new Error(`${e.message} ${e.body.slice(0, 200)}`);
    throw new Error(redact(e.message));
  }
}

async function resolveChannel(ref) {
  const params = { part: 'snippet,contentDetails' };
  if (/^UC[\w-]{22}$/.test(ref)) params.id = ref;
  else params.forHandle = ref.startsWith('@') ? ref : '@' + ref;
  const res = await yt('channels', params);
  const ch = res.items?.[0];
  if (!ch) throw new Error(`채널을 못 찾음: ${ref}`);
  return { id: ch.id, title: ch.snippet?.title || '', uploads: ch.contentDetails.relatedPlaylists.uploads };
}

// 업로드 목록(최신순)을 훑는다. fresh = 처음 보는 영상 전부, candidates = 그중 제목이 커버 같은 것
async function scanUploads(uploads, seen) {
  const fresh = [];
  const candidates = [];
  let pageToken = '';
  for (let i = 0; i < 400; i++) {
    const res = await yt('playlistItems', {
      part: 'snippet,contentDetails',
      playlistId: uploads,
      maxResults: '50',
      ...(pageToken ? { pageToken } : {}),
    });
    let sawKnown = false;
    for (const it of res.items || []) {
      const id = it.contentDetails?.videoId;
      if (!id) continue;
      if (seen.has(id)) {
        sawKnown = true;
        continue;
      }
      fresh.push(id);
      if (looksLikeCover(it.snippet?.title)) candidates.push(id);
    }
    pageToken = res.nextPageToken;
    if (!pageToken || sawKnown) break; // 이미 본 영상이 나오면 그 뒤는 전부 본 것
  }
  return { fresh, candidates };
}

async function details(ids) {
  const out = [];
  for (let i = 0; i < ids.length; i += 50) {
    const res = await yt('videos', { part: 'snippet,contentDetails', id: ids.slice(i, i + 50).join(',') });
    out.push(...(res.items || []));
  }
  return out;
}

function toEntry(v, member, channelId) {
  const desc = v.snippet.description || '';
  const credit = parseCredits(desc);
  const e = {
    id: v.id,
    ch: channelId,
    m: member, // 채널 주인 (공용 채널이면 null)
    title: v.snippet.title,
    pub: Date.parse(v.snippet.publishedAt),
    dur: isoDuration(v.contentDetails?.duration),
  };
  if (credit.o) e.o = credit.o;
  if (credit.c) e.c = credit.c;
  if (/#shorts?(?![A-Za-z])/i.test(v.snippet.title + ' ' + desc)) e.shorts = true;
  return e;
}

function channelRefs(cfg) {
  const refs = [];
  for (const m of cfg.members.filter((m) => m.enabled !== false)) {
    for (const ch of m.youtube || []) refs.push({ channel: ch, member: m.key });
  }
  for (const ch of cfg.sharedYoutube || []) refs.push({ channel: ch, member: null }); // 공용 채널: 제목으로 멤버 구분
  return refs;
}

async function main() {
  if (!KEY) {
    log('YOUTUBE_API_KEY가 없어서 유튜브 수집은 건너뜀');
    return;
  }
  const cfg = await readJSON(path('members.json'));
  const cachePath = path('data', 'youtube.json');
  const cache = await readJSON(cachePath, { updatedAt: null, channels: {} });
  const before = JSON.stringify(cache.channels);
  const refs = channelRefs(cfg);
  if (refs.length === 0) log('members.json에 유튜브 채널이 하나도 없음');

  try {
    for (const ref of refs) {
      const slot = (cache.channels[ref.channel] ||= { videos: [], seen: [] });
      try {
        const info = !slot.uploads || FULL ? await resolveChannel(ref.channel) : null;
        const uploads = info ? info.uploads : slot.uploads;
        const { fresh, candidates } = await scanUploads(uploads, new Set(FULL ? [] : slot.seen));
        const items = await details(candidates);

        // 여기까지 오류 없이 왔을 때만 저장된 내용을 바꾼다 (중간에 끊기면 예전 목록 유지)
        const later = new Set(); // 공개 예정(프리미어 대기) 영상은 다음에 다시 확인
        const kept = [];
        for (const v of items) {
          if (v.snippet.liveBroadcastContent && v.snippet.liveBroadcastContent !== 'none') later.add(v.id);
          else kept.push(toEntry(v, ref.member, info ? info.id : slot.id));
        }
        if (info) Object.assign(slot, info);
        const map = new Map((FULL ? [] : slot.videos).map((v) => [v.id, v]));
        for (const e of kept) map.set(e.id, e);
        slot.videos = [...map.values()].sort((a, b) => b.pub - a.pub);
        const seenNow = fresh.filter((id) => !later.has(id));
        slot.seen = (FULL ? seenNow : [...seenNow, ...slot.seen]).slice(0, SEEN_KEEP);
        slot.member = ref.member;
        log(`✅ ${slot.title || ref.channel}: 커버 ${slot.videos.length}개 (새로 ${kept.length}, 훑은 영상 ${fresh.length})`);
      } catch (e) {
        if (e instanceof QuotaStop) throw e;
        log(`❌ ${ref.channel}: ${e.message}`);
      }
    }
  } catch (e) {
    if (!(e instanceof QuotaStop)) throw e;
    log(`⛔ ${e.message} — 다음 실행 때 이어서 수집`);
  }

  // members.json에서 빠진 채널 정리
  const live = new Set(refs.map((r) => r.channel));
  for (const k of Object.keys(cache.channels)) if (!live.has(k)) delete cache.channels[k];

  // 바뀐 게 있을 때만 갱신 시각을 바꾼다 (매일 빈 커밋이 쌓이지 않게)
  if (JSON.stringify(cache.channels) !== before || !cache.updatedAt) cache.updatedAt = Date.now();
  await writeJSON(cachePath, cache);
  log(`YouTube API 사용량: ${used} 유닛`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
