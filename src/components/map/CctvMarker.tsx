import { t } from '../../i18n/t'
import { Icon } from '../common/Icon'

interface Props {
  readonly name: string
  /** 지금 시트에서 펼쳐 보고 있는 카메라인가. */
  readonly active: boolean
  /** 영상이 없는 카메라. 눌러도 틀 것이 없다. */
  readonly playable: boolean
}

// 명소를 고르면 그 주변 CCTV가 지도에 함께 뜬다(샘플의 지도가 그렇게 한다).
//
// **`FacilityMarker`와 다른 물건이다.** 그쪽은 「방금 내가 누른 주차장」
// 하나를 짚는 알약이라 이름을 크게 달지만, 이건 **여러 개가 동시에 깔리는
// 층**이라 이름을 다 달면 지도가 글자로 덮인다. 그래서 평소에는 아이콘만
// 있는 점이고, 지금 보고 있는 것만 이름표를 편다.
//
// 색은 명소 핀의 혼잡도 4색을 피한다 — 같은 색을 쓰면 「이 CCTV가 붐빈다」로
// 잘못 읽힌다(`FacilityMarker`와 같은 판단).
export function CctvMarker({ name, active, playable }: Props) {
  if (active) {
    return (
      <span className="flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-label-sm font-semibold text-on-primary shadow-floating">
        <Icon name="cctv" className="size-4" />
        {name}
      </span>
    )
  }

  return (
    <span
      // 아이콘만 있는 점이라 이름이 없으면 스크린리더가 「이미지」로만 읽는다.
      role="img"
      aria-label={
        playable ? t('{시설} CCTV', { 시설: name }) : t('{시설} CCTV (영상 없음)', { 시설: name })
      }
      className={`flex size-7 items-center justify-center rounded-full border-2 border-white shadow-floating ${
        // 못 트는 카메라는 눌러도 영상이 없다. 색을 죽여 두면 「눌렀는데
        // 아무 일도 없다」를 누르기 전에 알 수 있다.
        playable ? 'bg-primary text-on-primary' : 'bg-outline text-white'
      }`}
    >
      <Icon name="cctv" className="size-4" />
    </span>
  )
}
