// 수집한 상영 목록 + KOBIS 정보 + 어제까지의 기록 → 오늘의 개봉 달력
import { normalizeTitle } from './normalize.mjs';
import { addDays, diffDays } from './util.mjs';

export const CHAINS = ['cgv', 'lotte', 'megabox', 'indie'];
const emptyTheaters = () => Object.fromEntries(CHAINS.map((c) => [c, []]));

/** 같은 영화(정규화 제목 기준)끼리 묶기 */
export function buildGroups(entries, config) {
  const groups = new Map();
  for (const e of entries) {
    if (config.excludeKeywords.some((w) => e.title.includes(w))) continue;
    const n = normalizeTitle(e.title);
    if (!n.key) continue;
    let g = groups.get(n.key);
    if (!g) {
      g = { key: n.key, displays: new Map(), reFlag: false, earliest: e.playDate,
        theaters: Object.fromEntries(CHAINS.map((c) => [c, new Set()])) };
      groups.set(n.key, g);
    }
    g.displays.set(n.display, (g.displays.get(n.display) || 0) + 1);
    if (n.reFlag) g.reFlag = true;
    if (e.playDate < g.earliest) g.earliest = e.playDate;
    g.theaters[e.chain].add(e.theater || '지점 미확인');
  }
  return groups;
}

const pickDisplay = (displays) =>
  [...displays.entries()].sort((a, b) => b[1] - a[1] || a[0].length - b[0].length)[0][0];

const yearOf = (day) => +day.slice(0, 4);
const isOldProduction = (k) => k?.openDt && k.prdtYear && k.prdtYear <= yearOf(k.openDt) - 4;

/** 후보 중 상영 시작일과 개봉일이 가장 가까운 KOBIS 항목 */
function closest(cands, day) {
  const dated = cands.filter((c) => c.openDt);
  if (!dated.length) return cands[0] || null;
  return dated.sort((a, b) => Math.abs(diffDays(a.openDt, day)) - Math.abs(diffDays(b.openDt, day)))[0];
}

const kobisInfo = (k) => k && {
  movieCd: k.movieCd, title: k.title, titleEn: k.titleEn, openDt: k.openDt,
  prdtYear: k.prdtYear, nation: k.nation, genre: k.genre, director: k.director,
};

/** 새로 걸린 영화가 개봉인지 재개봉인지, 날짜는 언제인지 */
function classify(g, cands, hint, previous, bootstrap, today) {
  const k = closest(cands, g.earliest);
  const older = cands
    .filter((c) => c.openDt && diffDays(c.openDt, g.earliest) > 365)
    .sort((a, b) => a.openDt.localeCompare(b.openDt))[0];
  const r = { kind: 'new', date: g.earliest, dateSource: 'schedule', originalYear: null, k };

  if (previous) {
    // 한동안 내려갔다가 다시 걸림
    Object.assign(r, { kind: 're', originalYear: yearOf(previous.date) });
  } else if (isOldProduction(k) && diffDays(k.openDt, g.earliest) <= 30) {
    // KOBIS에 재개봉으로 새로 등록된 옛날 영화
    Object.assign(r, { kind: 're', date: k.openDt, dateSource: 'kobis', originalYear: k.prdtYear });
  } else if (k?.openDt && diffDays(k.openDt, g.earliest) <= 180 && diffDays(k.openDt, g.earliest) >= -30 && !older) {
    Object.assign(r, { kind: g.reFlag ? 're' : 'new', date: k.openDt, dateSource: 'kobis' });
  } else if (g.reFlag || older || (k?.prdtYear && k.prdtYear <= yearOf(g.earliest) - 4)) {
    Object.assign(r, {
      kind: 're',
      originalYear: older ? older.prdtYear || yearOf(older.openDt) : k?.prdtYear || null,
      k: older || k,
    });
  } else if (hint && Math.abs(diffDays(hint, g.earliest)) <= 14) {
    Object.assign(r, { date: hint, dateSource: 'theater' });
  }
  // 달력을 처음 켠 날 이미 상영 중이던 영화는 날짜가 정확하지 않을 수 있음
  r.approx = bootstrap && r.dateSource !== 'kobis' && r.date <= today;
  return r;
}

export function merge({ prev, groups, kobisBulk, kobisLookups, releaseHints, sourcesOk, kobisOk,
  today, config, bootstrap }) {
  const films = prev.map((f) => ({ ...f, theaters: { ...emptyTheaters(), ...f.theaters } }));
  const latestByKey = new Map();
  for (const f of films) {
    const cur = latestByKey.get(f.key);
    if (!cur || cur.date < f.date) latestByKey.set(f.key, f);
  }
  const bulkByKey = new Map();
  for (const k of kobisBulk) {
    const key = normalizeTitle(k.title).key;
    bulkByKey.set(key, [...(bulkByKey.get(key) || []), k]);
  }
  const seen = new Set();

  for (const g of groups.values()) {
    const theaters = Object.fromEntries(CHAINS.map((c) =>
      [c, [...g.theaters[c]].sort((a, b) => a.localeCompare(b, 'ko'))]));
    const rec = latestByKey.get(g.key);
    const continuing = rec && (rec.scheduledOnly || (rec.lastSeen && diffDays(rec.lastSeen, today) <= config.reappearGapDays));

    if (continuing) {
      for (const c of CHAINS) rec.theaters[c] = sourcesOk[c] ? theaters[c] : rec.theaters[c];
      if (rec.scheduledOnly) {
        rec.scheduledOnly = false;
        rec.firstSeen = today;
      }
      rec.playing = true;
      rec.lastSeen = today;
      if (!rec.kobis) {
        const k = closest([...(bulkByKey.get(g.key) || []), ...(kobisLookups.get(g.key) || [])], g.earliest);
        if (k) rec.kobis = kobisInfo(k);
      }
      if (g.reFlag && rec.kind === 'new' && rec.dateSource !== 'kobis') rec.kind = 're';
      seen.add(rec.id);
      continue;
    }

    const cands = [...(bulkByKey.get(g.key) || []), ...(kobisLookups.get(g.key) || [])];
    const c = classify(g, cands, releaseHints.get(g.key), rec, bootstrap, today);
    let id = `${g.key}@${c.date}`;
    while (films.some((f) => f.id === id)) id += '+';
    const film = {
      id, key: g.key, title: pickDisplay(g.displays), kind: c.kind, date: c.date,
      dateSource: c.dateSource, approx: c.approx, originalYear: c.originalYear,
      kobis: kobisInfo(c.k), theaters, playing: true, scheduledOnly: false,
      firstSeen: today, lastSeen: today,
    };
    films.push(film);
    latestByKey.set(g.key, film);
    seen.add(id);
  }

  // 이번에 안 보인 영화: 해당 체인 조회가 성공했을 때만 '상영 끝'으로 판단
  for (const f of films) {
    if (seen.has(f.id) || !f.playing) continue;
    const chainsOfFilm = CHAINS.filter((c) => f.theaters[c]?.length);
    if (chainsOfFilm.every((c) => sourcesOk[c])) f.playing = false;
  }

  // KOBIS 개봉 예정작 (아직 상영관 미정)
  const horizon = addDays(today, config.upcomingDays);
  const bulkCds = new Set(kobisBulk.map((k) => k.movieCd));
  for (const k of kobisBulk) {
    if (!k.openDt || k.openDt < today || k.openDt > horizon) continue;
    if (!config.kobisTypes.includes(k.type)) continue;
    if (config.excludeGenres.some((x) => k.genres.includes(x))) continue;
    const key = normalizeTitle(k.title).key;
    const existing = latestByKey.get(key);
    if (existing) {
      if (existing.scheduledOnly && existing.kobis?.movieCd === k.movieCd) existing.date = k.openDt;
      continue;
    }
    const old = isOldProduction(k);
    const film = {
      id: `${key}@kobis-${k.movieCd}`, key, title: k.title, kind: old ? 're' : 'new', date: k.openDt,
      dateSource: 'kobis', approx: false, originalYear: old ? k.prdtYear : null, kobis: kobisInfo(k),
      theaters: emptyTheaters(), playing: false, scheduledOnly: true, firstSeen: today, lastSeen: null,
    };
    films.push(film);
    latestByKey.set(key, film);
  }

  const keepFrom = addDays(today, -config.keepDaysAfterRelease);
  return films
    .filter((f) => {
      if (f.scheduledOnly) {
        if (f.date < addDays(today, -3)) return false;
        if (kobisOk && f.kobis && !bulkCds.has(f.kobis.movieCd)) return false;
      }
      return f.playing || f.date >= keepFrom;
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title, 'ko'));
}
