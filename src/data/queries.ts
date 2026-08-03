import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import type { AreaSnapshot } from '../domain/types'
import { fetchAreaSnapshot, fetchAreaSnapshots } from './client'
import { AreaNameMismatchError, SeoulApiError } from './schema'

const FIVE_MINUTES = 5 * 60 * 1_000

// AreaNameMismatchError(카탈로그 오타 등으로 요청한 이름과 응답 이름이 다름)와
// SeoulApiError(서울 API가 데이터 대신 RESULT 에러 봉투를 돌려줌, 예: "해당하는
// 데이터가 없습니다")는 재시도해도 같은 입력으로 같은 실패를 반복할 뿐이다 — 둘 다
// 네트워크 상태가 아니라 요청 자체의 문제라서다. 반면 프록시가 502를 주거나 타임아웃이
// 나는 경우(client.ts가 던지는 일반 Error)는 일시적일 수 있으니 재시도할 가치가 있다.
function shouldRetry(failureCount: number, error: Error): boolean {
  if (error instanceof AreaNameMismatchError || error instanceof SeoulApiError) {
    return false
  }
  return failureCount < 2
}

export function useAreaSnapshot(
  areaName: string | undefined,
): UseQueryResult<AreaSnapshot> {
  return useQuery({
    queryKey: ['area', areaName],
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

export function useAreaSnapshots(
  areaNames: readonly string[],
): UseQueryResult<readonly (AreaSnapshot | null)[]> {
  // queryKey에 배열을 그대로 넣는다. TanStack Query는 queryKey를 참조가 아니라 값으로
  // 안정적으로 직렬화해 해시하므로(JSON.stringify 계열), areaNames가 매 렌더마다 새
  // 배열 참조로 넘어와도 내용이 같으면 같은 캐시 항목을 찾는다 — "참조가 바뀌면 캐시가
  // 안 먹는다"는 걱정은 실제로는 기우다. 다만 값 자체(원소 구성이나 순서)가 호출마다
  // 바뀌면 얘기가 다르다: 이건 진짜 캐시 미스를 만들고, 더 나아가 api/citydata-bulk.ts의
  // CDN 캐시(Cache-Control: s-maxage, URL의 areas= 쿼리스트링으로 키가 잡힌다)까지
  // 깨뜨린다 — 사용자마다 다른 순서로 보내면 캐시가 아예 공유되지 않아 AGENTS.md가 경고한
  // "사용자 수에 비례한 호출량 증가" 문제가 서버 쪽에서도 재현된다. 그래서 호출부는
  // "정렬된 표시 순서"가 아니라 `AREA_NAMES`(카탈로그 원본 순서) 같은 안정된 값을
  // 넘겨야 한다 — 화면에서 보여줄 정렬은 받아온 스냅샷을 클라이언트에서 재배열해서
  // 해결하고, 네트워크 요청의 areaNames 자체를 정렬하면 안 된다.
  return useQuery({
    queryKey: ['areas', areaNames],
    queryFn: () => fetchAreaSnapshots(areaNames),
    staleTime: FIVE_MINUTES,
    retry: shouldRetry,
  })
}
