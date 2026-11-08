// 메가박스: 공식 웹사이트 예매 화면이 쓰는 조회 경로 (비공식)
import { UA, compact, fetchJson, mapPool, summarize } from '../lib/util.mjs';
import { relayGet, directThenRelay } from '../lib/relay.mjs';

export const id = 'megabox';
const URL_BOOKING = 'https://www.megabox.co.kr/on/oh/ohb/SimpleBooking/selectBokdList.do';

const decode = (s) => String(s || '')
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
  .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>');

async function post(fields) {
  const form = new URLSearchParams({
    sellChnlCd: 'ONLINE', brchNoListCnt: '1', areaCd1: '11', spclbYn1: 'N', theabKindCd1: '', ...fields,
  });
  return fetchJson(URL_BOOKING, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      Accept: 'application/json, text/javascript, */*; q=0.01',
      'X-Requested-With': 'XMLHttpRequest',
      'User-Agent': UA,
      Referer: 'https://www.megabox.co.kr/booking',
    },
    body: form.toString(),
  });
}

/** 서울 지점 찾기: 지역 이름이 '서울'인 지점을 고르고, 지역 코드는 두 가지를 차례로 시도 */
async function seoulTheaters(day) {
  for (const area of ['11', '10']) {
    const list = (await post({ playDe: compact(day), areaCd1: area })).areaBrchList || [];
    const named = list.filter((b) => String(b.areaCdNm || '').includes('서울'));
    const picked = named.length ? named
      : list.some((b) => b.areaCdNm) ? [] : list.filter((b) => String(b.areaCd) === area);
    const theaters = picked.filter((b) => b.brchNo && b.brchNm).map((b) => ({ code: b.brchNo, name: decode(b.brchNm) }));
    if (theaters.length) return { area, theaters };
  }
  return { area: null, theaters: [] };
}

async function direct({ dates, config }) {
  const { area, theaters } = await seoulTheaters(dates[0]);
  if (!theaters.length) throw new Error('서울 지점 목록이 비어 있음');

  const jobs = theaters.flatMap((t) => dates.map((d) => ({ t, d })));
  const results = await mapPool(jobs, config.concurrency, config.delayMs, async ({ t, d }) => {
    const body = await post({ playDe: compact(d), brchNo1: t.code, areaCd1: area });
    const titles = (body.movieFormList || []).map((m) => decode(m.movieNm));
    return [...new Set(titles.filter(Boolean))].map((title) =>
      ({ chain: 'megabox', theater: t.name, title, playDate: d }));
  });
  return summarize(results, theaters.length);
}

async function viaRelay({ dates, config }) {
  const first = await relayGet(config, '/api/megabox/movies', { playDate: compact(dates[0]), areaCode: '11' });
  const theaters = (first.theaters || [])
    .filter((t) => t.theaterId && t.theaterName)
    .map((t) => ({ code: t.theaterId, name: decode(t.theaterName) }));
  if (!theaters.length) throw new Error('중계: 서울 지점 목록이 비어 있음');

  const jobs = theaters.flatMap((t) => dates.map((d) => ({ t, d })));
  const results = await mapPool(jobs, config.relayConcurrency, config.relayDelayMs, async ({ t, d }) => {
    const r = await relayGet(config, '/api/megabox/movies', { playDate: compact(d), theaterId: t.code, areaCode: '11' });
    const titles = (r.showtimes || []).map((x) => decode(x.movieName));
    return [...new Set(titles.filter(Boolean))].map((title) =>
      ({ chain: 'megabox', theater: t.name, title, playDate: d }));
  });
  return summarize(results, theaters.length);
}

export const collect = (ctx) => directThenRelay(ctx, direct, viaRelay);
