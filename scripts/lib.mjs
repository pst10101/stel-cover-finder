// 공통 유틸: 파일 입출력, HTTP 요청(재시도), 한국 시간 변환
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const path = (...p) => join(ROOT, ...p);

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function readJSON(file, fallback) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch (e) {
    if (e.code === 'ENOENT' && fallback !== undefined) return fallback;
    throw e;
  }
}

// git diff가 보기 좋도록 배열 원소를 한 줄에 하나씩 쓴다.
export async function writeJSON(file, data) {
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, lineStringify(data) + '\n');
}

function lineStringify(value, indent = '') {
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    const inner = indent + ' ';
    return '[\n' + value.map((v) => inner + JSON.stringify(v)).join(',\n') + '\n' + indent + ']';
  }
  if (value && typeof value === 'object') {
    const keys = Object.keys(value);
    if (keys.length === 0) return '{}';
    const inner = indent + ' ';
    return (
      '{\n' +
      keys.map((k) => inner + JSON.stringify(k) + ': ' + lineStringify(value[k], inner)).join(',\n') +
      '\n' + indent + '}'
    );
  }
  return JSON.stringify(value);
}

export class HttpError extends Error {
  constructor(status, url, body) {
    super(`HTTP ${status} ${redact(url)}`);
    this.status = status;
    this.body = body;
  }
}

// API 키가 로그에 찍히지 않게 가린다.
export const redact = (url) => String(url).replace(/([?&]key=)[^&]+/, '$1***');

export async function getJSON(url, { headers = {}, retries = 2, timeoutMs = 20000 } = {}) {
  for (let attempt = 0; ; attempt++) {
    let res;
    try {
      res = await fetch(url, { headers, signal: AbortSignal.timeout(timeoutMs) });
    } catch (e) {
      if (attempt >= retries) throw e;
      await sleep(3000 * (attempt + 1));
      continue;
    }
    if (res.status >= 500 && attempt < retries) {
      await sleep(5000 * (attempt + 1));
      continue;
    }
    if (!res.ok) throw new HttpError(res.status, url, await res.text().catch(() => ''));
    return res.json();
  }
}

// epoch ms → "2024-03-12" (한국 시간 날짜. KST는 UTC+9, 서머타임 없음)
const KST_MS = 9 * 3600 * 1000;
export function kstDate(ms) {
  return new Date(ms + KST_MS).toISOString().slice(0, 10);
}

export const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
