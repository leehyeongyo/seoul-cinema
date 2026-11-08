// 공용 도구: 날짜(한국시간), 요청, 동시 실행 제한
export const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';

export const kstToday = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);

export function addDays(day, n) {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** b - a (일) */
export const diffDays = (a, b) =>
  Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 864e5);

export const compact = (day) => day.replaceAll('-', '');
export const dashed = (s) => {
  const v = String(s || '').replaceAll('-', '').slice(0, 8);
  return /^\d{8}$/.test(v) ? `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}` : null;
};
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function fetchJson(url, init = {}, { timeout = 15000, retries = 1 } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      if (res.status >= 500 && attempt < retries) throw new Error(`HTTP ${res.status}`);
      if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { fatal: true });
      const text = await res.text();
      try {
        return JSON.parse(text);
      } catch {
        throw Object.assign(new Error(`JSON 아님: ${text.slice(0, 80)}`), { fatal: true });
      }
    } catch (error) {
      lastError = error.name === 'AbortError' ? new Error('시간 초과') : error;
      if (error.fatal) break;
      await sleep(1000);
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError;
}

/** items를 limit개씩 병렬로 처리. 하나가 실패해도 멈추지 않고 결과에 기록 */
export async function mapPool(items, limit, delayMs, fn) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      try {
        results[i] = { ok: true, value: await fn(items[i]) };
      } catch (error) {
        results[i] = { ok: false, error: error.message || String(error) };
      }
      if (delayMs) await sleep(delayMs);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/** 극장×날짜 조회 결과를 합치고, 전부 실패했으면 에러로 처리 */
export function summarize(results, theaterCount) {
  const failed = results.filter((r) => !r.ok);
  if (results.length && failed.length === results.length) {
    throw new Error(`모든 조회 실패 (${failed[0].error})`);
  }
  return {
    theaters: theaterCount,
    entries: results.filter((r) => r.ok).flatMap((r) => r.value),
    warning: failed.length ? `${results.length}건 중 ${failed.length}건 실패 (${failed[0].error})` : null,
  };
}
