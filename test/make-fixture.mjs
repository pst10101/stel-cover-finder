// 실제 영상 제목 몇 개 + 지어낸 영상으로 가짜 API 응답을 만든다
import { writeFileSync } from 'node:fs';
const videos = {};
const add = (id, title, publishedAt, extra = {}) => ((videos[id] = { id, title, publishedAt, ...extra }), id);
const filler = (prefix, n) => Array.from({ length: n }, (_, i) => add(`${prefix}${String(i).padStart(5, '0')}`, `${prefix} 일상 영상 ${i}`, '2024-01-01T10:00:00Z', { duration: 'PT12M' }));

const lize = [
  add('TESTLEMON01', 'Lemon (米津玄師) / 아카네 리제 Cover', '2026-11-05T10:00:00Z', { duration: 'PT4M10S', description: '♪ Original : 米津玄師\nMix : 누군가\n작곡 : 요네즈 켄시\nhttps://example.com' }),
  add('TESTPREMIER', 'Pretender / 아카네 리제 Cover', '2026-11-20T10:00:00Z', { live: 'upcoming' }),
  add('FzefgoF26Ac', '여우의 별자리 「심월과 달의 노래」 (『명조워더링 웨이브』 OST)ㅣ아카네 리제(Akane Lize) 【COVER】', '2026-09-26T09:00:00Z'),
  add('TESTVLOG001', '리제의 일상 브이로그', '2026-09-01T09:00:00Z'),
  add('TESTSHORT01', '커버 한 소절 불러봤어요 #shorts', '2026-08-01T09:00:00Z', { duration: 'PT35S' }),
  add('TESTBEHIND1', '커버곡 녹음 비하인드', '2026-07-01T09:00:00Z'),
  ...filler('LZ', 60),
  add('naWmFCbwi3M', '괴물 (怪物) / 아카네 리제 Cover', '2023-06-09T09:00:00Z'),
];
const mashiro = [
  add('TESTFANCLUB', '하나 둘 팬클럽 (いーあるふぁんくらぶ) / 네네코 마시로 x 강지 Cover', '2025-08-06T09:00:00Z'),
  add('TESTSICK001', '병명 상사병 (病名は愛だった) / 네네코 마시로 Cover', '2025-06-10T03:00:00Z'),
  add('CbuiRlGeA-g', '유니버스 (ユニバース) / UNIVERSE Cover', '2025-06-10T09:00:00Z'),
  add('TESTCHU0001', '츄, 다양성。 (ちゅ、多様性。) / 네네코 마시로 Cover', '2024-02-18T16:30:00Z'),
];
const yuni = [
  add('kNzGpNEdBqw', '오버라이드 「オーバーライド / 吉田夜世」 - 아야츠노 유니 Cover', '2026-10-09T09:00:00Z'),
  add('TESTDRYFLOW', '드라이 플라워 「ドライフラワー / 優里」 - 아야츠노 유니 Cover', '2026-10-20T09:00:00Z'),
  add('QDIdN_eBvl0', '【아야츠노 유니 X 아이리 칸나】 점묘의 노래 (点描の唄) | Cover', '2024-12-01T09:00:00Z'),
];
const hina = [
  add('Qngf5HNfl6Q', '소녀레이(少女レイ) - みきとP | 시라유키 히나 x 유즈하 리코 Cover', '2026-09-27T09:00:00Z'),
  add('TESTHINA001', 'Stay With Me - 마츠바라 미키 | 시라유키 히나 x 유즈하 리코 Cover', '2026-10-30T09:00:00Z'),
];
const nana = [
  add('Zetk77I6_s8', '오츠카레summer [おつかれsummer/HALCALI] / 하나코 나나, 사키하네 후야 COVER', '2026-09-12T09:00:00Z'),
  add('LX9FDGVcLII', '라이브 맞습니다. 아이도루의 고난이도 럭 커버 | 김하온 - 꾳통 (feat. 창모) #스텔라이브 #vtuber #럭', '2024-12-19T09:00:00Z', { duration: 'PT58S' }),
  add('TESTMEDLEY1', '여름 노래 메들리 / 하나코 나나 Cover', '2026-07-15T09:00:00Z', { duration: 'PT22M' }),
  add('TEST3DLIVE1', '[3D LIVE] 아이돌 / 하나코 나나 Cover', '2026-10-25T09:00:00Z'),
];
const official = [
  add('5kTp7SQCR_Y', "STELLIVE  | ' Tell Your World (Livetune) ' Cover", '2025-05-05T09:00:00Z'),
  add('TESTGROUP01', "STELLIVE | ' 새 단체곡 ' Cover", '2026-11-01T09:00:00Z'),
];
const ch = (id, title, uploads, list) => ({ id, title, uploads, videos: list });
const pad = (s) => ('UC' + s).padEnd(24, 'x');
const channels = {
  '@akanelize': ch(pad('lize'), '아카네 리제 AKANE LIZE', 'UUlize', lize),
  '@neneko_mashiro': ch(pad('mashiro'), '네네코 마시로', 'UUmashiro', mashiro),
  '@ayatsunoyuni': ch(pad('yuni'), '아야츠노 유니 AYATSUNO YUNI', 'UUyuni', yuni),
  '@shirayukihina': ch(pad('hina'), '시라유키 히나 SHIRAYUKI HINA', 'UUhina', hina),
  UCcA21_PzN1EhNe7xS4MJGsQ: ch('UCcA21_PzN1EhNe7xS4MJGsQ', '하나코 나나 HANAKO NANA', 'UUnana', nana),
  '@stellive_official': ch(pad('official'), '스텔라이브 STELLIVE OFFICIAL', 'UUofficial', official),
  '@arahashitabi': ch(pad('tabi'), '아라하시 타비', 'UUtabi', []),
};
writeFileSync(new URL('./fixture.json', import.meta.url), JSON.stringify({ channels, videos }, null, 1));
console.log('fixture: channels', Object.keys(channels).length, 'videos', Object.keys(videos).length);
