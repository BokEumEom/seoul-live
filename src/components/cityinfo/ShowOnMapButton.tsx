import { t } from '../../i18n/t'
import type { FacilityLocation } from '../../domain/cityInfo'
import { Icon } from '../common/Icon'

interface Props {
  readonly place: FacilityLocation | null
  readonly onShow: (place: FacilityLocation) => void
}

// **서울 인파레이더가 그렇게 한다** — 주차장·따릉이 줄 오른쪽의 아이콘을 누르면
// 지도가 그 자리로 간다. 이름만 적혀 있으면 「광화문역 5번출구」가 어느 쪽
// 출구인지, 걸어서 얼마인지 알 길이 없다.
//
// **좌표가 없으면 아예 그리지 않는다.** 실응답에도 `LAT`/`LNG`가 빈 문자열로
// 오는 주차장이 있다(`cityInfoSchema`의 `coordsOrNull`). 눌러도 아무 일이 안
// 일어나는 버튼은 고장으로 보인다.
//
// 아이콘만 있는 버튼이라 이름이 반드시 필요하다. 「지도에서 보기」만 적으면
// 한 화면에 같은 이름의 버튼이 열 개가 되어, 스크린리더로 훑을 때 어느 줄의
// 것인지 구별되지 않는다 — 그래서 시설 이름을 앞에 붙인다.
export function ShowOnMapButton({ place, onShow }: Props) {
  if (place === null) {
    return null
  }

  return (
    <button
      type="button"
      aria-label={t('{시설} 지도에서 보기', { 시설: place.name })}
      onClick={() => {
        onShow(place)
      }}
      // 44px은 손가락 최소 타깃이다. 줄 높이가 그보다 낮아도 버튼은 그 크기를
      // 지켜야 해서 `-my-*`로 위아래 여백을 도로 빼앗지 않고 그냥 둔다.
      className="flex size-11 shrink-0 items-center justify-center rounded-full text-primary"
    >
      <Icon name="pin" className="size-5" />
    </button>
  )
}
