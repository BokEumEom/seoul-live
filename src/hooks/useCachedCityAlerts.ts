import { useQueryClient } from '@tanstack/react-query'
import { AREA_NAMES } from '../data/areas'
import type { CityAlert, CityInfo } from '../domain/cityInfo'

// 캐시에 있는 것만 읽는다. 없으면 조회하지 않는다 — 이 화면은 추가 호출이
// 0이어야 한다. 사용자가 상세에서 도시 정보를 펼친 명소만 여기 잡힌다.
//
// 재난문자를 위해 30곳의 cityInfo를 새로 부르면 하루 720회가 그대로 더해진다.
export function useCachedCityAlerts(): readonly CityAlert[] {
  const client = useQueryClient()
  return AREA_NAMES.flatMap((name) => {
    const cached = client.getQueryData<CityInfo>(['cityInfo', name])
    return cached?.alerts ?? []
  })
}
