// 영화진흥위원회 KOBIS 오픈API (공식) - 개봉일·감독·국가·장르
import { dashed, fetchJson, sleep } from '../lib/util.mjs';

const PATH = '/kobisopenapi/webservice/rest/movie/searchMovieList.json';

async function search(key, params) {
  const query = new URLSearchParams({ key, itemPerPage: '100', ...params });
  let json;
  try {
    json = await fetchJson(`https://www.kobis.or.kr${PATH}?${query}`);
  } catch {
    json = await fetchJson(`http://www.kobis.or.kr${PATH}?${query}`);
  }
  if (json.faultInfo) throw new Error(`KOBIS 오류: ${json.faultInfo.message}`);
  const r = json.movieListResult || {};
  return { total: +r.totCnt || 0, list: (r.movieList || []).map(slim) };
}

export function slim(m) {
  return {
    movieCd: m.movieCd,
    title: m.movieNm,
    titleEn: m.movieNmEn || '',
    openDt: dashed(m.openDt),
    prdtYear: +m.prdtYear || null,
    type: m.typeNm || '',
    nation: m.repNationNm || String(m.nationAlt || '').split(',')[0] || '',
    genre: m.repGenreNm || String(m.genreAlt || '').split(',')[0] || '',
    genres: m.genreAlt || '',
    director: (m.directors || []).map((d) => d.peopleNm).filter(Boolean).join(', '),
  };
}

/** 해당 연도(들)에 개봉일이 잡힌 영화 전체 */
export async function bulk(key, years, delayMs = 250) {
  const all = [];
  for (const year of years) {
    const first = await search(key, { openStartDt: year, openEndDt: year, curPage: '1' });
    all.push(...first.list);
    const pages = Math.min(Math.ceil(first.total / 100), 80);
    for (let p = 2; p <= pages; p++) {
      await sleep(delayMs);
      all.push(...(await search(key, { openStartDt: year, openEndDt: year, curPage: String(p) })).list);
    }
  }
  return all;
}

/** 제목으로 전 기간 검색 (재개봉 원작 연도 확인용) */
export async function byTitle(key, title) {
  return (await search(key, { movieNm: title })).list;
}
