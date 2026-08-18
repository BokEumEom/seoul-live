import { t } from '../../i18n/t'
import { congestionTone, type CongestionTone } from '../../domain/congestion'
import type { CongestionLevel } from '../../domain/types'
import { Icon } from '../common/Icon'

// Tailwind v4는 클래스명을 정적으로 추출한다. `bg-${tone}` 같은 동적 조합은
// 빌드에서 사라지므로 전체 클래스명을 리터럴로 적는다. CongestionBadge의
// TONE_CLASS와 같은 제약이다.
// **알약은 어두운 채움 + 흰 글자다.** 선명한 톤(`bg-calm` 등)에 흰 글자를
// 얹으면 3.19~3.77로 미달한다. 네 톤이 전부 중간 명도라 검은 글자로 바꿔도
// 붐빔이 3.56으로 무너지고, 옅은 `-container`로 뒤집으면 대비는 좋아지지만
// **밝은 지도 타일 위에서 알약이 사라진다**(1.00~1.06). 어두운 채움만이
// 셋을 다 만족한다 — 흰 글자 7.09~8.31, 밝은 타일 대비 6.18~7.24.
//
// 네 알약의 명도가 서로 비슷해지는 값을 치른다(이웃 1.03~1.14). 알약에는
// 글자가 있어 색이 유일한 통로가 아니고, **색상 구분은 아래 핀이 맡는다** —
// 핀은 선명한 톤 그대로다. 줌이 낮아 알약이 없을 때 남는 것도 핀이다.
//
// `on-*-container`를 배경으로 재사용한다. 두 요구가 어긋나지 않아서(둘 다
// 「그 색상의 어두운 끝」을 원한다) 값을 나누지 않았고, 겸용이 조용해지지
// 않게 `tokens.test.ts`가 양쪽 대비를 함께 잠근다.
const TONE_PILL_CLASS: Readonly<Record<CongestionTone, string>> = {
  calm: 'bg-on-calm-container text-white',
  normal: 'bg-on-normal-container text-white',
  busy: 'bg-on-busy-container text-white',
  crowded: 'bg-on-crowded-container text-white',
}

const TONE_PIN_CLASS: Readonly<Record<CongestionTone, string>> = {
  calm: 'text-calm',
  normal: 'text-normal',
  busy: 'text-busy',
  crowded: 'text-crowded',
}

// 모듈 최상위에서 `t()`를 부르면 import 시점의 언어로 굳는다 — 함수로 둔다.
function unknownLabel(): string {
  return t('정보 없음')
}
// 같은 이유로 어둡게 둔다. 예전 `bg-surface-container-high`(#e1e2ed)는 밝은
// 지도 타일과 1.1이라 알약 자체가 안 보였다 — 「정보 없음」이 소리 없이
// 사라지면 그 명소가 없는 것처럼 읽힌다.
const UNKNOWN_PILL_CLASS = 'bg-on-surface-variant text-white'
const UNKNOWN_PIN_CLASS = 'text-outline'

interface Props {
  readonly name: string
  readonly level: CongestionLevel | null
  /** 줌이 낮으면 알약 라벨을 감춘다. `domain/map.shouldShowMarkerLabel` 참고. */
  readonly showLabel: boolean
  readonly selected: boolean
}

// AdvancedMarker가 씌우는 내용물이다. 이 컴포넌트는 SDK를 import하지 않는다 —
// 그래야 색상·라벨 규칙을 지도 목업 없이 테스트할 수 있다.
export function CongestionMarker({ name, level, showLabel, selected }: Props) {
  const tone = level === null ? null : congestionTone(level)
  const pillClass = tone === null ? UNKNOWN_PILL_CLASS : TONE_PILL_CLASS[tone]
  const pinClass = tone === null ? UNKNOWN_PIN_CLASS : TONE_PIN_CLASS[tone]
  const label = level === null ? unknownLabel() : t(level)

  return (
    <span
      role="img"
      aria-label={`${name} ${label}`}
      className="flex flex-col items-center"
    >
      {showLabel && (
        <span
          className={`whitespace-nowrap rounded-full px-2.5 py-1 text-label-sm font-semibold shadow-floating ${pillClass}`}
        >
          {label}
        </span>
      )}
      <Icon
        name="pin"
        className={`${selected ? 'size-9' : 'size-7'} ${pinClass}`}
      />
    </span>
  )
}
