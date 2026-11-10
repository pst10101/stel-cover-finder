// 유튜브 영상 제목·설명에서 커버곡 정보를 뽑는 파서.
// 전부 추정이라 틀릴 수 있다 → 틀린 건 curated.json에 영상 ID로 적어서 바로잡는다.

// "PT5M12S" → 초
export function isoDuration(s) {
  const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(s || '');
  if (!m) return 0;
  return (+m[1] || 0) * 86400 + (+m[2] || 0) * 3600 + (+m[3] || 0) * 60 + (+m[4] || 0);
}

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ---- 커버 영상인지 ----
const RE_COVER = /(?<![A-Za-z])cover(?:ed)?(?![A-Za-z])|커버|歌ってみた|불러\s*보았다|불러\s*봤/i;
const RE_NOT_COVER = /리액션|reaction|비하인드|behind|메이킹|making|티저|teaser|예고|preview|다시보기/i;

export function looksLikeCover(title) {
  const t = String(title || '');
  return RE_COVER.test(t) && !RE_NOT_COVER.test(t);
}

// ---- 제목에서 멤버 찾기 ----
// 줄임말(유니, 린…)은 다른 낱말에 섞여 나오기 쉬워서 쓰지 않고, 전체 이름과 영어 이름만 본다.
export function memberMatchers(members) {
  return members.map((m) => {
    const alts = [];
    for (const n of [m.name, ...(m.en || [])]) {
      if (!n) continue;
      const words = n.trim().split(/\s+/).map(esc);
      if (/^[\x00-\x7f]+$/.test(n)) alts.push(`(?<![A-Za-z])${words.join('\\s*')}(?![A-Za-z])`);
      else if (words.length === 1) alts.push(`(?<![가-힣A-Za-z])${words[0]}(?=님|와|랑|과|의|[^가-힣A-Za-z]|$)`);
      else alts.push(words.join('\\s*'));
    }
    return { key: m.key, re: new RegExp(alts.join('|'), 'gi') };
  });
}

export function mentions(text, matchers) {
  const s = String(text || '');
  return matchers
    .filter((x) => {
      x.re.lastIndex = 0;
      return x.re.test(s);
    })
    .map((x) => x.key);
}

// ---- 제목 → 곡명 / 원곡자 ----
const RE_COVER_WORD = /(?<![A-Za-z])cover(?:ed)?(?:\s+by)?(?![A-Za-z])|커버곡?|歌ってみた/gi;
const RE_GROUP = /(?<![A-Za-z])stellive(?:\s*official)?(?![A-Za-z])|스텔라이브/gi;
const RE_MV = /(?<![A-Za-z])(?:official\s*)?(?:m\s*\/\s*v|mv|music\s*video)(?![A-Za-z])/gi;
const RE_CONNECT = /(?<![가-힣A-Za-z0-9])(?:x|×|with|feat\.?|ft\.?|and)(?![가-힣A-Za-z0-9])|[&,、·+]/gi;
const RE_TRIM = /^[\s'"‘’“”`,·、:;|\-–—~]+|[\s'"‘’“”`,·、:;|\-–—~]+$/g;
const OPEN = '「『【[（(';
const CLOSE = '」』】]）)';
const RE_BRACKET = /[「『【\[（(]([^「『【\[（(」』】\]）)]*)[」』】\]）)]/g;

// 멤버 이름·"Cover" 같은 크레딧 표기를 걷어낸 나머지
function stripCredit(seg, matchers) {
  let s = seg;
  let hadName = false;
  for (const x of matchers) {
    const r = s.replace(x.re, ' ');
    if (r !== s) hadName = true;
    s = r;
  }
  const g = s.replace(RE_GROUP, ' ');
  if (g !== s) hadName = true;
  s = g.replace(RE_COVER_WORD, ' ').replace(RE_MV, ' ');
  if (hadName) s = s.replace(RE_CONNECT, ' '); // "히나 x 리코"의 x 같은 이음말은 이름이 있던 조각에서만 지운다
  return s.replace(/[「『【\[（(]\s*[」』】\]）)]/g, ' ').replace(/\s+/g, ' ').replace(RE_TRIM, '').trim();
}

// 괄호 밖에 있는 / | - 로 나눈다
function splitTop(s) {
  const out = [];
  let depth = 0;
  let cur = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (OPEN.includes(ch)) depth++;
    else if (CLOSE.includes(ch)) depth = Math.max(0, depth - 1);
    if (depth === 0) {
      const dash = (ch === '-' || ch === '–' || ch === '—') && /\s/.test(s[i - 1] || ' ') && /\s/.test(s[i + 1] || ' ');
      if ('/|｜ㅣ│┃∣'.includes(ch) || dash) {
        out.push(cur);
        cur = '';
        continue;
      }
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

export function parseCoverTitle(title, matchers) {
  let s = String(title || '')
    .replace(/#[^\s#]+/g, ' ') // 해시태그
    .replace(RE_MV, ' ')
    .replace(/(?<![A-Za-z])w\//gi, 'with ');
  // 【COVER】, (Akane Lize), 【유니 X 칸나】처럼 크레딧만 든 괄호는 통째로 지운다
  s = s.replace(RE_BRACKET, (all, inner) => (stripCredit(inner, matchers) === '' ? ' ' : all));
  const segs = splitTop(s)
    .map((x) => stripCredit(x, matchers))
    .filter(Boolean);
  let t = segs[0] || '';
  let o = segs[1] && segs[1].length <= 40 ? segs[1] : '';
  // "오버라이드 「オーバーライド / 吉田夜世」" → 괄호 안 마지막 조각이 원곡자
  const m = /^(.*?)\s*[「『【\[（(]([^「『【\[（(」』】\]）)]*\/[^「『【\[（(」』】\]）)]*)[」』】\]）)]\s*$/.exec(t);
  if (m) {
    const parts = m[2].split('/').map((x) => x.trim()).filter(Boolean);
    if (!o && parts.length > 1) o = parts[parts.length - 1];
    t = m[1].trim() || parts[0] || t;
  }
  return { t: t.slice(0, 120), o: o.slice(0, 60) };
}

// ---- 설명란 → 원곡 / 작곡 표기 ----
const BULLET = String.raw`^[\s\-•·▶►*#■□◆◇○●★☆♪♬\[(【]*`;
const SEP = String.raw`\s*[\])】]?\s*[:：\-–—|]\s*`;
const RE_ORIG = new RegExp(BULLET + String.raw`(?:원곡|original(?:\s*(?:song|artist))?|本家)(?:\s*by)?` + SEP + '(.+)$', 'i');
const RE_COMP = new RegExp(BULLET + String.raw`(?:작곡|composer|composed\s*by|composition|作曲)` + SEP + '(.+)$', 'i');

function cleanCredit(v) {
  return v.replace(/https?:\/\/\S+/g, '').replace(/\s+/g, ' ').replace(RE_TRIM, '').trim().slice(0, 60);
}

export function parseCredits(description) {
  let o = '';
  let c = '';
  for (const line of String(description || '').split(/\r?\n/)) {
    if (line.length > 200) continue;
    let m;
    if (!o && (m = RE_ORIG.exec(line))) o = cleanCredit(m[1]);
    else if (!c && (m = RE_COMP.exec(line))) c = cleanCredit(m[1]);
    if (o && c) break;
  }
  return { o, c };
}

// ---- 종류 ----
export function coverKind({ title, dur, shorts, memberCount, group }) {
  if (/3D\s*(?:LIVE|라이브)/i.test(title || '')) return '3D 라이브';
  if (dur > 0 && (dur <= 61 || (dur <= 180 && shorts))) return '쇼츠';
  if (dur >= 15 * 60) return '플레이리스트';
  if (memberCount > 1 || group) return '협동';
  return '개인';
}
