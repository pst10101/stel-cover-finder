// 실제 영상 제목으로 제목 파서를 확인한다:  node test/parse.test.mjs
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { memberMatchers, readTitle, parseCredits, looksLikeCover, coverTags, isoDuration } from '../scripts/parse.mjs';

const cfg = JSON.parse(readFileSync(new URL('../members.json', import.meta.url), 'utf8'));
const mm = memberMatchers(cfg.members, cfg.units);

// [제목, 곡명, 원곡자, 멤버, 단체 표기, 외부 참여자]
const cases = [
  ['괴물 (怪物) / 아카네 리제 Cover', '괴물 (怪物)', '', ['lize']],
  ['오버라이드 「オーバーライド / 吉田夜世」 - 아야츠노 유니 Cover', '오버라이드', '吉田夜世', ['yuni']],
  ['소녀레이(少女レイ) - みきとP | 시라유키 히나 x 유즈하 리코 Cover', '소녀레이(少女レイ)', 'みきとP', ['hina', 'riko']],
  ['오츠카레summer [おつかれsummer/HALCALI] / 하나코 나나, 사키하네 후야 COVER', '오츠카레summer', 'HALCALI', ['huya', 'nana']],
  ['여우의 별자리 「심월과 달의 노래」 (『명조워더링 웨이브』 OST)ㅣ아카네 리제(Akane Lize) 【COVER】', '여우의 별자리 「심월과 달의 노래」 (『명조워더링 웨이브』 OST)', '', ['lize']],
  ['【아야츠노 유니 X 아이리 칸나】 점묘의 노래 (点描の唄) | Cover', '점묘의 노래 (点描の唄)', '', ['yuni', 'kanna']],
  ["STELLIVE  | ' Tell Your World (Livetune) ' Cover", 'Tell Your World (Livetune)', '', [], '스텔라이브'],
  ['Stay With Me - 마츠바라 미키 | 시라유키 히나 x 유즈하 리코 Cover', 'Stay With Me', '마츠바라 미키', ['hina', 'riko']],
  ['하나 둘 팬클럽 (いーあるふぁんくらぶ) / 네네코 마시로 x 강지 Cover', '하나 둘 팬클럽 (いーあるふぁんくらぶ)', '', ['mashiro', 'gangzi']],
  ['Golden (Official MV) / AKANE LIZE × AOKUMO RIN × HANAKO NANA cover', 'Golden', '', ['lize', 'rin', 'nana']],
  // 해상도 표기, 유닛 이름
  ['[4K] BLACKHOLE - IVE / 유니버스 (Universe) Cover', 'BLACKHOLE', 'IVE', ['tabi', 'mashiro', 'hina', 'lize'], '유니버스'],
  ['유니버스 (ユニバース) / UNIVERSE Cover', '유니버스 (ユニバース)', '', ['tabi', 'mashiro', 'hina', 'lize'], '유니버스'],
  ['괴도 F의 대본 ~사라진 다이아몬드의 수수께끼~ [ひとしずく×やま△] / 스텔라이브 (STELLIVE) Cover', '괴도 F의 대본 ~사라진 다이아몬드의 수수께끼~ [ひとしずく×やま△]', '', [], '스텔라이브'],
  // 3D Live Cover / Short Cover / Live Cover
  ['세계는 사랑에 빠져있어💌 / 시라유키 히나 3D Live Cover #honeyworks #世界は恋に落ちている #vtuber #shorts', '세계는 사랑에 빠져있어💌', '', ['hina']],
  ['IU - Strawberry Moon Ι Hina Short Cover #vtuber #shorts', 'IU', 'Strawberry Moon', ['hina']],
  ['[4K] LADY (요네즈 켄시)ㅣ아라하시 타비(Arahashi Tabi) 「Live Cover」', 'LADY (요네즈 켄시)', '', ['tabi']],
  // 세로줄 대신 쓴 소문자 L, 괄호 안 원곡자
  ['도쿄 테디베어 [東京テディベア l Neru] / 토키노 메리 (Tokino Mary) Cover', '도쿄 테디베어', 'Neru', ['mary']],
  ['푸른 산호초(青い珊瑚礁) - 松田 聖子 l 사키하네 후야(Sakihane Huya) Cover', '푸른 산호초(青い珊瑚礁)', '松田 聖子', ['huya']],
  ['숨바꼭질 [ かくれんぼㅣAliA ] / 유즈하 리코 Yuzuha Riko cover', '숨바꼭질', 'AliA', ['riko']],
  // 붙어 있는 / 는 나누지 않는다
  ['Golden - HUNTR/X (KPop Demon Hunters)ㅣCover by Lize x Rin x Nana #golden #shorts', 'Golden', 'HUNTR/X (KPop Demon Hunters)', ['lize', 'rin', 'nana']],
  ['W/X/Y (Tani Yuuki) / 아오쿠모 린(Aokumo Rin) Cover', 'W/X/Y (Tani Yuuki)', '', ['rin']],
  ['[4K] POP/STARS / Nerissa Ravencroft(네리사 레이븐크로프트) x 아오쿠모 린(Aokumo Rin) Cover', 'POP/STARS', '', ['rin'], '', 'Nerissa Ravencroft(네리사 레이븐크로프트)'],
  // 크레딧 자리의 줄임말, 외부 참여자
  ['메루메루메루메루메루메 [ 마시로 cover ]', '메루메루메루메루메루메', '', ['mashiro']],
  ['[1시간 반복] 우사기 랩 (Usagi Rap)｜Cover by 타비', '[1시간 반복] 우사기 랩 (Usagi Rap)', '', ['tabi']],
  ['한 페이지가 될 수 있게 [DAY6]ㅣ아라하시 타비X네코타 츠나 「COVER」', '한 페이지가 될 수 있게 [DAY6]', '', ['tabi'], '', '네코타 츠나'],
  ['네리사 레이븐크로프트 x 아오쿠모 린 - Dynamite [BTS Cover]', 'Dynamite [BTS]', '', ['rin'], '', '네리사 레이븐크로프트'],
  ['타상연화『打上花火』[DAOKO × 요네즈켄시] | 시라유키 히나 x 아오쿠모 린 Cover 스', '타상연화『打上花火』[DAOKO × 요네즈켄시]', '', ['hina', 'rin']],
  ['HELP!! - Kobo Kanaeru 유즈하 리코 COVER #vtuber #리코 #스텔라이브', 'HELP!!', 'Kobo Kanaeru', ['riko']],
  ['KING (Kanaria) / 텐코 시부키 x 아오쿠모 린 (Tenko Shibuki x Aokumo Rin) Cover', 'KING (Kanaria)', '', ['shibuki', 'rin']],
  // 일본어로 적힌 멤버 이름
  ['怪獣の花唄 (Vaundy) / 藍璃かんな Cover', '怪獣の花唄 (Vaundy)', '', ['kanna']],
  ['空奏列車 (Orangestar) Coverㅣ 藍璃かんな x VESPERBELL ヨミ', '空奏列車 (Orangestar)', '', ['kanna'], '', 'VESPERBELL ヨミ'],
  ['ラプンツェル(Rapunzel) / 白雪ひな Cover', 'ラプンツェル(Rapunzel)', '', ['hina']],
  // 따옴표 안이 곡명
  ["감정을 담아 '만찬가'를 불러보았다", '만찬가', '', []],
  ["에이토의 '향수' 잔잔하게 불러보았다 #shorts #vtuber", '향수', '', []],
  ['17歳メイドが 「マーシャル・マキシマイザー」 歌ってみた☁️ #vtuber #shorts', 'マーシャル・マキシマイザー', '', []],
  ['하츠네미쿠의 소실을 불러보았다 #shorts #마시로 #스텔라이브', '하츠네미쿠의 소실', '', []],
  // 커버 표기 뒤에 곡 정보가 오는 제목, 따옴표
  ['아라하시 타비 3D Cover 米津玄師 - Lady', '米津玄師', 'Lady', ['tabi']],
  ["'Yin and Yang' [TEAM ZICO X Crush] | 불러보았다 #shorts", "'Yin and Yang' [TEAM ZICO X Crush]", '', []],
  ["TAEYEON (태연) 'To. X' / 아오쿠모 린(Aokumo Rin) Cover", "TAEYEON (태연) 'To. X'", '', ['rin']],
  // 자모가 풀린(NFD) 제목
  ['SODA POP [Saja Boys] - 아라하시 타비 Cover'.normalize('NFD'), 'SODA POP [Saja Boys]', '', ['tabi']],
];
for (const [title, t, o, m, g = '', x = ''] of cases) {
  const r = readTitle(title, mm);
  assert.equal(r.t, t, 'title: ' + title);
  assert.equal(r.o, o, 'orig: ' + title);
  assert.deepEqual([...r.m].sort(), [...m].sort(), 'members: ' + title);
  assert.equal(r.g, g, 'group: ' + title);
  assert.equal(r.x, x, 'guest: ' + title);
}

assert.deepEqual(readTitle('건강지킴이 커버', mm).m, []); // "강지"가 다른 낱말 속에 있을 때
assert.deepEqual(readTitle('강지님과 함께 커버', mm).m, ['gangzi']);
assert.equal(looksLikeCover('Discover my room'), false);
assert.equal(looksLikeCover('커버곡 녹음 비하인드'), false);
assert.equal(looksLikeCover('커버곡 많관부!'), false);
assert.equal(looksLikeCover('리코가 커버한 노래 중 최고는? #shorts'), false);
assert.equal(looksLikeCover('부키 커버 모음! 붘플리 #shorts #cover'), false);
assert.equal(looksLikeCover("'아빠' 라고 불러봤더니 생긴 일"), false);
assert.equal(looksLikeCover('괴물 / 아카네 리제 COVER'), true);
assert.equal(looksLikeCover('하츠네미쿠의 소실을 불러보았다 #shorts'), true);
assert.deepEqual(parseCredits('♪ Original : 米津玄師\nMix : A\n작곡 : 요네즈 켄시 https://x.y'), { o: '米津玄師', c: '요네즈 켄시' });
assert.deepEqual(parseCredits('■ 원곡 - YOASOBI「怪物」\n【作曲】: Ayase'), { o: 'YOASOBI「怪物」', c: 'Ayase' });
assert.deepEqual(parseCredits('Original : ずうっといっしょ！ youtu.be/pdkXabc'), { o: 'ずうっといっしょ！', c: '' });
assert.deepEqual(parseCredits('오리지널 곡이 아닙니다'), { o: '', c: '' });
assert.equal(isoDuration('PT1H2M3S'), 3723);
// 종류 태그: 참여(개인/콜라보)와 형태(3D 라이브·쇼츠·플레이리스트)가 같이 붙는다
const tags = (o) => coverTags(o).join('+');
assert.equal(tags({ title: 'x', dur: 240 }), '개인');
assert.equal(tags({ title: 'x', dur: 35 }), '개인+쇼츠');
assert.equal(tags({ title: 'x', dur: 150, shorts: true }), '개인+쇼츠');
assert.equal(tags({ title: 'x', dur: 150, memberCount: 2 }), '콜라보');
assert.equal(tags({ title: '[4K] Dynamite - BTS / 하나코 나나 3D Cover', dur: 200 }), '개인+3D 라이브');
assert.equal(tags({ title: 'Dynamite - BTS / 하나코 나나 3D Cover #shorts', dur: 19, shorts: true }), '개인+3D 라이브+쇼츠');
assert.equal(tags({ title: 'x 3D Live Cover', dur: 260, memberCount: 4 }), '콜라보+3D 라이브');
assert.equal(tags({ title: 'x', dur: 240, guest: '네코타 츠나' }), '콜라보');
assert.equal(tags({ title: '투니버스 메들리', memberCount: 7 }), '콜라보+플레이리스트');
assert.equal(tags({ title: 'J-POP Mashup!' }), '개인+플레이리스트');
assert.equal(tags({ title: '여름밤 노래 [Part.1]', dur: 3000 }), '개인+플레이리스트');
assert.equal(tags({ title: '[1시간 반복] 우사기 랩 (Usagi Rap)', dur: 3593 }), '개인'); // 반복 재생은 플레이리스트가 아니다
assert.equal(tags({ title: 'x', dur: 40, curated: '3D 라이브' }), '개인+3D 라이브+쇼츠'); // 문자열 하나: 자동 태그에 더한다
assert.equal(tags({ title: 'x', dur: 240, memberCount: 2, curated: '개인' }), '개인');
assert.equal(tags({ title: 'x 3D Cover', dur: 40, curated: ['콜라보', '쇼츠'] }), '콜라보+쇼츠'); // 배열: 적은 것만
assert.equal(tags({ title: 'x', dur: 240, curated: '협동' }), '콜라보'); // 예전 이름으로 적어도 통한다
console.log('parse tests ok:', cases.length, 'titles');
