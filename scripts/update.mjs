// 매일 실행: 서울 극장 상영 목록 수집 → 개봉/재개봉 판정 → docs/data/films.json 저장
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { addDays, kstToday } from './lib/util.mjs';
import { buildGroups, merge, CHAINS } from './lib/merge.mjs';
import { normalizeTitle } from './lib/normalize.mjs';
import * as cgv from './sources/cgv.mjs';
import * as megabox from './sources/megabox.mjs';
import * as lotte from './sources/lotte.mjs';
import * as dtryx from './sources/dtryx.mjs';
import * as kobis from './sources/kobis.mjs';

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const [k, v] = a.replace(/^--/, '').split('=');
  return [k, v ?? true];
}));
const MOCK = Boolean(args.mock);
const OUT = args.out || 'docs/data/films.json';
const today = args.today || kstToday();
const config = JSON.parse(await readFile(new URL('../config.json', import.meta.url), 'utf8'));
const dates = Array.from({ length: config.scanDays }, (_, i) => addDays(today, i));
const mock = MOCK ? await import('./mock/fixtures.mjs') : null;

let previous = { films: [] };
try {
  previous = JSON.parse(await readFile(args.in || OUT, 'utf8'));
} catch { /* 첫 실행 */ }
const bootstrap = !previous.films?.length;

const log = (...m) => console.log(...m);
log(`기준일 ${today} · 조회 ${dates[0]}~${dates.at(-1)}${MOCK ? ' · 샘플 모드' : ''}`);

// 1) 극장 상영 목록
const status = {};
const entries = [];
const releaseHints = new Map();
for (const src of [cgv, lotte, megabox, dtryx]) {
  const started = Date.now();
  try {
    const r = MOCK ? mock.collect(src.id, dates, today) : await src.collect({ dates, config });
    entries.push(...r.entries);
    for (const h of r.releaseHints || []) releaseHints.set(normalizeTitle(h.title).key, h.date);
    status[src.id] = { ok: true, theaters: r.theaters, showings: r.entries.length, warning: r.warning || null };
    log(`✓ ${src.id}: 극장 ${r.theaters}곳, ${r.entries.length}건${r.warning ? ` (주의: ${r.warning})` : ''} ${Date.now() - started}ms`);
  } catch (error) {
    status[src.id] = { ok: false, error: error.message };
    log(`✗ ${src.id}: ${error.message}`);
  }
}

// 2) KOBIS
const groups = buildGroups(entries, config);
const prevKeys = new Map(previous.films?.map((f) => [f.key, f]) || []);
let kobisBulk = [];
const kobisLookups = new Map();
const kobisKey = process.env.KOBIS_KEY;
if (MOCK) {
  kobisBulk = mock.kobisBulk(today);
  for (const g of groups.values()) kobisLookups.set(g.key, mock.kobisByTitle(g.key));
  status.kobis = { ok: true, movies: kobisBulk.length };
} else if (!kobisKey) {
  status.kobis = { ok: false, error: 'KOBIS_KEY가 설정되지 않음' };
  log('✗ kobis: KOBIS_KEY 없음 (개봉일은 상영 시작일로 추정)');
} else {
  try {
    const years = [...new Set([today, addDays(today, config.upcomingDays)].map((d) => d.slice(0, 4)))];
    kobisBulk = await kobis.bulk(kobisKey, years, config.delayMs);
    const bulkKeys = new Set(kobisBulk.map((k) => normalizeTitle(k.title).key));
    // 기록에 없는 새 영화 중 KOBIS 목록에서 못 찾았거나 재개봉 표시가 있는 것만 제목 검색
    const need = [...groups.values()].filter((g) => !prevKeys.has(g.key) && (!bulkKeys.has(g.key) || g.reFlag));
    for (const g of need.slice(0, config.maxKobisLookups)) {
      const title = [...g.displays.keys()][0];
      try {
        const list = await kobis.byTitle(kobisKey, title);
        kobisLookups.set(g.key, list.filter((k) => normalizeTitle(k.title).key === g.key));
      } catch { /* 개별 실패는 무시 */ }
    }
    status.kobis = { ok: true, movies: kobisBulk.length, lookups: Math.min(need.length, config.maxKobisLookups) };
    log(`✓ kobis: ${kobisBulk.length}편, 제목 검색 ${status.kobis.lookups}건`);
  } catch (error) {
    status.kobis = { ok: false, error: error.message };
    log(`✗ kobis: ${error.message}`);
  }
}

// 3) 병합
const sourcesOk = { cgv: status.cgv.ok, lotte: status.lotte.ok, megabox: status.megabox.ok, indie: status.dtryx.ok };
const films = merge({
  prev: previous.films || [], groups, kobisBulk, kobisLookups, releaseHints, sourcesOk,
  kobisOk: status.kobis.ok, today, config, bootstrap,
});

const out = {
  updatedAt: new Date().toISOString(),
  today,
  startedOn: previous.startedOn || today,
  sample: MOCK || undefined,
  status,
  films,
};
await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, `${JSON.stringify(out, null, 1)}\n`);

const count = (k) => films.filter(k).length;
log(`저장: ${OUT} · 전체 ${films.length}편 (개봉 ${count((f) => f.kind === 'new')}, 재개봉 ${count((f) => f.kind === 're')}, 상영관 미정 ${count((f) => f.scheduledOnly)})`);

const failed = [...CHAINS.map((c) => (c === 'indie' ? 'dtryx' : c)), 'kobis'].filter((s) => !status[s].ok);
if (failed.length) {
  log(`일부 실패: ${failed.join(', ')}`);
  process.exitCode = 2;
}
