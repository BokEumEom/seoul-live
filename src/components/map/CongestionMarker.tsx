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

// 이름표. **알약과 색을 나눠 갖지 않는다** — 혼잡도 4색은 값을 말하는 색이라
// 이름표까지 물들이면 「이 이름이 붐빈다」로 두 번 말하게 되고, 그러면 이름표는
// 알약을 더 크게 그린 것에 지나지 않는다. 여기서는 지도 위에서 **읽히는 것**만
// 하면 되므로 카드와 같은 표면색을 쓴다.
//
// 반투명이 아니라 불투명이다. 지도 타일에는 도로·글자·공원 초록이 섞여 있어
// 반투명 배경 위의 글자는 배경에 따라 대비가 오르내린다.
//
// **`absolute`가 핵심이다. 흐름에 두면 핀이 실제 위치를 안 가리킨다.**
// `AdvancedMarker`는 내용물의 **아래 끝 가운데**를 좌표에 맞춘다. 이름표를
// 핀 아래에 흐름으로 놓으면 그 아래 끝이 이름표 밑으로 내려가고, 핀은 그만큼
// 위로 밀린다 — 390×844 실측에서 핀 하단이 186px에서 **168px로 18px 올라갔다**
// (컨테이너 하단은 186 그대로). 줌 14를 넘나들 때마다 마커 30개가 18px씩
// 튀고, 선택된 핀은 늘 북쪽으로 어긋난 자리를 가리킨다.
// 띄워 두면 컨테이너의 아래 끝은 핀 끝 그대로이고 이름표만 지도 위로 드리운다.
const NAME_CLASS =
  'absolute top-full left-1/2 -translate-x-1/2 max-w-32 truncate rounded-full border border-outline-variant bg-surface-container-lowest px-2 py-0.5 text-label-sm font-semibold text-on-surface shadow-floating'

interface Props {
  readonly name: string
  readonly level: CongestionLevel | null
  /** 줌이 낮으면 알약 라벨을 감춘다. `domain/map.shouldShowMarkerLabel` 참고. */
  readonly showLabel: boolean
  /** 줌이 얕으면 이름표를 감춘다. `domain/map.shouldShowMarkerName` 참고. */
  readonly showName: boolean
  readonly selected: boolean
}

// AdvancedMarker가 씌우는 내용물이다. 이 컴포넌트는 SDK를 import하지 않는다 —
// 그래야 색상·라벨 규칙을 지도 목업 없이 테스트할 수 있다.
export function CongestionMarker({
  name,
  level,
  showLabel,
  showName,
  selected,
}: Props) {
  const tone = level === null ? null : congestionTone(level)
  const pillClass = tone === null ? UNKNOWN_PILL_CLASS : TONE_PILL_CLASS[tone]
  const pinClass = tone === null ? UNKNOWN_PIN_CLASS : TONE_PIN_CLASS[tone]
  const label = level === null ? unknownLabel() : t(level)
  // **고른 곳은 줌과 무관하게 이름을 단다.** 목록에서 고르면 지도가 그리로
  // 움직이는데, 그때 여러 핀 중 어느 것이 방금 고른 것인지 말해 주는 표시가
  // 핀 크기(`size-9`)뿐이었다 — 옆 핀과 2px 차이라 사실상 안 보인다.
  // 한 개짜리라 겹칠 걱정도 없다.
  const nameVisible = showName || selected

  return (
    <span
      // 이름표·알약이 각자 이름을 갖지 않는다. 이 컨테이너 하나가 「인사동
      // 여유」로 읽히고 안쪽은 전부 그 이름에 흡수된다 — 안쪽에 role을 주면
      // 보조기술이 같은 말을 두세 번 읽는다.
      role="img"
      aria-label={`${name} ${label}`}
      // `relative`는 이름표를 띄우기 위한 기준이다(NAME_CLASS 주석 참고).
      className="relative flex flex-col items-center"
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
      {/* 핀 **아래**다. 위에 얹으면 알약과 이름표가 한 덩어리로 뭉쳐 어느
          쪽이 값이고 어느 쪽이 이름인지 구분이 안 되고, 마커 전체가 위로
          길어져 시트 위쪽에서 잘린다. 아래로 내려 두면 이웃 마커의 알약과도
          다른 줄에 놓여 덜 겹친다. */}
      {nameVisible && <span className={NAME_CLASS}>{name}</span>}
    </span>
  )
}
