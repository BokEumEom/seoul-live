import { t } from '../../i18n/t'
import type { AccidentControl } from '../../domain/accident'
import type { FacilityLocation } from '../../domain/cityInfo'
import type { Coords } from '../../domain/types'
import { Icon } from '../common/Icon'
import { AccidentList } from './AccidentList'

interface Props {
  readonly accidents: readonly AccidentControl[]
  /** 거리를 재는 기준점. 명소 중심이다 — 근거는 `facilityDistance.ts`. */
  readonly origin: Coords | null
  readonly onShowOnMap: (place: FacilityLocation) => void
}

/**
 * 차량 통제 알림. 시안 `stitch_ui_ux/_4`의 둘째 카드다.
 *
 * **절이 아니라 배너다.** 예전에는 「도로소통」 절 안에 회색 카드로 들어 있어
 * 평균 속도 아래에 딸린 참고처럼 보였는데, 통제는 참고가 아니라 **경로를 바꾸게
 * 하는 소식**이다. 시안이 이걸 도로 요약과 「주요 도로 상황」 **사이**에 통째로
 * 띄운 것도 같은 이유다 — 「지금 차로 갈 만한가」의 답이 속도만이 아니다.
 *
 * **빨강이 아니라 주황이다(시안에서 벗어난다).** 시안은 `error-container`인데,
 * 이 앱에서 빨강 배너는 이미 재난문자(`AlertBanner`)와 기상특보
 * (`WeatherWarningBanner`) 둘이 쓰고 있다. 통제까지 같은 빨강을 입으면
 * 광화문처럼 상시 공사·집회가 있는 곳에서 **매일 빨간 배너가 떠서**, 정작
 * 재난문자가 왔을 때 그 빨강이 아무 말도 못 하게 된다. 주황은 이 배색의
 * 「주의」이고, 통제 유형 글자가 이미 쓰던 색이다.
 *
 * **여러 건이면 한 배너 안에 쌓는다.** 건마다 배너를 세우면 제목
 * 「차량 통제 알림」이 화면에 세 번 적힌다 — 실호출의 광화문이 두 건이었다.
 */
export function AccidentBanner({ accidents, origin, onShowOnMap }: Props) {
  if (accidents.length === 0) {
    return null
  }

  return (
    <section
      aria-labelledby="accident-banner-title"
      className="mx-4 rounded-card border border-busy bg-busy-container p-4"
    >
      <div className="flex items-center gap-2">
        {/* 흐린 주황은 주황 바탕에서 3.48:1이라 못 쓴다 — 이 배색이 그 자리에
            두라고 만들어 둔 짝이 `-container`의 on 색이다(7.26:1). */}
        <Icon name="warning" className="size-5 text-on-busy-container" />
        <h3 id="accident-banner-title" className="text-headline-sm text-on-busy-container">
          {t('차량 통제 알림')}
        </h3>
      </div>
      <div className="mt-3">
        <AccidentList accidents={accidents} origin={origin} onShowOnMap={onShowOnMap} />
      </div>
    </section>
  )
}
