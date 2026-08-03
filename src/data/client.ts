import type { AreaSnapshot } from '../domain/types'
import { buildMockSnapshot } from './mock'
import { parseBulkEnvelope, parseCitydataResponse } from './schema'

// 단일 명소 타임아웃. 프록시(api/citydata.ts)는 서울 API 호출 자체를 8초에서 끊으므로,
// 프록시가 502로 정리해서 응답할 여유를 두고 그보다 넉넉하게 잡는다.
const SINGLE_AREA_TIMEOUT_MS = 10_000

// 일괄 조회 타임아웃. api/citydata-bulk.ts는 명소별 8초 타임아웃을 Promise.allSettled로
// "병렬" 실행하므로 이론상 8~9초면 끝난다. 하지만 Vercel 함수 자체의 상한(vercel.json의
// maxDuration: 15초)이 있다 — 클라이언트 타임아웃이 이보다 짧으면, 함수가 정상적으로
// 응답을 완성하기도 전에 클라이언트가 먼저 포기해버린다. 함수 상한보다 여유 있게 잡는다.
const BULK_TIMEOUT_MS = 16_000

// 이름을 `useMock`으로 지으면 ESLint의 react-hooks/rules-of-hooks가 "use"로 시작하는
// 이름을 React 훅으로 오인해 오류를 낸다. 이 함수는 훅이 아니라 순수 판별 함수라 이름을
// 바꾼다.
function isMockMode(): boolean {
  return import.meta.env.VITE_USE_MOCK === 'true'
}

function baseUrl(): string {
  return import.meta.env.VITE_API_BASE_URL ?? ''
}

// HTTP 실패(response.ok === false)를 표시하는 전용 에러. requestJson의 catch 블록에서
// "이미 사용자용 메시지로 바뀐 에러"와 "아직 안 바뀐 원본 네트워크 에러"를 구분하는 데 쓴다.
// 메시지 문자열 접두어 비교보다 안전하다 — 문구가 나중에 바뀌어도 분기가 깨지지 않는다.
class ProxyResponseError extends Error {}

async function requestJson(url: string, timeoutMs: number): Promise<unknown> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, { signal: controller.signal })
    if (!response.ok) {
      throw new ProxyResponseError('혼잡도 정보를 가져오지 못했어요. 잠시 후 다시 시도해주세요.')
    }
    return await response.json()
  } catch (error) {
    if (error instanceof ProxyResponseError) {
      throw error
    }
    // 여기로 오는 건 타임아웃에 의한 AbortError, 오프라인·DNS 실패에 의한 TypeError 등이다.
    // 원본 메시지("Failed to fetch" 같은)를 그대로 사용자에게 보여주면 안 되지만 — 진단이
    // 안 되면 카탈로그 오타인지 네트워크 문제인지 구분할 수 없으므로 콘솔에는 남기고,
    // `cause`로도 원본을 붙여 상위에서 필요하면 꺼내 쓸 수 있게 한다.
    console.error('혼잡도 정보 요청 실패:', error)
    throw new Error('혼잡도 정보를 가져오지 못했어요. 네트워크 상태를 확인해주세요.', {
      cause: error,
    })
  } finally {
    clearTimeout(timer)
  }
}

export async function fetchAreaSnapshot(areaName: string): Promise<AreaSnapshot> {
  if (isMockMode()) {
    return parseCitydataResponse(buildMockSnapshot(areaName), areaName)
  }

  const url = `${baseUrl()}/api/citydata?area=${encodeURIComponent(areaName)}`
  return parseCitydataResponse(await requestJson(url, SINGLE_AREA_TIMEOUT_MS), areaName)
}

export async function fetchAreaSnapshots(
  areaNames: readonly string[],
): Promise<readonly (AreaSnapshot | null)[]> {
  if (isMockMode()) {
    return areaNames.map((name) => parseCitydataResponse(buildMockSnapshot(name), name))
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
  const envelope = parseBulkEnvelope(await requestJson(url, BULK_TIMEOUT_MS))

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
