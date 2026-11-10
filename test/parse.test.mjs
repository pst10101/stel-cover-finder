import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { memberMatchers, mentions, parseCoverTitle, parseCredits, looksLikeCover, coverKind, isoDuration } from '../scripts/parse.mjs';
const cfg = JSON.parse(readFileSync(new URL('../members.json', import.meta.url), 'utf8'));
const mm = memberMatchers(cfg.members);
const cases = [
  ['괴물 (怪物) / 아카네 리제 Cover', '괴물 (怪物)', '', ['lize']],
  ['오버라이드 「オーバーライド / 吉田夜世」 - 아야츠노 유니 Cover', '오버라이드', '吉田夜世', ['yuni']],
  ['소녀레이(少女レイ) - みきとP | 시라유키 히나 x 유즈하 리코 Cover', '소녀레이(少女レイ)', 'みきとP', ['hina', 'riko']],
  ['오츠카레summer [おつかれsummer/HALCALI] / 하나코 나나, 사키하네 후야 COVER', '오츠카레summer', 'HALCALI', ['huya', 'nana']],
  ['여우의 별자리 「심월과 달의 노래」 (『명조워더링 웨이브』 OST)ㅣ아카네 리제(Akane Lize) 【COVER】', '여우의 별자리 「심월과 달의 노래」 (『명조워더링 웨이브』 OST)', '', ['lize']],
  ['【아야츠노 유니 X 아이리 칸나】 점묘의 노래 (点描の唄) | Cover', '점묘의 노래 (点描の唄)', '', ['yuni', 'kanna']],
  ["STELLIVE  | ' Tell Your World (Livetune) ' Cover", 'Tell Your World (Livetune)', '', []],
  ['Stay With Me - 마츠바라 미키 | 시라유키 히나 x 유즈하 리코 Cover', 'Stay With Me', '마츠바라 미키', ['hina', 'riko']],
  ['하나 둘 팬클럽 (いーあるふぁんくらぶ) / 네네코 마시로 x 강지 Cover', '하나 둘 팬클럽 (いーあるふぁんくらぶ)', '', ['mashiro', 'gangzi']],
  ['Golden (Official MV) / AKANE LIZE × AOKUMO RIN × HANAKO NANA cover', 'Golden', '', ['lize', 'rin', 'nana']],
];
for (const [title, t, o, m] of cases) {
  const r = parseCoverTitle(title, mm);
  assert.equal(r.t, t, title);
  assert.equal(r.o, o, title);
  assert.deepEqual(mentions(title, mm).sort(), [...m].sort(), title);
}
assert.deepEqual(mentions('건강지킴이 커버', mm), []); // "강지"가 다른 낱말 속에 있을 때
assert.deepEqual(mentions('강지님과 함께 커버', mm), ['gangzi']);
assert.equal(looksLikeCover('Discover my room'), false);
assert.equal(looksLikeCover('커버곡 녹음 비하인드'), false);
assert.equal(looksLikeCover('괴물 / 아카네 리제 COVER'), true);
assert.deepEqual(parseCredits('♪ Original : 米津玄師\nMix : A\n작곡 : 요네즈 켄시 https://x.y'), { o: '米津玄師', c: '요네즈 켄시' });
assert.deepEqual(parseCredits('■ 원곡 - YOASOBI「怪物」\n【作曲】: Ayase'), { o: 'YOASOBI「怪物」', c: 'Ayase' });
assert.deepEqual(parseCredits('오리지널 곡이 아닙니다'), { o: '', c: '' });
assert.equal(isoDuration('PT1H2M3S'), 3723);
assert.equal(coverKind({ title: 'x', dur: 35, memberCount: 1 }), '쇼츠');
assert.equal(coverKind({ title: 'x', dur: 150, shorts: true, memberCount: 1 }), '쇼츠');
assert.equal(coverKind({ title: 'x', dur: 150, memberCount: 2 }), '협동');
assert.equal(coverKind({ title: '[3D LIVE] x', dur: 200, memberCount: 1 }), '3D 라이브');
assert.equal(coverKind({ title: 'x', dur: 1320, memberCount: 1 }), '플레이리스트');
console.log('parse tests ok:', cases.length, 'titles');
