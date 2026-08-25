import { t } from '../../i18n/t'
import { toFacilityLocation, type CulturalEvent, type FacilityLocation } from '../../domain/cityInfo'
import { EventThumbnail } from './EventThumbnail'
import { ShowOnMapButton } from './ShowOnMapButton'

interface Props {
  readonly events: readonly CulturalEvent[]
  readonly onShowOnMap: (place: FacilityLocation) => void
}

/**
 * 문화행사 목록. 시안(`stitch_ui_ux/_7`)의 카드다.
 *
 * **시안의 분류 칩(축제·전시·공연)은 여전히 못 그린다** — 서울 API의 행사
 * 항목에 분류 필드가 없다. 「Featured」 히어로 카드도 마찬가지다: 무엇이 대표인지
 * 정할 근거가 응답에 없어서, 첫 항목을 크게 그리면 그건 서울이 정한 순서를
 * 우리가 「추천」이라고 바꿔 부르는 것이 된다.
 *
 * **그림과 지도 버튼은 2026-08-25에 붙었다.** `THUMBNAIL`·`EVENT_X`·`EVENT_Y`가
 * 실호출 53건 전부에 있었다 — 예전 주석이 「`EVENT_NM`·`EVENT_PERIOD`·
 * `EVENT_PLACE`·`PAY_YN`·`URL`이 전부다」라고 적고 있었는데, 그건 인증키가
 * 없어 응답을 못 보고 명세만 읽던 때의 목록이라 틀렸다.
 */
export function EventList({ events, onShowOnMap }: Props) {
  return (
    <ul className="flex flex-col gap-4">
      {events.map((event, index) => (
        // 행사에는 고유 ID가 없다. 같은 이름의 행사가 장소만 달리해 여러 건 올 수
        // 있어 이름만으로는 부족하다.
        <li key={`${event.name}-${index}`}>
          <EventThumbnail src={event.thumbnail} />
          <div className={event.thumbnail === '' ? '' : 'mt-2'}>
            {event.url === '' ? (
              <p className="text-body-md text-on-surface">{event.name}</p>
            ) : (
              // 웹뷰 밖으로 나가는 링크다. opener를 남기면 열린 페이지가 이쪽
              // window를 조작할 수 있다.
              <a
                href={event.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-body-md text-primary underline"
              >
                {event.name}
              </a>
            )}
            <p className="mt-1 text-label-md text-on-surface-variant">
              {[event.period, event.place].filter((part) => part !== '').join(' · ')}
            </p>
            {/* 무료·유료와 지도 버튼이 한 줄이다. 시안은 배지를 그림 위에 얹지만
                여기서는 아래에 둔다 — 얹으면 포스터의 글자와 겹치는 자리가 나온다.
                「유료」는 실호출에서 한 번도 못 봤다(근거는 `CulturalEvent.free`). */}
            <div className="mt-0.5 flex items-center justify-between gap-2">
              <span className="text-label-sm text-outline">
                {event.free === null ? '' : event.free ? t('무료') : t('유료')}
              </span>
              <ShowOnMapButton place={toFacilityLocation(event)} onShow={onShowOnMap} />
            </div>
          </div>
        </li>
      ))}
    </ul>
  )
}
