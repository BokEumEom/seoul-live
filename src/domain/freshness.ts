/**
 * 받아 둔 응답이 얼마나 묵었나.
 *
 * 도시정보는 하루 1,000회 한도 때문에 프록시가 오래 캐시한다(`CITYINFO_CACHE_TTL_SECONDS`,
 * 기본 3시간). 그래서 「4분 후 도착」이나 「잔여 568면」이 실제로는 한참 전
 * 값일 수 있는데, 예전에는 세 절이 전부 **「최대 3시간 전 기준이에요」**라고
 * 뭉뚱그려 말했다 — 방금 받은 값에도 그렇게 적히니 절반은 거짓말이었다.
 */

export interface Freshness {
  /**
   * 응답이 프록시 CDN에 머물러 있던 시간(초). HTTP `Age` 헤더 그대로다.
   *
   * **이게 서울 API 데이터의 나이는 아니다.** 우리가 서울에서 받아온 시점부터의
   * 시간이라, 서울 쪽이 이미 묵혀서 준 몫은 여기 안 들어간다 — 즉 **하한이다.**
   * 그래서 화면 문구도 「측정한 지」가 아니라 「받은 지」로 적는다.
   */
  readonly ageSeconds: number
  /** 우리가 그 응답을 받은 시각(epoch ms). */
  readonly receivedAt: number
}

/**
 * 화면에 적을 경과. **단위를 문자열로 만들지 않는다** — 한국어를 도메인이
 * 지어내면 영어 화면에서 그대로 남는다(`i18n` 절의 규칙). 숫자와 단위만 주고
 * 문장은 화면이 `t()`로 만든다.
 */
export type Elapsed =
  | { readonly unit: 'unknown' }
  | { readonly unit: 'now' }
  | { readonly unit: 'minutes'; readonly value: number }
  | { readonly unit: 'hours'; readonly value: number }

const MINUTE = 60
const HOUR = 60 * MINUTE

/**
 * `freshness`가 `null`이면 `unknown`이다. **0으로 떨어뜨리지 마라.**
 *
 * `Age`가 안 보이는 상황이 실재한다 — 프록시에 `Access-Control-Expose-Headers`가
 * 아직 안 배포됐거나, CDN을 안 거친 응답이거나. 그때 「방금」이라 적으면 최대
 * 3시간 묵은 값이 갓 받은 값으로 둔갑해 **고치기 전보다 나빠진다.** 모르면
 * 화면이 예전 문구(「최대 3시간 전 기준」)로 돌아가는 것이 맞다.
 */
export function elapsed(freshness: Freshness | null, nowMs: number): Elapsed {
  if (freshness === null) return { unit: 'unknown' }

  // 기기 시계가 뒤로 가거나 CDN 시각과 어긋나면 음수가 나온다. 「-3분 전」을
  // 적느니 방금으로 접는다.
  const sinceReceived = Math.max(0, (nowMs - freshness.receivedAt) / 1_000)
  const total = Math.max(0, freshness.ageSeconds) + sinceReceived

  if (total >= HOUR) return { unit: 'hours', value: Math.floor(total / HOUR) }
  if (total >= MINUTE) return { unit: 'minutes', value: Math.floor(total / MINUTE) }
  // 초 단위까지 적으면 숫자가 계속 흔들리는데 이 절의 값은 그만큼 자주 안 바뀐다.
  return { unit: 'now' }
}
