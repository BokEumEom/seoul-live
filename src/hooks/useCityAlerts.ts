import { ALERT_SOURCE_AREA } from '../data/areas'
import { useCityInfo } from '../data/queries'
import { dedupeAlerts } from '../domain/alerts'
import type { CityAlert } from '../domain/cityInfo'
import { useCachedCityAlerts } from './useCachedCityAlerts'

/**
 * 홈 화면의 재난문자.
 *
 * **`useCachedCityAlerts`와 다른 점은 스스로 한 번 조회한다는 것이다.** 그쪽은
 * 캐시에 있는 것만 읽어서, 앱을 열고 아무 명소도 안 눌렀으면 경보가 걸려
 * 있어도 홈에 아무것도 안 떴다 — 「오늘의 서울」은 사용자가 스스로 연 화면이라
 * 그 규칙이 맞지만, 홈은 **아무것도 안 한 사용자에게 먼저 알려야 하는 자리**다.
 *
 * **한 곳만 부른다**(`ALERT_SOURCE_AREA`). 30곳을 부르면 하루 240회가 더해져
 * 한도를 넘는다. 최악의 경우 총량이 안 느는 이유는 그 상수의 주석에 있다.
 *
 * 상세에서 이미 받아둔 캐시도 함께 모은다 — 그건 공짜이고, 사용자가 본 명소가
 * 많을수록 더 넓게 덮는다. 조회한 곳이 캐시에도 들어오므로 문구가 겹치는데
 * `dedupeAlerts`가 지운다.
 */
export function useCityAlerts(): readonly CityAlert[] {
  const source = useCityInfo(ALERT_SOURCE_AREA)
  const cached = useCachedCityAlerts()

  // 실패해도 빈 목록이다. 경보는 부가 정보라 없으면 배너가 빠질 뿐이고,
  // 홈의 나머지(지도·목록)는 다른 질의로 서 있다.
  return dedupeAlerts([...(source.data?.alerts ?? []), ...cached])
}
