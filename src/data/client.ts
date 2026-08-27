import type { CctvCamera } from '../domain/cctv'
import type { PopulationTrend } from '../domain/populationTrend'
import type { CityInfo } from '../domain/cityInfo'
import type { AreaCongestion, AreaSnapshot } from '../domain/types'
import { AREA_NAMES } from './areas'
import { parseCctvResponse } from './cctvSchema'
import { parsePopulationTrend } from './ppltnSchema'
import { parseCityInfoResponse } from './cityInfoSchema'
import { parseHotspotsResponse } from './hotspotsSchema'
import { buildMockSnapshot } from './mock'
import { buildMockCctv } from './mockCctv'
import { buildMockPopulationTrend } from './mockPopulationTrend'
import { buildMockCityInfo } from './mockCityInfo'
import { parseBulkEnvelope, parseCitydataResponse } from './schema'

// 단일 명소 타임아웃. 프록시(api/citydata.ts)는 서울 API 호출 자체를 8초에서 끊으므로,
// 프록시가 502로 정리해서 응답할 여유를 두고 그보다 넉넉하게 잡는다.
const SINGLE_AREA_TIMEOUT_MS = 10_000

// 일괄 조회 타임아웃. maxDuration(15초)은 Vercel 함수의 "실행 시간"이고 이 값은
// 클라이언트 쪽 "벽시계" 시간이라 콜드 스타트(200ms~1s+), TLS 핸드셰이크+RTT, 504
// 전파 시간까지 더해진다 — maxDuration보다 1초만 여유를 두면 콜드 스타트에서 먼저
// 진다. 게다가 api/citydata-bulk.ts는 상류(서울 API)에 대한 동시 연결 수를
// 8개로 제한한다(레거시 API 보호) — 최악의 경우 여러 "웨이브"로 나뉘어 실행되므로
// "8~9초면 끝난다"는 가정도 더는 유효하지 않다. maxDuration보다 5초 이상 여유를
// 두어, 함수가 끝까지 실행되거나 플랫폼이 자체적으로 타임아웃 응답을 만들 시간을
// 먼저 준다 — 그래야 사용자가 실제로는 플랫폼 타임아웃인데 "네트워크 상태를
// 확인해주세요" 같은 오해를 부르는 메시지를 보지 않는다.
const BULK_TIMEOUT_MS = 20_000

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
// 개별 try/catch), 목업 경로는 buildMockSnapshot이 항상 성공하는 값만 만들어서
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
 * 배포됐거나 CDN을 안 거친 응답이면 없다. 그때 0으로 두면 최대 3시간 묵은 값이
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

export async function fetchAreaSnapshot(areaName: string): Promise<AreaSnapshot> {
  if (isMockMode()) {
    if (mockFailureAreaNames().has(areaName)) {
      throw new Error(
        `[목업] ${areaName} 조회 실패를 시뮬레이션합니다. (VITE_MOCK_FAIL_AREAS)`,
      )
    }
    return parseCitydataResponse(buildMockSnapshot(areaName), areaName)
  }

  const url = `${baseUrl()}/api/citydata?area=${encodeURIComponent(areaName)}`
  const { body } = await requestJson(url, SINGLE_AREA_TIMEOUT_MS)
  // 혼잡도는 나이를 안 싣는다. 이 응답에는 관측 시각(`PPLTN_TIME`)이 함께 와서
  // 화면이 이미 「11:00 기준」이라고 정확히 말할 수 있다 — 도시정보 쪽에
  // `Age`가 필요한 것은 거기에 그런 시각이 없기 때문이다.
  return parseCitydataResponse(body, areaName)
}

// 「더보기」(도시정보). `citydata_ppltn`이 아니라 `citydata`를 부르므로 주차장·따릉이·
// 날씨·문화행사·재난문자가 한 응답에 전부 온다 — 명소당 호출 횟수는 그대로 1회다.
export async function fetchCityInfo(areaName: string): Promise<CityInfo> {
  if (isMockMode()) {
    if (mockFailureAreaNames().has(areaName)) {
      throw new Error(
        `[목업] ${areaName} 도시정보 조회 실패를 시뮬레이션합니다. (VITE_MOCK_FAIL_AREAS)`,
      )
    }
    // 방금 만든 값이다. 목업에는 CDN도 서울 API도 없으므로 나이가 0이고,
    // 그건 「모른다」가 아니라 실제로 아는 사실이다.
    return {
      ...parseCityInfoResponse(buildMockCityInfo(areaName), areaName),
      freshness: { ageSeconds: 0, receivedAt: Date.now() },
    }
  }

  const url = `${baseUrl()}/api/cityinfo?area=${encodeURIComponent(areaName)}`
  const { body, ageSeconds } = await requestJson(url, SINGLE_AREA_TIMEOUT_MS, '도시 정보')
  // **`receivedAt`을 함께 든다.** `Age`만으로는 부족하다 — 이 응답이
  // TanStack Query 캐시에 `staleTime`(30분)만큼 더 앉아 있을 수 있어서,
  // 그 몫을 안 더하면 42분 묵은 값에 「12분 전」이라 적는다.
  return {
    ...parseCityInfoResponse(body, areaName),
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
 * 명소 인구의 **시간 대비**(1시간·3시간·한달 전). CCTV와 같은 상류·같은 규칙이다 —
 * **하루 1,000회 한도와 무관**하고(`api/ppltn.ts`), **실패해도 던지지 않는다.**
 *
 * 던지지 않는 이유가 CCTV보다 강하다. 이 값은 인구 탭 안에서 공식 API가 준
 * 인원수·구성비 **옆에** 놓이는데, 여기서 오류를 올리면 멀쩡한 그 값들까지
 * 고장 난 화면으로 끌고 들어간다. 빈 응답은 관대한 리더가 세 칸을 전부
 * `null`로 읽어 그 절만 사라진다.
 */
export async function fetchPopulationTrend(areaName: string): Promise<PopulationTrend> {
  if (isMockMode()) {
    return buildMockPopulationTrend(areaName)
  }

  const url = `${baseUrl()}/api/ppltn?area=${encodeURIComponent(areaName)}`
  try {
    const { body } = await requestJson(url, SINGLE_AREA_TIMEOUT_MS, '인구 대비 정보')
    return parsePopulationTrend(body)
  } catch (error) {
    // requestJson이 이미 콘솔에 남겼다. 여기서는 화면을 지키는 것만 한다.
    console.error(`[${areaName}] 인구 대비 조회 실패:`, error)
    return parsePopulationTrend(null)
  }
}

/**
 * 명소 **전부**의 지금 혼잡도. 목록과 지도가 쓴다.
 *
 * **`fetchAreaSnapshots`를 대신한다.** 그쪽은 이름 목록을 받아 명소당 1회씩
 * 공식 API를 부르는데, 121곳에서는 갱신 한 번에 121회라 하루 한도(1,000)를
 * 세 배로 넘긴다. 이쪽은 인증키 없는 상류라 **한 번에 다 오고 쿼터를 안 쓴다**.
 *
 * **이름을 인자로 안 받는다.** 전체가 오기 때문이기도 하고, 인자가 없어야
 * URL이 하나로 굳어 CDN 캐시를 사용자 전체가 나눠 쓰기 때문이다 — 저쪽이
 * 이름을 정렬·중복제거해서 보내며 애써 만들던 성질을 여기서는 공짜로 얻는다.
 *
 * 카탈로그에 없는 명소가 섞여 와도 그대로 둔다. 거르는 자리는 호출부이고
 * (카탈로그와 이름으로 맞춘다), 여기서 걸러 봐야 같은 일을 두 번 한다.
 */
export async function fetchAreaCongestion(): Promise<readonly AreaCongestion[]> {
  if (isMockMode()) {
    const failing = mockFailureAreaNames()
    return AREA_NAMES.filter((name) => !failing.has(name)).map((name) => ({
      name,
      congestion: parseCitydataResponse(buildMockSnapshot(name), name).congestion,
    }))
  }

  const url = `${baseUrl()}/api/hotspots`
  const { body } = await requestJson(url, BULK_TIMEOUT_MS, '혼잡도 정보')
  return parseHotspotsResponse(body)
}

export async function fetchAreaSnapshots(
  areaNames: readonly string[],
): Promise<readonly (AreaSnapshot | null)[]> {
  if (isMockMode()) {
    const failing = mockFailureAreaNames()
    return areaNames.map((name) =>
      failing.has(name) ? null : parseCitydataResponse(buildMockSnapshot(name), name),
    )
  }

  // 실제로 보내는 쿼리스트링은 중복 제거 + 정렬한 이름 집합이다(호출부가 넘긴
  // areaNames 자체의 순서는 건드리지 않는다 — 반환값은 아래에서 원래 순서로 만든다).
  // 이렇게 정규화해서 보내야, 호출부가 나중에 "거리순으로 정렬해서 넘기기" 같은
  // 최적화를 하더라도 같은 명소 집합이면 항상 같은 URL이 되어 api/citydata-bulk.ts의
  // CDN 캐시(Cache-Control: s-maxage)를 사용자 전체가 공유할 수 있다. 정규화하지
  // 않으면 사용자마다 다른 순서로 보내는 순간 캐시가 쪼개지고, AGENTS.md가 경고한
  // "사용자 수에 비례한 호출량 증가" 문제가 서버 쪽에서 재현된다.
  const canonicalAreas = Array.from(new Set(areaNames)).toSorted()
  const url = `${baseUrl()}/api/citydata-bulk?areas=${encodeURIComponent(canonicalAreas.join(','))}`
  // 일괄 조회도 나이를 안 싣는다 — 단건 혼잡도와 같은 이유로 관측 시각이
  // 응답 안에 함께 온다.
  const envelope = parseBulkEnvelope((await requestJson(url, BULK_TIMEOUT_MS)).body)

  // 봉투가 이름을 키로 쓰므로(api/citydata-bulk.ts 참고) 서버가 보낸 순서와
  // 무관하게 호출부가 원래 넘긴 areaNames 순서로 결과를 만들 수 있다.
  return areaNames.map((name) => {
    try {
      return parseCitydataResponse(envelope[name], name)
    } catch (error) {
      // 한 명소가 실패해도 목록 전체를 죽이지 않는다. 카드 하나만 "정보 없음"이 된다.
      // 다만 조용히 삼키면 카탈로그 오타를 영영 못 찾으므로 원인은 남긴다.
      console.error(`[${name}] 혼잡도 조회 실패:`, error)
      return null
    }
  })
}
