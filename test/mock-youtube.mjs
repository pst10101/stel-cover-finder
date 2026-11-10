// 테스트용 가짜 YouTube Data API (channels / playlistItems / videos 세 가지만 흉내)
//   node test/mock-youtube.mjs [포트]   → YOUTUBE_API_BASE=http://127.0.0.1:포트 로 수집 스크립트를 돌려 본다
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';

const file = process.env.MOCK_FIXTURE || new URL('./fixture.json', import.meta.url);
const load = () => JSON.parse(readFileSync(file, 'utf8'));
const port = Number(process.argv[2] || 8799);

createServer((req, res) => {
  const fx = load(); // 요청마다 다시 읽어서, 파일을 고치면 "새 영상이 올라온 상황"을 만들 수 있다
  const u = new URL(req.url, 'http://x');
  const q = u.searchParams;
  const send = (code, body) => {
    res.writeHead(code, { 'content-type': 'application/json' });
    res.end(JSON.stringify(body));
  };
  if (!q.get('key')) return send(400, { error: 'no key' });
  if (u.pathname.endsWith('/channels')) {
    const ref = q.get('forHandle') || q.get('id');
    const ch = fx.channels[ref];
    if (!ch) return send(200, { items: [] });
    return send(200, { items: [{ id: ch.id, snippet: { title: ch.title }, contentDetails: { relatedPlaylists: { uploads: ch.uploads } } }] });
  }
  if (u.pathname.endsWith('/playlistItems')) {
    const ch = Object.values(fx.channels).find((c) => c.uploads === q.get('playlistId'));
    if (!ch) return send(404, { error: 'playlistNotFound' });
    const vids = ch.videos.map((id) => fx.videos[id]).filter((v) => !v.private);
    const start = Number(q.get('pageToken') || 0);
    const page = vids.slice(start, start + 50);
    return send(200, {
      items: page.map((v) => ({ snippet: { title: v.title }, contentDetails: { videoId: v.id } })),
      ...(start + 50 < vids.length ? { nextPageToken: String(start + 50) } : {}),
    });
  }
  if (u.pathname.endsWith('/videos')) {
    const ids = (q.get('id') || '').split(',');
    return send(200, {
      items: ids.map((id) => fx.videos[id]).filter((v) => v && !v.private).map((v) => ({
        id: v.id,
        snippet: { title: v.title, description: v.description || '', publishedAt: v.publishedAt, liveBroadcastContent: v.live || 'none' },
        contentDetails: { duration: v.duration || 'PT4M' },
      })),
    });
  }
  send(404, { error: 'unknown' });
}).listen(port, '127.0.0.1', () => console.log('mock youtube on', port));
