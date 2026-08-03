import type { AreaSnapshot } from '../domain/types'
import { buildMockSnapshot } from './mock'
import { parseCitydataResponse } from './schema'

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

  const url = `${baseUrl()}/api/citydata-bulk?areas=${encodeURIComponent(areaNames.join(','))}`
  const payload = (await requestJson(url, BULK_TIMEOUT_MS)) as { results?: unknown[] }

  // 프록시는 요청 순서를 그대로 유지하므로 results[i]는 areaNames[i]에 대응한다.
  return areaNames.map((name, index) => {
    try {
      return parseCitydataResponse(payload.results?.[index], name)
    } catch (error) {
      // 한 명소가 실패해도 목록 전체를 죽이지 않는다. 카드 하나만 "정보 없음"이 된다.
      // 다만 조용히 삼키면 카탈로그 오타를 영영 못 찾으므로 원인은 남긴다.
      console.error(`[${name}] 혼잡도 조회 실패:`, error)
      return null
    }
  })
}
