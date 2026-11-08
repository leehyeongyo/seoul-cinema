// CGV: 공식 웹사이트가 쓰는 조회 경로 (비공식, 바뀔 수 있음)
import { createHmac } from 'node:crypto';
import { UA, compact, fetchJson, mapPool, summarize } from '../lib/util.mjs';
import { relayGet, directThenRelay } from '../lib/relay.mjs';

export const id = 'cgv';
const SECRET = 'ydqXY0ocnFLmJGHr_zNzFcpjwAsXq_8JcBNURAkRscg';
const PATH = {
  theaters: '/cnm/atkt/searchRegnList',
  movies: '/cnm/atkt/searchOnlyCgvMovList',
  siteTimetable: '/cnm/atkt/searchMovScnInfo',
};

function headers(path) {
  const ts = Math.floor(Date.now() / 1000).toString();
  const signature = createHmac('sha256', SECRET).update(`${ts}|${path}|`).digest('base64');
  const site = path === PATH.siteTimetable
    ? { Origin: 'https://cgv.co.kr', Referer: 'https://cgv.co.kr/cnm/movieBook/cinema',
        'Sec-Fetch-Site': 'same-origin', 'Sec-Fetch-Mode': 'cors', 'Sec-Fetch-Dest': 'empty' }
    : {};
  return { ...site, Accept: 'application/json', 'Accept-Language': 'ko-KR', 'User-Agent': UA,
    'X-TIMESTAMP': ts, 'X-SIGNATURE': signature };
}

async function get(path, params) {
  const url = new URL(path === PATH.siteTimetable
    ? 'https://cgv.co.kr/api/v1/booking/searchMovScnInfo'
    : `https://api.cgv.co.kr${path}`);
  url.search = new URLSearchParams({ coCd: 'A420', ...params }).toString();
  const body = await fetchJson(url, { headers: headers(path), redirect: 'manual' });
  if (body.statusCode !== undefined && body.statusCode !== 0) {
    throw new Error(`CGV 응답 오류 ${body.statusCode} ${body.statusMessage || ''}`);
  }
  return Array.isArray(body.data) ? body.data : [];
}

async function direct({ dates, config }) {
  const regions = await get(PATH.theaters, {});
  const theaters = regions
    .filter((r) => String(r.regnGrpNm || '').includes('서울'))
    .flatMap((r) => r.siteList || [])
    .filter((s) => s.siteNo && s.siteNm)
    .map((s) => ({ code: s.siteNo, name: String(s.siteNm).replace(/^CGV\s*/, '') }));
  if (!theaters.length) throw new Error('서울 극장 목록이 비어 있음');

  const jobs = theaters.flatMap((t) => dates.map((d) => ({ t, d })));
  const results = await mapPool(jobs, config.concurrency, config.delayMs, async ({ t, d }) => {
    let titles;
    try {
      const rows = await get(PATH.siteTimetable, { siteNo: t.code, scnYmd: compact(d), rtctlScopCd: '08' });
      titles = rows.map((r) => r.movNm || r.prodNm);
    } catch {
      const rows = await get(PATH.movies, { siteNo: t.code, scnYmd: compact(d) });
      titles = rows.map((r) => r.movNm);
    }
    return [...new Set(titles.filter(Boolean))].map((title) =>
      ({ chain: 'cgv', theater: t.name, title, playDate: d }));
  });
  return summarize(results, theaters.length);
}

async function viaRelay({ dates, config }) {
  const data = await relayGet(config, '/api/cgv/theaters', { regionCode: '01', limit: '300' });
  const theaters = (data.theaters || [])
    .filter((t) => t.theaterCode && t.theaterName)
    .map((t) => ({ code: t.theaterCode, name: String(t.theaterName).replace(/^CGV\s*/, '') }));
  if (!theaters.length) throw new Error('중계: 서울 극장 목록이 비어 있음');

  const jobs = theaters.flatMap((t) => dates.map((d) => ({ t, d })));
  const results = await mapPool(jobs, config.relayConcurrency, config.relayDelayMs, async ({ t, d }) => {
    const r = await relayGet(config, '/api/cgv/timetable', { theaterCode: t.code, playDate: compact(d), limit: '1000' });
    const titles = (r.timetable || []).map((x) => x.movieName);
    return [...new Set(titles.filter(Boolean))].map((title) =>
      ({ chain: 'cgv', theater: t.name, title, playDate: d }));
  });
  return summarize(results, theaters.length);
}

export const collect = (ctx) => directThenRelay(ctx, direct, viaRelay);
