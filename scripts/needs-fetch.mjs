// members.json에 있는데 아직 한 번도 읽어오지 못한 채널이 있으면 "yes"를 출력한다.
// 워크플로가 이걸 보고, 푸시로 돌 때도 수집을 할지 정한다 (채널을 추가하고 푸시하면 바로 수집되게).
import { path, readJSON } from './lib.mjs';

const cfg = await readJSON(path('members.json'));
const cache = await readJSON(path('data', 'youtube.json'), { channels: {} });
const refs = [
  ...cfg.members.filter((m) => m.enabled !== false).flatMap((m) => m.youtube || []),
  ...(cfg.sharedYoutube || []),
];
console.log(refs.some((r) => !cache.channels?.[r]?.uploads) ? 'yes' : 'no');
