import type { CctvCamera } from '../domain/cctv'
import type { AreaPopulation } from '../domain/populationTrend'
import { EMPTY_POPULATION_FLOW } from '../domain/populationFlow'
import type { Freshness } from '../domain/freshness'
import type { AreaCongestion } from '../domain/types'
import { AREA_NAMES } from './areas'
import { parseCctvResponse } from './cctvSchema'
import { parsePopulationTrend } from './ppltnSchema'
import { parsePopulationFlow } from './ppltnCongestSchema'
import { parseHotspotsResponse } from './hotspotsSchema'
import { buildMockPopulationRows } from './mock'
import { buildMockCctv } from './mockCctv'
import { buildMockAreaPopulation } from './mockPopulationTrend'
import { buildMockCityInfo } from './mockCityInfo'
import { parseCitydataResponse } from './schema'

// 단일 명소 타임아웃. 이 상수를 쓰는 셋(fetchAreaPayload→/api/cityinfo,
// fetchCctv→/api/cctv, fetchAreaPopulation→/api/ppltn) 모두 상류 호출 자체를
// 8초에서 끊는다 — api/_lib/seoul.ts의 FETCH_TIMEOUT_MS와 api/_lib/seoulRtd.ts의
// 같은 이름·같은 값 상수다. 프록시가 502로 정리해서 응답할 여유를 두고 그보다
// 넉넉하게 잡는다.
//
// **예전에는 api/citydata.ts(→citydata_ppltn)를 가리켰다.** Task 4에서
// fetchAreaPayload가 그 경로를 그만 부르면서 절반은 맞고 절반은 허구인 주석이
// 될 뻔했다 — 게다가 그 파일 자체가 이제 없다(Task 6, `53803aa`).
const SINGLE_AREA_TIMEOUT_MS = 10_000

// 전체 혼잡도(/api/hotspots) 타임아웃. maxDuration(15초)은 Vercel 함수의 "실행
// 시간"이고 이 값은 클라이언트 쪽 "벽시계" 시간이라 콜드 스타트(200ms~1s+), TLS
// 핸드셰이크+RTT, 504 전파 시간까지 더해진다 — maxDuration보다 1초만 여유를 두면
// 콜드 스타트에서 먼저 진다. 게다가 api/hotspots.ts(→fetchHotspotRows)는 상류를
// **두 번 순차로** 부른다(세션 부트스트랩 + 목록, 각각 최대 8초·`seoulRtd.ts`의
// FETCH_TIMEOUT_MS) — 최악의 경우 그것만으로 16초라 maxDuration에 이미 근접한다.
// maxDuration보다 5초 이상 여유를 두어, 함수가 끝까지 실행되거나 플랫폼이
// 자체적으로 타임아웃 응답을 만들 시간을 먼저 준다 — 그래야 사용자가 실제로는
// 플랫폼 타임아웃인데 "네트워크 상태를 확인해주세요" 같은 오해를 부르는 메시지를
// 보지 않는다.
//
// **`BULK_TIMEOUT_MS`였다.** 그 이름이 맞던 시절에는 api/citydata-bulk.ts(동시
// 연결 8개로 제한된 명소별 호출)의 타임아웃도 겸했는데, 그 프록시와 그걸 부르던
// fetchAreaSnapshots를 2026-08-27에 지웠다(Task 7, 죽은 일괄 조회 경로).
// 남은 호출은 fetchAreaCongestion 하나이고 그건 **한 번에 다 받아 오는 단일
// 요청**이라, 「bulk」는 없는 구조를 가리키는 이름이 됐다 — 선언만 훑는 사람이
// 옛 아키텍처를 짐작하게 된다. 엔드포인트 이름을 그대로 쓴다.
const HOTSPOTS_TIMEOUT_MS = 20_000

// 이름을 `useMock`으로 지으면 ESLint의 react-hooks/rules-of-hooks가 "use"로 시작하는
// 이름을 React 훅으로 오인해 오류를 낸다. 이 함수는 훅이 아니라 순수 판별 함수라 이름을
// 바꾼다.
function isMockMode(): boolean {
  return import.meta.env.VITE_USE_MOCK === 'true'
}

function baseUrl(): string {
  return import.meta.env.VITE_API_BASE_URL ?? ''
}

// M2 — 실데이터 경로는 명소 하나가 실패하면 그 자리를 null로 돌려주지만(위의
// 개별 try/catch), 목업 경로는 buildMockPopulationRows가 항상 성공하는 값만 만들어서
// null이 나올 수가 없었다. 그러면 "정보 없음" 카드 상태를 목업만으로 개발하거나
// 테스트할 방법이 없다. VITE_MOCK_FAIL_AREAS에 쉼표로 구분한 명소 이름을 넣으면
// 목업 모드에서도 그 명소만 실패를 흉내 낸다.
function mockFailureAreaNames(): ReadonlySet<string> {
  const raw: string = import.meta.env.VITE_MOCK_FAIL_AREAS ?? ''
  return new Set(
    raw
      .split(',')
      .map((name: string) => name.trim())
      .filter(Boolean),
  )
}

// HTTP 실패(response.ok === false)를 표시하는 전용 에러. requestJson의 catch 블록에서
// "이미 사용자용 메시지로 바뀐 에러"와 "아직 안 바뀐 원본 네트워크 에러"를 구분하는 데 쓴다.
// 메시지 문자열 접두어 비교보다 안전하다 — 문구가 나중에 바뀌어도 분기가 깨지지 않는다.
// status를 들고 있는 이유: queries.ts의 재시도 정책이 4xx(요청 자체의 문제 — 예를 들어
// 허용 목록에 없는 명소, 400)와 5xx(상류 일시 장애 — 재시도할 가치가 있다)를
// 구분해야 한다. status 없이는 둘 다 똑같이 재시도됐다.
export class ProxyResponseError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ProxyResponseError'
    this.status = status
  }
}

// `subject`는 사용자에게 보이는 문구에 들어간다. 「더보기」가 붙으면서 같은 함수가
// 혼잡도와 도시정보 두 가지를 나르게 됐는데, 문구를 하나로 고정해두면 날씨를
// 못 받아온 화면이 "혼잡도 정보를 가져오지 못했어요"라고 말한다.
/**
 * 프록시 응답이 CDN에 머물러 있던 시간(초). 모르면 `null`이다.
 *
 * **`Number()`를 맨몸으로 쓰지 않는다.** `Number('')`는 0이고 `Number('1e1')`은
 * 10이다 — 「없는 값」이 아니라 **그럴듯한 틀린 값**이 화면에 뜬다(AGENTS.md의
 * 관대한 파서 규칙과 같은 이유).
 *
 * **없을 때 0으로 떨어뜨리면 안 된다.** `Age`는 CORS 안전목록 헤더가 아니라
 * 프록시가 `Access-Control-Expose-Headers`로 열어 줘야 보이는데, 그게 아직 안
 * 배포됐거나 CDN을 안 거친 응답이면 없다. 그때 0으로 두면 최대 1시간 묵은 값이
 * 「방금」으로 둔갑해 **고치기 전보다 나빠진다.**
 */
function readAgeSeconds(headers: Headers): number | null {
  const raw = headers.get('Age')
  if (raw === null || !/^\d+$/.test(raw.trim())) return null
  return Number(raw.trim())
}

interface JsonResponse {
  readonly body: unknown
  /** 이 응답이 얼마나 묵었나. 모르면 `null` — `domain/freshness.ts` 참고. */
  readonly ageSeconds: number | null
}

async function requestJson(
  url: string,
  timeoutMs: number,
  subject = '혼잡도 정보',
): Promise<JsonResponse> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, { signal: controller.signal })
    if (!response.ok) {
      const proxyError = new ProxyResponseError(
        `${subject}를 가져오지 못했어요. 잠시 후 다시 시도해주세요.`,
        response.status,
      )
      // ProxyResponseError를 여기서 바로 로그로 남긴다. 예전에는 이 분기 없이 곧장
      // 던지기만 해서(아래 catch는 ProxyResponseError를 그대로 재던질 뿐이다),
      // HTTP 실패(상태 코드, 요청 URL)가 콘솔 어디에도 남지 않았다 — 네트워크 실패만
      // 로그가 있고 HTTP 실패는 진단할 방법이 없었다. status와 url을 남기면 이후
      // 502(상류 실패)와 400(잘못된 요청)을 로그만 보고 구분할 수 있다.
      console.error(`${subject} 요청 실패 (status=${response.status}):`, url)
      throw proxyError
    }
    return { body: await response.json(), ageSeconds: readAgeSeconds(response.headers) }
  } catch (error) {
    if (error instanceof ProxyResponseError) {
      throw error
    }
    // 여기로 오는 건 타임아웃에 의한 AbortError, 오프라인·DNS 실패에 의한 TypeError,
    // 응답 본문이 JSON이 아니어서 response.json()이 던지는 SyntaxError 등이다 —
    // "네트워크 상태를 확인해주세요"라고 못박으면 마지막 경우(응답은 왔는데 본문이
    // 깨진 경우)엔 오해를 준다. 원인을 특정할 수 없는 만큼 메시지도 원인을 단정하지
    // 않는 일반적인 문구로 둔다. 원본 메시지를 그대로 사용자에게 보여주면 안 되지만
    // — 진단이 안 되면 원인을 구분할 수 없으므로 콘솔에는 남기고, cause로도 원본을
    // 붙여 상위에서 필요하면 꺼내 쓸 수 있게 한다.
    console.error(`${subject} 요청 실패:`, error)
    throw new Error(`${subject}를 가져오지 못했어요. 잠시 후 다시 시도해주세요.`, {
      cause: error,
    })
  } finally {
    clearTimeout(timer)
  }
}

/** 상세 한 곳의 원본 `citydata` 응답과 그 나이. */
export interface AreaPayload {
  readonly body: unknown
  readonly freshness: Freshness | null
}

/**
 * 상세 한 곳의 **모든 것**. 혼잡도와 도시정보가 한 응답에서 나온다.
 *
 * **예전에는 둘을 따로 불렀다**(`/api/citydata` + `/api/cityinfo`). 그런데
 * `citydata` 응답의 `CITYDATA.LIVE_PPLTN_STTS`가 `citydata_ppltn`이 주는 행을
 * 통째로 포함한다 — 2026-08-27에 명소 3곳에서 같은 순간을 재어 6필드와 예보
 * 12칸이 전부 일치하는 것을 확인했다. **앞의 24회/일/명소는 낭비였다.**
 *
 * 파싱은 여기서 안 한다. 두 훅(`useAreaSnapshot`·`useCityInfo`)이 같은 캐시
 * 항목을 나눠 쓰면서 각자 `select`로 뽑기 때문이다 — 여기서 미리 파싱하면
 * 캐시에 파생값이 앉아 한쪽 파서의 실패가 다른 쪽까지 끌고 내려간다.
 *
 * **`receivedAt`을 여기서 찍는다.** `select`는 렌더마다 다시 도는 자리라
 * 거기서 `Date.now()`를 부르면 「받은 시각」이 계속 지금으로 갱신된다.
 */
export async function fetchAreaPayload(areaName: string): Promise<AreaPayload> {
  if (isMockMode()) {
    if (mockFailureAreaNames().has(areaName)) {
      throw new Error(
        `[목업] ${areaName} 조회 실패를 시뮬레이션합니다. (VITE_MOCK_FAIL_AREAS)`,
      )
    }
    // 방금 만든 값이다. 목업에는 CDN도 서울 API도 없으므로 나이가 0이고,
    // 그건 「모른다」가 아니라 실제로 아는 사실이다.
    return {
      body: buildMockCityInfo(areaName),
      freshness: { ageSeconds: 0, receivedAt: Date.now() },
    }
  }

  const url = `${baseUrl()}/api/cityinfo?area=${encodeURIComponent(areaName)}`
  const { body, ageSeconds } = await requestJson(url, SINGLE_AREA_TIMEOUT_MS, '도시 정보')
  return {
    body,
    freshness: ageSeconds === null ? null : { ageSeconds, receivedAt: Date.now() },
  }
}

/**
 * 명소 주변 교통 CCTV. **하루 1,000회 한도와 무관하다** — 서울 OpenAPI가 아니라
 * 서울시 실시간 도시데이터 웹의 엔드포인트를 프록시가 중계한다(`api/cctv.ts`).
 *
 * **실패해도 던지지 않고 빈 배열이다.** 상류가 문서화된 API가 아니라 언제든
 * 막힐 수 있는데, 그때 오류를 올리면 상세 화면에 빨간 줄이 떠서 멀쩡한 나머지
 * 정보까지 고장 난 것처럼 보인다. 30곳 중 10곳은 애초에 빈 배열이 정상이라
 * (2026-08-19 실측) 사용자에게는 이미 익숙한 상태다 — 프록시도 같은 판단으로
 * 200 + `[]`를 주지만, 네트워크 자체가 끊긴 경우는 여기서만 걸린다.
 */
export async function fetchCctv(areaName: string): Promise<readonly CctvCamera[]> {
  if (isMockMode()) {
    return buildMockCctv(areaName)
  }

  const url = `${baseUrl()}/api/cctv?area=${encodeURIComponent(areaName)}`
  try {
    const { body } = await requestJson(url, SINGLE_AREA_TIMEOUT_MS, 'CCTV 정보')
    return parseCctvResponse(body)
  } catch (error) {
    // requestJson이 이미 콘솔에 남겼다. 여기서는 화면을 지키는 것만 한다.
    console.error(`[${areaName}] CCTV 조회 실패:`, error)
    return []
  }
}

/**
 * 명소 인구의 **시간 대비와 24시간 흐름**. CCTV와 같은 상류·같은 규칙이다 —
 * **하루 1,000회 한도와 무관**하고(`api/ppltn.ts`), **실패해도 던지지 않는다.**
 *
 * 던지지 않는 이유가 CCTV보다 강하다. 이 값은 인구 탭 안에서 공식 API가 준
 * 인원수·구성비 **옆에** 놓이는데, 여기서 오류를 올리면 멀쩡한 그 값들까지
 * 고장 난 화면으로 끌고 들어간다. 빈 응답은 관대한 리더가 세 칸을 전부
 * `null`로 읽어 그 절만 사라진다.
 */
export async function fetchAreaPopulation(areaName: string): Promise<AreaPopulation> {
  if (isMockMode()) {
    return buildMockAreaPopulation(areaName)
  }

  const url = `${baseUrl()}/api/ppltn?area=${encodeURIComponent(areaName)}`
  try {
    const { body } = await requestJson(url, SINGLE_AREA_TIMEOUT_MS, '인파 변화 정보')
    const envelope = (body ?? {}) as { ppltn?: unknown; congest?: unknown }
    return {
      trend: parsePopulationTrend(envelope.ppltn),
      flow: parsePopulationFlow(envelope.congest),
    }
  } catch (error) {
    // requestJson이 이미 콘솔에 남겼다. 여기서는 화면을 지키는 것만 한다.
    console.error(`[${areaName}] 인파 변화 조회 실패:`, error)
    return { trend: parsePopulationTrend(null), flow: EMPTY_POPULATION_FLOW }
  }
}

/**
 * 명소 **전부**의 지금 혼잡도. 목록과 지도가 쓴다.
 *
 * **예전의 `fetchAreaSnapshots`를 대신한다.** 그쪽은 이름 목록을 받아 명소당
 * 1회씩 공식 API를 불렀는데, 121곳에서는 갱신 한 번에 121회라 하루 한도(1,000)를
 * 세 배로 넘겼다. 이쪽은 인증키 없는 상류라 **한 번에 다 오고 쿼터를 안 쓴다**.
 * `fetchAreaSnapshots`와 그 프록시(api/citydata-bulk.ts)는 2026-08-27에 지웠다
 * (Task 7).
 *
 * **이름을 인자로 안 받는다.** 전체가 오기 때문이기도 하고, 인자가 없어야
 * URL이 하나로 굳어 CDN 캐시를 사용자 전체가 나눠 쓰기 때문이다 — 저쪽이
 * 이름을 정렬·중복제거해서 보내며 애써 만들던 성질을 여기서는 공짜로 얻었다.
 *
 * 카탈로그에 없는 명소가 섞여 와도 그대로 둔다. 거르는 자리는 호출부이고
 * (카탈로그와 이름으로 맞춘다), 여기서 걸러 봐야 같은 일을 두 번 한다.
 */
export async function fetchAreaCongestion(): Promise<readonly AreaCongestion[]> {
  if (isMockMode()) {
    const failing = mockFailureAreaNames()
    return AREA_NAMES.filter((name) => !failing.has(name)).map((name) => ({
      name,
      congestion: parseCitydataResponse(
        { CITYDATA: { LIVE_PPLTN_STTS: buildMockPopulationRows(name) } },
        name,
      ).congestion,
    }))
  }

  const url = `${baseUrl()}/api/hotspots`
  const { body } = await requestJson(url, HOTSPOTS_TIMEOUT_MS, '혼잡도 정보')
  return parseHotspotsResponse(body)
}
