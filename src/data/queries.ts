import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { z } from 'zod'
import type { AreaSnapshot } from '../domain/types'
import { fetchAreaSnapshot, fetchAreaSnapshots, ProxyResponseError } from './client'
import { AreaNameMismatchError, SeoulApiError } from './schema'

const FIVE_MINUTES = 5 * 60 * 1_000
const MAX_RETRIES = 2

// 재시도해도 절대 성공하지 못하는 에러는 재시도하지 않는다 — 같은 입력으로 같은
// 실패를 반복할 뿐이고, 사용자는 그만큼 더 오래 기다린다.
//   - AreaNameMismatchError / SeoulApiError: 요청 자체의 문제다(카탈로그 오타,
//     혹은 서울 API가 "해당하는 데이터가 없습니다" 같은 RESULT 에러 봉투를 준 것).
//   - z.ZodError: 응답 형태가 스키마와 안 맞는다는 뜻이다 — 같은 서버가 같은 버그로
//     같은 모양을 다시 준다.
//   - ProxyResponseError의 4xx: 요청 자체가 잘못됐다는 신호다(예: area가 허용
//     목록에 없어 400) — 서버 상태가 아니라 우리가 보낸 값의 문제이므로 다시
//     보내도 같은 4xx가 온다.
// 반대로 ProxyResponseError의 5xx나 순수 네트워크/타임아웃 에러(client.ts가 던지는
// 일반 Error)는 일시적일 수 있으니 재시도할 가치가 있다.
export function shouldRetry(failureCount: number, error: Error): boolean {
  if (error instanceof AreaNameMismatchError || error instanceof SeoulApiError) {
    return false
  }
  if (error instanceof z.ZodError) {
    return false
  }
  if (error instanceof ProxyResponseError && error.status >= 400 && error.status < 500) {
    return false
  }
  return failureCount < MAX_RETRIES
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
