// 유튜브 영상 제목·설명에서 커버곡 정보를 뽑는 파서.
// 전부 추정이라 틀릴 수 있다 → 틀린 건 curated.json에 영상 ID로 적어서 바로잡는다.

// "PT5M12S" → 초
export function isoDuration(s) {
  const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(s || '');
  if (!m) return 0;
  return (+m[1] || 0) * 86400 + (+m[2] || 0) * 3600 + (+m[3] || 0) * 60 + (+m[4] || 0);
}

// 맥에서 쓴 제목은 한글이 자모로 풀려(NFD) 오는 경우가 있어서 합쳐 주고, 폭 없는 문자는 지운다
export function cleanText(s) {
  return String(s || '').normalize('NFC').replace(/[​-‏⁠﻿]/g, '').replace(/ |　/g, ' ');
}

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ---- 커버 영상인지 ----
const SING = String.raw`불러\s*보았다|불러\s*봤(?:다|어요?|습니다|음)(?![가-힣])|歌ってみた`;
const RE_COVER = new RegExp(String.raw`(?<![A-Za-z])cover(?:ed)?(?![A-Za-z])|커버|${SING}`, 'i');
// 커버 영상이 아니라 커버를 소개·홍보하는 영상 ("커버한 노래 중 최고는?", "커버곡 픽", "커버 모음")도 뺀다
const RE_NOT_COVER = /리액션|reaction|비하인드|behind|메이킹|making|티저|teaser|예고|preview|다시보기|많관부|커버한|커버곡?\s*(?:픽|모음)/i;

export function looksLikeCover(title) {
  const t = cleanText(title);
  return RE_COVER.test(t) && !RE_NOT_COVER.test(t);
}

// ---- 멤버·유닛 찾기 준비 ----
// 전체 이름과 영어 이름은 제목 어디에 있든 멤버로 본다.
// 줄임말(히나, Lize…)은 다른 낱말에 섞이기 쉬워서 "히나 Cover", "Cover by Lize x Rin"처럼 크레딧 자리에 있을 때만 본다.
export function memberMatchers(members, units = []) {
  const list = members.map((m) => {
    const alts = [];
    for (const n of [m.name, ...(m.en || [])]) {
      if (!n) continue;
      const words = n.trim().split(/\s+/).map(esc);
      if (/^[\x00-\x7f]+$/.test(n)) alts.push(`(?<![A-Za-z])${words.join('\\s*')}(?![A-Za-z])`);
      else if (words.length === 1) alts.push(`(?<![가-힣A-Za-z])${words[0]}(?=님|와|랑|과|의|[^가-힣A-Za-z]|$)`);
      else alts.push(words.join('\\s*'));
    }
    const alias = [m.short, ...(m.en || []).map((n) => n.trim().split(/\s+/).pop()), ...(m.alias || [])]
      .filter((a) => a && a !== m.name)
      .map((a) => a.toLowerCase());
    return { key: m.key, re: new RegExp(alts.join('|'), 'gi'), alias: [...new Set(alias)] };
  });
  const aliasMap = new Map();
  for (const x of list) for (const a of x.alias) if (!aliasMap.has(a)) aliasMap.set(a, x.key);
  const aliasAlt = [...aliasMap.keys()].sort((a, b) => b.length - a.length).map(esc).join('|') || '(?!)';
  list.aliasMap = aliasMap;
  // "히나 Cover", "Hina Short Cover", "마시로 cover" → 커버 표기 바로 앞의 줄임말
  list.reAliasBeforeCover = new RegExp(String.raw`(?<![가-힣A-Za-z])(${aliasAlt})\s+(?=${COVER_WORD})`, 'gi');
  list.units = units.map((u) => ({
    name: u.name,
    members: u.members,
    re: new RegExp(u.match.map((w) => (/^[\x00-\x7f]+$/.test(w) ? `(?<![A-Za-z])${esc(w)}(?![A-Za-z])` : esc(w))).join('|'), 'gi'),
  }));
  return list;
}

// 제목 전체에서 전체 이름으로 찾은 멤버
export function mentions(text, matchers) {
  const s = cleanText(text);
  return matchers
    .filter((x) => {
      x.re.lastIndex = 0;
      return x.re.test(s);
    })
    .map((x) => x.key);
}

// ---- 제목 → 곡명 / 원곡자 / 멤버 ----
const COVER_WORD = String.raw`(?<![A-Za-z])(?:3D\s*)?(?:live\s*)?(?:short\s*)?(?<![A-Za-z])cover(?:ed)?(?![A-Za-z])`;
const RE_COVER_BY = new RegExp(String.raw`(?<![A-Za-z])cover(?:ed)?\s+by\s+(.*)$`, 'i');
const RE_COVER_WORD = new RegExp(String.raw`${COVER_WORD}|커버곡?|(?:[을를]\s*)?(?:${SING})`, 'gi');
const RE_GROUP = /(?<![A-Za-z])stellive(?:\s*official)?(?![A-Za-z])|스텔라이브/gi;
const RE_MV = /(?<![A-Za-z])(?:official\s*)?(?:m\s*\/\s*v|mv|music\s*video)(?![A-Za-z])/gi;
const RE_TAG = /[\[【(（]\s*(?:4K|8K|HD|MV|M\/V|FULL|Full\s*ver\.?)\s*[\]】)）]/gi;
const RE_CONNECT = /(?<![가-힣A-Za-z0-9])(?:x|×|with|feat\.?|ft\.?|and)(?![가-힣A-Za-z0-9])|[&,、·+×]/gi;
const RE_TRIM = /^[\s'"‘’“”`,·、:;|\-–—~]+|[\s'"‘’“”`,·、:;|\-–—~]+$/g;
const RE_TRIM_SEG = /^[\s`,·、:;|\-–—~]+|[\s`,·、:;|\-–—~]+$/g; // 조각 다듬기 (따옴표는 짝이 맞을 때만 뗀다)
const RE_WRAP_QUOTE = /^['"‘“]\s*([^'"‘’“”]+?)\s*['"’”]$/;
const OPEN = '「『【[（(';
const CLOSE = '」』】]）)';
const RE_BRACKET = /[「『【\[（(]([^「『【\[（(」』】\]）)]*)[」』】\]）)]/g;
// "감정을 담아 '만찬가'를 불러보았다", "' Stay Alive ' cover", "「曲名」 歌ってみた" → 따옴표 안이 곡명
const RE_QUOTED = new RegExp(
  String.raw`['‘’]\s*([^'‘’]{2,60}?)\s*['‘’]+\s*(?:[을를]|라고)?\s*(?:[가-힣]+\s+){0,2}(?:${SING}|(?<![A-Za-z])cover|커버)` +
    String.raw`|[「『]\s*([^」』]{2,60}?)\s*[」』]\s*を?\s*歌ってみた`,
  'i',
);

// 조각에서 멤버 이름·유닛 이름·"Cover" 같은 크레딧 표기를 걷어내고, 거기서 알아낸 것을 돌려준다
function credit(seg, mm) {
  let s = seg;
  const keys = [];
  const units = [];
  let hadName = false;
  let group = false;
  let hadCover = false;

  // "Cover by Lize x Rin x Nana" → 뒤쪽은 전부 크레딧
  const by = RE_COVER_BY.exec(s);
  if (by) {
    hadCover = true;
    for (const tok of by[1].split(/\s*(?:(?<![가-힣A-Za-z0-9])(?:x|×|and)(?![가-힣A-Za-z0-9])|[&,、·+×])\s*/i)) {
      const k = mm.aliasMap.get(tok.trim().toLowerCase());
      if (k) {
        keys.push(k);
        hadName = true;
      }
    }
    keys.push(...mentions(by[1], mm));
    if (mentions(by[1], mm).length) hadName = true;
    s = s.slice(0, by.index);
  }
  // 이름이 있던 자리를 잠깐 표시(\u0001)해 두고, 남은 글자가 이름과 x·&로 이어져 있었는지 본다
  for (const x of mm) {
    const r = s.replace(x.re, ' \u0001 ');
    if (r !== s) {
      hadName = true;
      keys.push(x.key);
    }
    s = r;
  }
  s = s.replace(mm.reAliasBeforeCover, (all, a) => {
    hadName = true;
    keys.push(mm.aliasMap.get(a.toLowerCase()));
    return ' \u0001 ';
  });
  // "네코타 츠나 x 타비", "타비X네코타 츠나" → 외부 참여자. "Kobo Kanaeru 리코 COVER"처럼 그냥 나란히 있으면 원곡자 쪽
  const CONN = String.raw`(?:(?<![가-힣A-Za-z0-9])(?:x|×|with|and)(?![가-힣A-Za-z0-9])|[&,、+×])`;
  const guest =
    new RegExp(String.raw`[^\s\u0001(（]\s*[)）]?\s*${CONN}\s*\u0001`, 'i').test(s) || // 글자 x 이름
    new RegExp(String.raw`\u0001\s*(?:${CONN}|[xX])\s*[^\s\u0001)）]`, 'i').test(s.replace(RE_COVER_WORD, ' ')); // 이름 x 글자
  s = s.replace(/\u0001/g, ' ');
  let tail = false;
  RE_COVER_WORD.lastIndex = 0;
  const cw = RE_COVER_WORD.exec(s);
  RE_COVER_WORD.lastIndex = 0;
  if (cw) {
    hadCover = true;
    tail = s.slice(cw.index + cw[0].length).replace(/[\s\p{P}\p{S}]/gu, '').length >= 2;
  }
  const g = s.replace(RE_GROUP, ' ');
  if (g !== s) {
    hadName = true;
    group = true;
  }
  s = g;
  // 유닛 이름은 곡명("유니버스")과 겹칠 수 있어서, 커버 표기가 같이 있는 조각에서만 유닛으로 본다
  if (hadCover) {
    for (const u of mm.units) {
      const r = s.replace(u.re, ' ');
      if (r !== s) {
        hadName = true;
        units.push(u);
      }
      s = r;
    }
  }
  s = s.replace(RE_COVER_WORD, ' ').replace(RE_MV, ' ');
  if (hadName) s = s.replace(RE_CONNECT, ' ').replace(/^\s*[xX×]\s*(?=\S)/, ''); // "히나 x 리코"의 x 같은 이음말
  s = s.replace(/[「『【\[（(]\s*[」』】\]）)]/g, ' ').replace(/\s+([\]）)」』】])/g, '$1').replace(/\s+/g, ' ').replace(RE_TRIM_SEG, '').trim();
  s = s.replace(RE_WRAP_QUOTE, '$1');
  if (/^['"‘’“”]+$/.test(s)) s = '';
  return { text: s, hadName, hadCover, keys, units, group, tail, guest };
}

// 괄호 밖에 있는 구분 기호( / | ㅣ - l )로 나눈다
function splitTop(s) {
  const out = [];
  let depth = 0;
  let cur = '';
  const sp = (c) => c === undefined || /\s/.test(c);
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (OPEN.includes(ch)) depth++;
    else if (CLOSE.includes(ch)) depth = Math.max(0, depth - 1);
    if (depth === 0) {
      const prev = s[i - 1];
      const next = s[i + 1];
      const bar = '|｜ㅣ│┃∣'.includes(ch);
      const slash = ch === '/' && (sp(prev) || sp(next)); // "HUNTR/X", "W/X/Y"처럼 붙어 있는 /는 곡명·가수 이름의 일부
      const dash = (ch === '-' || ch === '–' || ch === '—') && sp(prev) && sp(next);
      const el = (ch === 'l' || ch === 'Ι') && sp(prev) && sp(next) && i > 0; // 세로줄 대신 쓴 소문자 L, 그리스 문자 Ι
      if (bar || slash || dash || el) {
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

// 제목 하나를 읽어서 { t: 곡명, o: 원곡자, x: 외부 참여자, m: 제목에서 찾은 멤버, g: 단체 표기 }
export function readTitle(title, mm) {
  let s = cleanText(title)
    .replace(/#[^\s#]*/g, ' ') // 해시태그
    .replace(RE_TAG, ' ')
    .replace(RE_MV, ' ')
    .replace(/(?<![A-Za-z])w\/\s+/gi, 'with ');
  const keys = [...mentions(s, mm)];
  const units = [];
  let group = false;
  const take = (r) => {
    keys.push(...r.keys);
    units.push(...r.units);
    if (r.group) group = true;
  };
  const quoted = RE_QUOTED.exec(s);

  // 【COVER】, (Akane Lize), 【유니 X 칸나】처럼 크레딧만 든 괄호는 통째로 지운다
  s = s.replace(RE_BRACKET, (all, inner) => {
    const r = credit(inner, mm);
    if (r.text !== '') return all;
    take(r);
    return ' ';
  });

  const content = [];
  const pending = []; // 크레딧 조각에 이름 말고 남은 글자 (외부 참여자이거나, 조각이 하나뿐이면 곡명)
  for (const seg of splitTop(s)) {
    const r = credit(seg, mm);
    take(r);
    if (!r.text) continue;
    if (r.hadName && r.guest && !r.tail) pending.push(r.text);
    else content.push(r.text);
  }
  if (!content.length && pending.length) content.push(pending.shift());

  let t = content[0] || '';
  let o = content[1] && content[1].length >= 2 && content[1].length <= 40 ? content[1] : '';
  // "유령이 되고싶어 [ゆうれいになりたい / 유이카]", "도쿄 테디베어 [東京テディベア l Neru]" → 괄호 안 마지막 조각이 원곡자
  const m = /^(.*?)\s*[「『【\[（(]([^「『【\[（(」』】\]）)]*)[」』】\]）)]\s*$/.exec(t);
  if (m) {
    const parts = m[2].split(/\s*\/\s*|\s*[ㅣ|｜│]\s*|\s+l\s+|\s+:\s+/).map((x) => x.trim()).filter(Boolean);
    if (parts.length > 1) {
      if (!o) o = parts[parts.length - 1];
      t = m[1].trim() || parts[0];
    }
  }
  if (quoted) {
    t = (quoted[1] || quoted[2]).trim();
    o = '';
  }
  const x = pending.filter((p) => p.length >= 2 && p.length <= 40).join(', ');
  const mset = [...new Set([...keys, ...units.flatMap((u) => u.members)])];
  const g = units.length ? [...new Set(units.map((u) => u.name))].join('·') : group ? '스텔라이브' : '';
  return { t: t.slice(0, 120), o: o.slice(0, 60), x, m: mset, g };
}

// 예전 이름 (테스트·다른 스크립트 호환)
export const parseCoverTitle = (title, mm) => {
  const r = readTitle(title, mm);
  return { t: r.t, o: r.o };
};

// ---- 설명란 → 원곡 / 작곡 표기 ----
const BULLET = String.raw`^[\s\-•·▶►*#■□◆◇○●★☆♪♬\[(【]*`;
const SEP = String.raw`\s*[\])】]?\s*[:：\-–—|]\s*`;
const RE_ORIG = new RegExp(BULLET + String.raw`(?:원곡|original(?:\s*(?:song|artist))?|本家)(?:\s*by)?` + SEP + '(.+)$', 'i');
const RE_COMP = new RegExp(BULLET + String.raw`(?:작곡|composer|composed\s*by|composition|作曲)` + SEP + '(.+)$', 'i');

export function cleanCredit(v) {
  return cleanText(v)
    .replace(/(?:https?:\/\/|www\.)\S+/g, '')
    .replace(/\S*(?:youtu\.be|youtube\.com|nicovideo\.jp|nico\.ms)\S*/gi, '')
    .replace(/[\[(（]\s*[\])）]/g, '')
    .replace(/\s+/g, ' ')
    .replace(RE_TRIM, '')
    .trim()
    .slice(0, 60);
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

// ---- 종류 태그 ----
// 한 영상에 여러 개가 붙는다: 참여(개인/콜라보) + 형태(3D 라이브, 쇼츠, 플레이리스트)
export const TAG_ORDER = ['개인', '콜라보', '3D 라이브', '쇼츠', '플레이리스트'];
const RE_3D = /3D\s*(?:LIVE|라이브|cover)/i;
const RE_PLAYLIST = /플레이리스트|플리(?![가-힣])|playlist|메들리|medley|mash\s*-?\s*up|매시업/i; // 여러 곡이 한 영상에 들어 있는 것
const RE_LOOP = /반복|loop|\d\s*(?:시간|hours?)/i; // "[1시간 반복]"은 길어도 플레이리스트가 아니다

// curated: curated.json에 적은 k. 배열이면 그 태그만 쓰고, 문자열이면 자동 태그에 더한다(개인/콜라보은 참여 구분을 바꾼다).
export function coverTags({ title, dur = 0, shorts = false, memberCount = 1, group = '', guest = '', curated }) {
  const legacy = (k) => (k === '협동' ? '콜라보' : k); // 예전 이름
  curated = Array.isArray(curated) ? curated.map(legacy) : legacy(curated);
  const sort = (a) => [...new Set(a)].filter((k) => TAG_ORDER.includes(k)).sort((x, y) => TAG_ORDER.indexOf(x) - TAG_ORDER.indexOf(y));
  if (Array.isArray(curated)) return sort(curated);
  const text = title || '';
  const tags = [];
  if (RE_3D.test(text)) tags.push('3D 라이브');
  if (dur > 0 && (dur <= 61 || (dur <= 180 && shorts))) tags.push('쇼츠');
  if (RE_PLAYLIST.test(text) || (dur >= 15 * 60 && !RE_LOOP.test(text))) tags.push('플레이리스트');
  let part = memberCount > 1 || group || guest ? '콜라보' : '개인';
  if (curated === '개인' || curated === '콜라보') part = curated;
  else if (curated) tags.push(curated);
  return sort([part, ...tags]);
}
