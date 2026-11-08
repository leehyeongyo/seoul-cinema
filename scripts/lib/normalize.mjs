// 체인마다 다른 영화 제목을 같은 영화로 묶기 위한 정규화
const FORMAT_WORDS = [
  'IMAX', '4DX', 'SCREENX', 'SCREEN X', 'SUPERPLEX', 'SUPER PLEX', 'MX4D', 'DOLBY CINEMA',
  'DOLBY ATMOS', 'DOLBY', 'ATMOS', 'LASER', '2D', '3D', '4D', 'HFR', 'ULTRA 4DX',
  '자막', '더빙', '한글자막', '우리말더빙', '수퍼플렉스', '슈퍼플렉스', '돌비시네마', '돌비',
];
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const FORMAT_RE = new RegExp(`(^|\\s)(${FORMAT_WORDS.map(esc).join('|')})(?=\\s|$)`, 'gi');

export function normalizeTitle(raw) {
  let s = String(raw || '').normalize('NFC').trim();
  const reFlag = /재개봉|re-?release/i.test(s);
  s = s.replace(/[[【<(（][^\]】>)）]*[\]】>)）]/g, ' ');
  for (let i = 0; i < 2; i++) s = s.replace(FORMAT_RE, ' ');
  s = s.replace(/\s+/g, ' ').replace(/^[\s\-:·]+|[\s\-:·]+$/g, '').trim();
  const key = s.toLowerCase().replace(/[\s:：·・,.'"‘’“”!?~\-–—_/&]/g, '');
  return { display: s, key, reFlag };
}
