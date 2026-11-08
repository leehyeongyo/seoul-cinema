// 메가박스: 공식 웹사이트 예매 화면이 쓰는 조회 경로 (비공식)
import { UA, compact, fetchJson, mapPool, summarize } from '../lib/util.mjs';

export const id = 'megabox';
const URL_BOOKING = 'https://www.megabox.co.kr/on/oh/ohb/SimpleBooking/selectBokdList.do';
const SEOUL = '11';

const decode = (s) => String(s || '')
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
  .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>');

async function post(fields) {
  const form = new URLSearchParams({
    sellChnlCd: 'ONLINE', brchNoListCnt: '1', areaCd1: SEOUL, spclbYn1: 'N', theabKindCd1: '', ...fields,
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

export async function collect({ dates, config }) {
  const first = await post({ playDe: compact(dates[0]) });
  const theaters = (first.areaBrchList || [])
    .filter((b) => String(b.areaCd) === SEOUL && b.brchNo && b.brchNm)
    .map((b) => ({ code: b.brchNo, name: decode(b.brchNm) }));
  if (!theaters.length) throw new Error('서울 지점 목록이 비어 있음');

  const jobs = theaters.flatMap((t) => dates.map((d) => ({ t, d })));
  const results = await mapPool(jobs, config.concurrency, config.delayMs, async ({ t, d }) => {
    const body = await post({ playDe: compact(d), brchNo1: t.code });
    const titles = (body.movieFormList || []).map((m) => decode(m.movieNm));
    return [...new Set(titles.filter(Boolean))].map((title) =>
      ({ chain: 'megabox', theater: t.name, title, playDate: d }));
  });
  return summarize(results, theaters.length);
}
