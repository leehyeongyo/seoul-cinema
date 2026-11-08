// 샘플 모드(--mock)용 가상 데이터. 영화 제목은 모두 지어낸 것.
import { addDays } from '../lib/util.mjs';

const T = {
  cgv: ['용산아이파크몰', '강남', '왕십리', '신촌아트레온', '압구정', '영등포', '대학로', '목동', '상봉', '천호'],
  lotte: ['월드타워', '건대입구', '홍대입구', '은평(롯데몰)', '김포공항', '노원', '신림'],
  megabox: ['코엑스', '성수', '홍대', '신촌', '상암월드컵경기장', '목동', '동대문'],
  indie: ['아트하우스모모', '에무시네마', '라이카시네마', '더숲아트시네마', '허리우드클래식'],
};
const pick = (chain, n) => T[chain].slice(0, n);

// from: 상영 시작(오늘 기준 일수), names: 체인별 표기 차이, n: 체인별 극장 수
const FILMS = [
  { from: -12, names: { cgv: '레드 팜플릿', lotte: '레드 팜플릿', megabox: '레드 팜플릿(자막)' }, n: { cgv: 9, lotte: 6, megabox: 5 } },
  { from: -5, names: { cgv: '[IMAX] 스타필드: 두 번째 궤도', lotte: '스타필드 : 두 번째 궤도(자막)', megabox: '스타필드: 두 번째 궤도 4DX' }, n: { cgv: 10, lotte: 7, megabox: 7 } },
  { from: -20, until: 1, names: { cgv: '가을 산책', megabox: '가을 산책' }, n: { cgv: 3, megabox: 2 } },
  { from: -26, names: { indie: '물결의 기록' }, n: { indie: 2 } },
  { from: 3, names: { cgv: '겨울 정류장', lotte: '겨울 정류장', megabox: '겨울 정류장' }, n: { cgv: 8, lotte: 5, megabox: 6 } },
  { from: 3, names: { cgv: '작은 섬의 편지', indie: '작은 섬의 편지' }, n: { cgv: 1, indie: 3 } },
  { from: 3, names: { lotte: '[재개봉] 녹색 우산', indie: '녹색 우산' }, n: { lotte: 2, indie: 2 } },
  { from: 4, names: { indie: '[재개봉] 낮은 지붕들' }, n: { indie: 1 } },
  { from: 2, names: { cgv: '[생중계] 2026 가을 야구 결승' }, n: { cgv: 4 } },
  { from: 7, runFrom: '+1', names: { megabox: '푸른 밤의 소녀', indie: '푸른 밤의 소녀' }, n: { megabox: 2, indie: 3 } },
];

const KOBIS = (today) => [
  { movieCd: '20261001', title: '레드 팜플릿', openDt: addDays(today, -12), prdtYear: 2026, type: '장편', nation: '미국', genre: '스릴러', genres: '스릴러', director: '에밀리 하트' },
  { movieCd: '20261002', title: '스타필드: 두 번째 궤도', openDt: addDays(today, -5), prdtYear: 2026, type: '장편', nation: '미국', genre: 'SF', genres: 'SF,액션', director: '마커스 리' },
  { movieCd: '20261003', title: '겨울 정류장', openDt: addDays(today, 3), prdtYear: 2026, type: '장편', nation: '한국', genre: '드라마', genres: '드라마', director: '한지원' },
  { movieCd: '20261004', title: '작은 섬의 편지', openDt: addDays(today, 3), prdtYear: 2025, type: '장편', nation: '한국', genre: '다큐멘터리', genres: '다큐멘터리', director: '오세린' },
  { movieCd: '20261005', title: '푸른 밤의 소녀', openDt: addDays(today, 10), prdtYear: 2025, type: '장편', nation: '프랑스', genre: '드라마', genres: '드라마', director: '클레르 모로' },
  { movieCd: '20261006', title: '밤의 항구', openDt: addDays(today, 10), prdtYear: 1991, type: '장편', nation: '홍콩', genre: '멜로/로맨스', genres: '멜로/로맨스', director: '진가위' },
  { movieCd: '20261007', title: '늦은 편지', openDt: addDays(today, 17), prdtYear: 2026, type: '장편', nation: '한국', genre: '멜로/로맨스', genres: '멜로/로맨스', director: '서도윤' },
  { movieCd: '20261008', title: '은밀한 수업', openDt: addDays(today, 8), prdtYear: 2026, type: '장편', nation: '일본', genre: '성인물(에로)', genres: '성인물(에로)', director: '-' },
  { movieCd: '20261009', title: '단편 모음 A', openDt: addDays(today, 8), prdtYear: 2026, type: '단편', nation: '한국', genre: '드라마', genres: '드라마', director: '-' },
  { movieCd: '20251010', title: '물결의 기록', openDt: addDays(today, -26), prdtYear: 2025, type: '장편', nation: '한국', genre: '다큐멘터리', genres: '다큐멘터리', director: '윤하람' },
];

const ARCHIVE = {
  녹색우산: [{ movieCd: '19980001', title: '녹색 우산', openDt: '1998-07-04', prdtYear: 1998, type: '장편', nation: '한국', genre: '멜로/로맨스', genres: '멜로/로맨스', director: '이경수' }],
  낮은지붕들: [{ movieCd: '19870002', title: '낮은 지붕들', openDt: '1987-03-14', prdtYear: 1987, type: '장편', nation: '한국', genre: '드라마', genres: '드라마', director: '박상호' }],
};

let startDay = null;
export function collect(sourceId, dates, today) {
  startDay ??= process.env.MOCK_START || today;
  if (process.env.MOCK_FAIL === sourceId) throw new Error('샘플 실패 테스트');
  const chain = sourceId === 'dtryx' ? 'indie' : sourceId;
  const entries = [];
  for (const f of FILMS) {
    const name = f.names[chain];
    if (!name) continue;
    if (f.runFrom && today < addDays(startDay, 1)) continue;
    for (const d of dates) {
      if (d < addDays(startDay, f.from)) continue;
      if (f.until !== undefined && d > addDays(startDay, f.until)) continue;
      for (const theater of pick(chain, f.n[chain])) entries.push({ chain, theater, title: name, playDate: d });
    }
  }
  const hints = chain === 'lotte' ? [{ title: '겨울 정류장', date: addDays(startDay, 3) }] : [];
  return { theaters: T[chain].length, entries, warning: null, releaseHints: hints };
}

export const kobisBulk = (today) => KOBIS(process.env.MOCK_START || today);
export const kobisByTitle = (key) => ARCHIVE[key] || [];
