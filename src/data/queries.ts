import {
  useQuery,
  useQueryClient,
  type QueryClient,
  type UseQueryResult,
} from '@tanstack/react-query'
import { z } from 'zod'
import type { CctvCamera } from '../domain/cctv'
import type { PopulationTrend } from '../domain/populationTrend'
import type { CityInfo } from '../domain/cityInfo'
import type { AreaCongestion, AreaSnapshot } from '../domain/types'
import {
  fetchAreaCongestion,
  fetchAreaSnapshot,
  fetchAreaSnapshots,
  fetchCctv,
  fetchPopulationTrend,
  fetchCityInfo,
  ProxyResponseError,
} from './client'
import { AreaNameMismatchError, SeoulApiError } from './schema'

const FIVE_MINUTES = 5 * 60 * 1_000
const MAX_RETRIES = 2

// 서울 API가 RESULT 봉투로 주는 에러 코드 중, 같은 요청을 다시 보내면 결과가
// 달라질 수 있는 것들. 출처는 「서울시 실시간 도시데이터」 명세의 에러 코드 표다.
//   ERROR-500 서버 오류 / ERROR-600 데이터베이스 연결 오류
// ERROR-601(SQL 문장 오류)은 뺐다. 상대 서버의 결정적 버그라 같은 요청은 몇 번을
// 보내도 같은 자리에서 깨진다.
const TRANSIENT_SEOUL_CODES: ReadonlySet<string> = new Set(['ERROR-500', 'ERROR-600'])

// 재시도해도 절대 성공하지 못하는 에러는 재시도하지 않는다 — 같은 입력으로 같은
// 실패를 반복할 뿐이고, 사용자는 그만큼 더 오래 기다린다.
//   - AreaNameMismatchError: 카탈로그 오타다. 같은 이름으로 몇 번을 물어도 같다.
//   - SeoulApiError: 대부분 요청 자체의 문제다(없는 명소, 잘못된 인자, 무효한 키).
//     단 ERROR-500·ERROR-600은 상대 서버가 흔들린 것이라 재시도할 가치가 있다 —
//     TRANSIENT_SEOUL_CODES 참고.
//   - z.ZodError: 응답 형태가 스키마와 안 맞는다는 뜻이다 — 같은 서버가 같은 버그로
//     같은 모양을 다시 준다.
//   - ProxyResponseError의 4xx: 요청 자체가 잘못됐다는 신호다(예: area가 허용
//     목록에 없어 400) — 서버 상태가 아니라 우리가 보낸 값의 문제이므로 다시
//     보내도 같은 4xx가 온다.
// 반대로 ProxyResponseError의 5xx나 순수 네트워크/타임아웃 에러(client.ts가 던지는
// 일반 Error)는 일시적일 수 있으니 재시도할 가치가 있다.
export function shouldRetry(failureCount: number, error: Error): boolean {
  if (error instanceof AreaNameMismatchError) {
    return false
  }
  if (error instanceof SeoulApiError) {
    return TRANSIENT_SEOUL_CODES.has(error.code) && failureCount < MAX_RETRIES
  }
  if (error instanceof z.ZodError) {
    return false
  }
  if (error instanceof ProxyResponseError && error.status >= 400 && error.status < 500) {
    return false
  }
  return failureCount < MAX_RETRIES
}

/** 목록이 이미 받아 둔 한 곳. `undefined`면 받아 둔 적이 없다는 뜻이다. */
interface SeededSnapshot {
  readonly snapshot: AreaSnapshot
  /** 그 값을 **언제** 받았는지. 이걸 빼면 묵은 값이 새 값 행세를 한다. */
  readonly updatedAt: number
}

// 홈의 일괄 조회가 30곳을 통째로 받아 두는데, 상세가 그중 한 곳을 **다시** 물었다.
// 이미 메모리에 있는 값을 받으려고 왕복 한 번을 더 기다렸고 그동안 스켈레톤이
// 떴다 — 서울 인파레이더가 즉시 열리는 것과 갈리던 자리다. 게다가 그 왕복은
// CDN 캐시 키가 따로라 하루 1,000회에서 **또 한 번**을 썼다(최악 30곳 × 24 = 720회).
//
// 일괄 조회의 결과는 자리순 배열이고 이름은 queryKey에 들어 있다. 그래서 키에서
// 이름을 꺼내 자리를 찾는다. `getQueriesData`로 접두어 검색을 하는 이유는 홈이
// 넘기는 명소 목록이 언제 달라져도(필터·즐겨찾기) 여기가 안 깨지게 하기 위해서다.
export function findSeededSnapshot(
  client: QueryClient,
  areaName: string,
): SeededSnapshot | undefined {
  const entries = client.getQueriesData<readonly (AreaSnapshot | null)[]>({
    queryKey: ['areas'],
  })

  for (const [key, data] of entries) {
    const names: unknown = key[1]
    if (!Array.isArray(names) || data === undefined) {
      continue
    }
    const index = names.indexOf(areaName)
    // 일괄 조회는 명소 하나가 실패하면 그 자리를 null로 준다(client.ts).
    // null을 「받아 둔 값」으로 세면 상세가 영영 빈 화면이 된다.
    const snapshot = index === -1 ? null : (data[index] ?? null)
    if (snapshot === null) {
      continue
    }
    return { snapshot, updatedAt: client.getQueryState(key)?.dataUpdatedAt ?? 0 }
  }
  return undefined
}

export function useAreaSnapshot(
  areaName: string | undefined,
): UseQueryResult<AreaSnapshot> {
  const client = useQueryClient()
  const seeded = areaName === undefined ? undefined : findSeededSnapshot(client, areaName)

  return useQuery({
    queryKey: ['area', areaName],
    // 목록에서 받아 둔 값을 첫 값으로 깐다. 이 훅의 캐시 항목이 아직 없을 때만
    // 쓰이므로, 한 번 조회된 뒤에는 이 값이 최신을 덮어쓰지 않는다.
    initialData: seeded?.snapshot,
    // **받은 시각을 같이 넘기는 것이 핵심이다.** 안 넘기면 「방금 받은 값」으로
    // 취급되어 아무리 묵어도 다시 받지 않는다. 넘기면 staleTime(5분)이 목록을
    // 받은 시점부터 세어져서, 오래됐으면 화면은 즉시 그리면서 뒤에서 새로 받는다.
    initialDataUpdatedAt: seeded?.updatedAt,
    // `enabled: Boolean(areaName)`가 areaName이 undefined일 때 queryFn 자체를 호출하지
    // 않게 막아주지만, 그건 런타임 보장이지 TypeScript가 아는 사실이 아니다. `areaName as
    // string` 단언 대신 가드로 좁히면 캐스트 없이도 타입이 맞고, enabled의 동작이 훗날
    // 바뀌더라도(예: 실수로 지워지더라도) 여기서 한 번 더 방어된다.
    queryFn: () => {
      if (!areaName) {
        return Promise.reject(new Error('areaName이 없어 조회할 수 없습니다.'))
      }
      return fetchAreaSnapshot(areaName)
    },
    enabled: Boolean(areaName),
    staleTime: FIVE_MINUTES,
    retry: shouldRetry,
  })
}

// 도시정보는 인구보다 느리게 변한다(날씨는 정시, 문화행사는 하루 단위). 혼잡도와
// 같은 5분을 쓰면 사실상 바뀌지 않는 값을 계속 다시 받는다.
const THIRTY_MINUTES = 30 * 60 * 1_000

export function useCityInfo(areaName: string | undefined): UseQueryResult<CityInfo> {
  return useQuery({
    queryKey: ['cityInfo', areaName],
    // useAreaSnapshot과 같은 이유로 enabled에만 기대지 않고 가드를 둔다.
    queryFn: () => {
      if (!areaName) {
        return Promise.reject(new Error('areaName이 없어 조회할 수 없습니다.'))
      }
      return fetchCityInfo(areaName)
    },
    enabled: Boolean(areaName),
    staleTime: THIRTY_MINUTES,
    retry: shouldRetry,
  })
}

// CCTV 목록은 도시정보보다도 느리게 변한다 — 카메라의 자리와 스트림 주소는
// 거의 안 바뀐다. **움직이는 값은 영상 자체이지 목록이 아니다.**
const ONE_HOUR = 60 * 60 * 1_000

export function useCctv(areaName: string | undefined): UseQueryResult<readonly CctvCamera[]> {
  return useQuery({
    queryKey: ['cctv', areaName],
    queryFn: () => {
      if (!areaName) {
        return Promise.reject(new Error('areaName이 없어 조회할 수 없습니다.'))
      }
      return fetchCctv(areaName)
    },
    enabled: Boolean(areaName),
    staleTime: ONE_HOUR,
    // **재시도하지 않는다.** `fetchCctv`가 실패를 이미 빈 배열로 흡수하므로
    // 여기까지 오는 에러는 사실상 없고, 재시도는 문서화되지 않은 남의 서버에
    // 요청을 더 보내는 일일 뿐이다.
    retry: false,
  })
}

/**
 * 명소 인구의 시간 대비. **상세 혼잡도와 같은 시계를 쓴다.**
 *
 * `staleTime`이 CCTV(1시간)가 아니라 상세 혼잡도(30분)와 같은 값인 이유는
 * 프록시 TTL을 그렇게 맞춘 이유와 같다(`api/ppltn.ts`) — 이 값이 인원수 바로
 * 옆에 놓이므로 두 숫자가 서로 다른 순간을 말하면 안 된다.
 */
export function usePopulationTrend(
  areaName: string | undefined,
): UseQueryResult<PopulationTrend> {
  return useQuery({
    queryKey: ['ppltn', areaName],
    queryFn: () => {
      if (!areaName) {
        return Promise.reject(new Error('areaName이 없어 조회할 수 없습니다.'))
      }
      return fetchPopulationTrend(areaName)
    },
    enabled: Boolean(areaName),
    staleTime: THIRTY_MINUTES,
    // **재시도하지 않는다.** `fetchPopulationTrend`가 실패를 이미 빈 값으로
    // 흡수하므로 여기까지 오는 에러는 사실상 없고, 재시도는 문서화되지 않은
    // 남의 서버에 요청을 더 보내는 일일 뿐이다(`useCctv`와 같다).
    retry: false,
  })
}

/**
 * 명소 **전부**의 지금 혼잡도. 목록·지도·「오늘의 서울」의 출처다.
 *
 * **`useAreaSnapshots`와 달리 인자가 없다.** 한 번에 전부 오므로 고를 것이
 * 없고, 그 덕에 `queryKey`도 상수 하나다 — 저쪽이 배열을 키로 쓰면서 감수하던
 * 「원소 구성이 바뀌면 캐시가 미스된다」는 문제가 여기서는 생기지 않는다.
 *
 * `staleTime`이 5분인 것은 상류의 실제 갱신 주기다(`api/_lib/seoul.ts`의
 * `hotspotsCacheTtlSeconds` 주석). 서버 캐시와 같은 값을 두어, 클라이언트가
 * 더 자주 물어봐야 CDN이 같은 응답을 돌려주는 헛걸음을 막는다.
 */
export function useAreaCongestion(): UseQueryResult<readonly AreaCongestion[]> {
  return useQuery({
    queryKey: ['area-congestion'],
    queryFn: fetchAreaCongestion,
    staleTime: FIVE_MINUTES,
    retry: shouldRetry,
  })
}

export function useAreaSnapshots(
  areaNames: readonly string[],
): UseQueryResult<readonly (AreaSnapshot | null)[]> {
  // queryKey에 배열을 그대로 넣는다. TanStack Query는 queryKey를 참조가 아니라 값으로
  // 안정적으로 직렬화해 해시하므로(JSON.stringify 계열), areaNames가 매 렌더마다 새
  // 배열 참조로 넘어와도 내용이 같으면 같은 캐시 항목을 찾는다 — "참조가 바뀌면 캐시가
  // 안 먹는다"는 걱정은 실제로는 기우다.
  //
  // 값 자체(원소 구성·순서)가 호출마다 바뀌는 건 이 훅의 캐시(TanStack Query)를
  // 진짜로 미스시킨다 — 그건 감수한다. 다만 서버 쪽 CDN 캐시(api/citydata-bulk.ts의
  // Cache-Control: s-maxage)까지 함께 쪼개지는 건 별도로 막혀 있다: client.ts의
  // fetchAreaSnapshots가 실제 요청 URL을 만들 때 areaNames를 중복 제거 + 정렬해서
  // 보내므로, 이 훅에 넘어오는 areaNames의 순서가(예: 나중에 "거리순 정렬" 기능이
  // 생겨) 호출마다 달라지더라도 서버로 나가는 요청과 CDN 캐시 키는 항상 하나로
  // 수렴한다. 즉 호출부가 정렬된 배열을 넘기는 건 이 훅의 자체 캐시 효율을 위한
  // 최적화일 뿐, 서버 호출량이 느는 걸 막는 안전장치가 아니다 — 안전장치는 이미
  // client.ts에 있다.
  return useQuery({
    queryKey: ['areas', areaNames],
    queryFn: () => fetchAreaSnapshots(areaNames),
    staleTime: FIVE_MINUTES,
    retry: shouldRetry,
  })
}
