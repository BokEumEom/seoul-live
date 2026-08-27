import { useQueryClient } from '@tanstack/react-query'
import { AREA_NAMES } from '../data/areas'
import type { AreaPayload } from '../data/client'
import { parseCityInfoResponse } from '../data/cityInfoSchema'
import { areaPayloadKey } from '../data/queries'
import type { CityAlert } from '../domain/cityInfo'

// 캐시에 있는 것만 읽는다. 없으면 조회하지 않는다 — 이 화면은 추가 호출이
// 0이어야 한다. 사용자가 상세에서 도시 정보를 펼친 명소만 여기 잡힌다.
//
// 재난문자를 위해 30곳의 cityInfo를 새로 부르면 하루 720회가 그대로 더해진다.
//
// **캐시에 든 값은 원본 `citydata` 응답(`AreaPayload`)이다, 파싱된 `CityInfo`가
// 아니다.** `useAreaSnapshot`·`useCityInfo`가 각자 `select`로 파싱하지만 그
// 결과는 캐시에 안 앉는다(TanStack Query 표준 — select는 구독마다 다시 돈다).
// 그래서 여기서도 `parseCityInfoResponse`를 직접 불러야 재난문자를 꺼낼 수
// 있다. **키는 반드시 `areaPayloadKey`로만 만든다** — 문자열을 여기 따로 적으면
// 뒤지는 키와 채우는 키가 갈리고, 그게 씨앗 심기를 조용히 죽인 바로 그
// 사고다(`findSeededSnapshot`, 2026-08-20. AGENTS.md 참고).
export function useCachedCityAlerts(): readonly CityAlert[] {
  const client = useQueryClient()
  return AREA_NAMES.flatMap((name) => {
    const cached = client.getQueryData<AreaPayload>(areaPayloadKey(name))
    if (cached === undefined) {
      return []
    }
    // 파싱 비용은 캐시가 히트한 명소에만 붙는다. 지금은 사용자가 실제로
    // 연 몇 곳뿐이라 작지만, 렌더마다 다시 파싱한다 — 열어 본 명소가
    // 늘어나 무거워지면 이 자리에 useMemo를 붙인다.
    try {
      return parseCityInfoResponse(cached.body, name).alerts
    } catch (error) {
      // cityInfoSchema.ts는 대체로 관대하지만, 봉투 자체가 다른 명소거나
      // (AreaNameMismatchError) 아예 모양이 아니면(ZodError) 던질 수 있다.
      // 재난문자는 부가 정보라 한 명소의 파싱 실패로 이 화면 전체가 죽으면
      // 안 된다.
      console.error(`[${name}] 캐시된 도시정보 파싱 실패:`, error)
      return []
    }
  })
}
