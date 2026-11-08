// 디트릭스: 독립·예술영화관 공용 예매 플랫폼의 공개 조회 경로
import { UA, compact, dashed, fetchJson, mapPool, summarize } from '../lib/util.mjs';
import { relayGet, directThenRelay } from '../lib/relay.mjs';

export const id = 'dtryx';
const BASE = 'https://api.dtryx.com/dtryx/cms/thirdparty/movie';
const GUID = {
  timetable: '37E0BA0F-DA5F-4376-9BA4-B5D27286AB87',
  playDates: '324A2914-AB19-42A3-BDFE-58A08B2DC35D',
};

async function call(endpoint, guid, params) {
  const query = new URLSearchParams({ ChannelCd: 'homepage', EngVerYn: 'N', WorkGuID: guid, ...params });
  const json = await fetchJson(`${BASE}/${endpoint}?${query}`, {
    headers: { Accept: 'application/json, text/javascript, */*; q=0.01', 'User-Agent': UA },
  });
  if (json.RetCode !== 'success') throw new Error(`디트릭스 응답 오류 ${json.RetMsg || ''}`);
  return Array.isArray(json.Recordset) ? json.Recordset : [];
}

async function direct({ dates, config }) {
  const theaters = config.dtryxTheaters || [];
  // 접속 자체가 되는지 먼저 한 번 확인 (막혀 있으면 바로 중계로)
  await call('third-party-type2-timetable-play-date-list', GUID.playDates,
    { BrandCd: theaters[0].brand, CinemaCd: theaters[0].code, MovieCd: '' });
  const window = new Set(dates);
  const plan = await mapPool(theaters, config.concurrency, config.delayMs, async (t) => {
    try {
      const rows = await call('third-party-type2-timetable-play-date-list', GUID.playDates,
        { BrandCd: t.brand, CinemaCd: t.code, MovieCd: '' });
      const open = rows.filter((r) => r.HiddenYn !== 'Y' && r.RestYn !== 'Y')
        .map((r) => dashed(r.PlaySDT)).filter((d) => d && window.has(d));
      return open.map((d) => ({ t, d }));
    } catch {
      return dates.map((d) => ({ t, d }));
    }
  });
  const jobs = plan.flatMap((p) => (p.ok ? p.value : []));
  const results = await mapPool(jobs, config.concurrency, config.delayMs, async ({ t, d }) => {
    const rows = await call('third-party-type2-timetable-list', GUID.timetable,
      { BrandCd: t.brand, CinemaCd: t.code, PlaySDT: d, ImgSize: 'small' });
    const titles = rows.map((r) => r.MovieNm);
    return [...new Set(titles.filter(Boolean))].map((title) =>
      ({ chain: 'indie', theater: t.name, title, playDate: d }));
  });
  return summarize(results, theaters.length);
}

async function viaRelay({ dates, config }) {
  const theaters = config.dtryxTheaters || [];
  const jobs = theaters.flatMap((t) => dates.map((d) => ({ t, d })));
  const results = await mapPool(jobs, config.relayConcurrency, config.relayDelayMs, async ({ t, d }) => {
    const r = await relayGet(config, '/api/dtryx/seats',
      { cinemaCode: t.code, brandCode: t.brand, playDate: compact(d), limit: '200' });
    const titles = (r.showtimes || []).map((x) => x.movieName);
    return [...new Set(titles.filter(Boolean))].map((title) =>
      ({ chain: 'indie', theater: t.name, title, playDate: d }));
  });
  return summarize(results, theaters.length);
}

export const collect = (ctx) => directThenRelay(ctx, direct, viaRelay);
