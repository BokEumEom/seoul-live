import { isSkyState, type SkyState } from '../../domain/sky'
import type { IconName } from '../common/Icon'

/**
 * 하늘상태 → 글리프. **도메인이 아니라 여기 있다** — 이 저장소는 도메인이
 * 화면의 이름(CSS 클래스·아이콘)을 짓지 않는다. 도메인은 어휘(`SKY_STATES`)만
 * 갖고, 그 어휘를 무엇으로 그릴지는 화면의 결정이다.
 *
 * **「구름많음」과 「흐림」이 같은 그림의 속 빈 것과 찬 것이다.** 둘은 정도의
 * 차이라 다른 글리프를 주면 별개의 날씨로 읽힌다 — 16px에서 눈이 읽는 것은
 * 모양이 아니라 **얼마나 진한가**다.
 */
const ICON_BY_SKY: Readonly<Record<SkyState, IconName>> = {
  맑음: 'sun',
  구름많음: 'cloudPartly',
  흐림: 'cloud',
}

/** 모르는 값이면 `null`. 화면은 그 칸을 비운다 — 틀린 그림보다 없는 그림이 낫다. */
export function skyIcon(sky: string): IconName | null {
  return isSkyState(sky) ? ICON_BY_SKY[sky] : null
}
