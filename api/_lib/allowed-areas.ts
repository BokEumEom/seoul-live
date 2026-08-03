// 프록시가 받는 area/areas 파라미터는 사용자 입력이다 — 임의 문자열을 그대로
// fetchArea에 넘기면 문자열 하나마다 별개의 CDN 캐시 키가 되어 캐시가 무력화되고,
// 서울 API 호출량이 사용자가 보낸 문자열 수만큼 는다(하루 1,000회 한도가 몇 번의
// 요청으로 끝난다). src/data/areas.ts의 카탈로그에 없는 이름은 여기서 걸러낸다.
//
// `src/data/areas.ts`를 직접 import한다 — 별도로 이름 목록을 손으로 옮겨 적으면
// 두 목록이 갈라질 수 있고, 카탈로그가 바뀔 때마다 여기도 손으로 맞춰야 한다.
// 같은 배열을 참조하므로 그 자체로 어긋날 수 없다. (allowed-areas.test.ts가 그래도
// 이 사실을 명시적으로 고정해 둔다 — 나중에 누가 이 파일을 직접 나열하는 방식으로
// 바꾸더라도 그 순간 테스트가 실패한다.)
import { AREA_NAMES } from '../../src/data/areas.js'

export const ALLOWED_AREA_NAMES: ReadonlySet<string> = new Set(AREA_NAMES)

export function isAllowedAreaName(name: string): boolean {
  return ALLOWED_AREA_NAMES.has(name)
}
