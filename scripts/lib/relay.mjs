// 해외 서버(GitHub)에서 막히는 극장은 공개 중계 API(daiso-mcp, MIT 오픈소스)를 거쳐 조회
import { fetchJson } from './util.mjs';

export async function relayGet(config, path, params) {
  const url = `${config.relayBase}${path}?${new URLSearchParams(params)}`;
  const json = await fetchJson(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'seoul-cinema-calendar/1.0 (personal daily calendar)' },
  }, { timeout: 30000 });
  if (!json.success) throw new Error(`중계 오류 ${json.error?.message || json.error?.code || ''}`.trim());
  return json.data || {};
}

/** 직접 조회를 먼저 해보고, 실패하면 중계로 다시 조회 */
export async function directThenRelay(ctx, direct, viaRelay) {
  try {
    return { ...(await direct(ctx)), route: 'direct' };
  } catch (error) {
    console.log(`  ↳ 직접 조회 실패(${error.message}) → 중계 경로로 다시 시도`);
    return { ...(await viaRelay(ctx)), route: 'relay', directError: error.message };
  }
}
