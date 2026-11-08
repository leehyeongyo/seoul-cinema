// 롯데시네마: 공식 웹사이트 예매 화면이 쓰는 조회 경로 (비공식)
import { UA, dashed, fetchJson, mapPool, summarize } from '../lib/util.mjs';

export const id = 'lotte';
const URL_TICKETING = 'https://www.lottecinema.co.kr/LCWS/Ticketing/TicketingData.aspx';

async function call(method, fields) {
  const body = new FormData();
  body.append('paramList', JSON.stringify({
    MethodName: method, channelType: 'HO', osType: 'W', osVersion: UA, ...fields,
  }));
  const json = await fetchJson(URL_TICKETING, {
    method: 'POST',
    headers: { Accept: 'application/json, text/javascript, */*; q=0.01', 'User-Agent': UA,
      Referer: 'https://www.lottecinema.co.kr/NLCHS/Ticketing' },
    body,
  });
  if (json.IsOK === false || json.IsOK === 'false') throw new Error(`롯데 응답 오류 ${json.ResultMessage || ''}`);
  return json;
}

export async function collect({ dates, config }) {
  const page = await call('GetTicketingPageTOBE', { memberOnNo: '0' });
  const byId = new Map();
  for (const c of page.Cinemas?.Cinemas?.Items || []) {
    const seoul = String(c.CinemaAddrSummary || '').startsWith('서울') || String(c.DetailDivisionCode) === '0001';
    if (seoul && String(c.DivisionCode) === '1' && c.CinemaID && c.CinemaNameKR) {
      byId.set(String(c.CinemaID), { id: `${c.DivisionCode}|${c.DetailDivisionCode}|${c.CinemaID}`, name: c.CinemaNameKR });
    }
  }
  const theaters = [...byId.values()];
  if (!theaters.length) throw new Error('서울 극장 목록이 비어 있음');

  // 롯데 전체 영화 목록의 개봉일은 날짜 보조 정보로 넘긴다
  const movies = (page.Movies?.Movies?.Items || []).filter((m) => m.MovieNameKR);
  const releaseHints = movies
    .map((m) => ({ title: m.MovieNameKR, date: dashed(m.ReleaseDate) }))
    .filter((m) => m.date);

  const jobs = theaters.flatMap((t) => dates.map((d) => ({ t, d })));
  const results = await mapPool(jobs, config.concurrency, config.delayMs, async ({ t, d }) => {
    const json = await call('GetPlaySequence', { playDate: d, cinemaID: t.id, representationMovieCode: '' });
    const titles = (json.PlaySeqs?.Items || []).map((s) => s.MovieNameKR);
    return [...new Set(titles.filter(Boolean))].map((title) =>
      ({ chain: 'lotte', theater: t.name, title, playDate: d }));
  });
  const out = summarize(results, theaters.length);

  // 지점별 조회가 하나도 안 잡히면 '지점 미확인'으로라도 영화 목록을 반영 (러프 모드)
  if (!out.entries.length && movies.length) {
    const last = dates[dates.length - 1];
    out.entries = releaseHints
      .filter((m) => m.date <= last)
      .map((m) => ({ chain: 'lotte', theater: null, title: m.title, playDate: m.date < dates[0] ? dates[0] : m.date }));
    out.warning = '지점별 상영 정보를 못 받아 전체 상영작 목록만 반영';
  }
  return { ...out, releaseHints };
}
