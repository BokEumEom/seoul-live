import { t } from '../../i18n/t'
import { elapsed, type Freshness } from '../../domain/freshness'

/**
 * 「이 값이 언제 기준인가」 한 줄.
 *
 * **모를 때만 예전 문구로 돌아간다.** 「최대 3시간 전」은 프록시 캐시 TTL에서
 * 온 상한이라, 방금 받은 값에 붙으면 절반이 거짓말이다 — 그걸 고치려고 이
 * 함수가 있다. 하지만 `Age`를 못 읽는 상황이 실재하고(프록시가 CORS로 아직
 * 안 열어 줬거나 CDN을 안 거친 응답), 그때 「방금」이라 적으면 **거짓말의
 * 방향이 정반대로 커진다.** 모르면 모른다고 하는 쪽이 언제나 안전하다.
 *
 * **여러 절이 같은 문구를 쓴다.** 예전에는 「잔여 면수는」·「거치 대수는」처럼
 * 주어를 붙였는데, 시각이 뭉뚱그려져 있어 무엇에 걸리는 말인지 밝힐 필요가
 * 있었기 때문이다. 시각이 정확해진 지금은 바로 위 제목이 그 일을 한다.
 *
 * `Date.now()`를 렌더 중에 읽으므로 이 줄은 **다시 그릴 때만** 갱신된다.
 * 1초마다 살아 움직일 값이 아니라(분 단위로 내림한다) 타이머를 두지 않았다.
 *
 * 컴포넌트 파일이 아니라 여기 있는 이유는 `toneClass.ts`와 같다 — 컴포넌트를
 * export하는 파일이 함수까지 함께 export하면 빠른 새로고침이 깨진다. 상세가
 * 탭으로 갈리면서 이 함수를 쓰는 패널이 셋이 됐다.
 */
export function freshnessNote(
  freshness: Freshness | null,
  fallback: string,
): string {
  const since = elapsed(freshness, Date.now())
  switch (since.unit) {
    case 'unknown':
      return fallback
    case 'now':
      return t('방금 받은 값이에요')
    case 'minutes':
      return t('{분}분 전 값이에요', { 분: since.value })
    case 'hours':
      return t('{시간}시간 전 값이에요', { 시간: since.value })
  }
}
