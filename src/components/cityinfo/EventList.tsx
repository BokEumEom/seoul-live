import { t } from '../../i18n/t'
import { toFacilityLocation, type CulturalEvent, type FacilityLocation } from '../../domain/cityInfo'
import { EventThumbnail } from './EventThumbnail'
import { FacilityFact } from './FacilityFact'
import { ShowOnMapButton } from './ShowOnMapButton'

interface Props {
  readonly events: readonly CulturalEvent[]
  readonly onShowOnMap: (place: FacilityLocation) => void
}

/**
 * 문화행사 목록. 시안(`stitch_ui_ux/_7`)의 카드다.
 *
 * **한 행사가 한 카드다**(2026-08-25). 예전에는 그림·제목·본문이 테두리 없이
 * 세로로 이어져서, 포스터가 있는 행사와 없는 행사가 섞이면 **어디서 한 행사가
 * 끝나고 다음이 시작하는지**가 안 보였다 — 그림이 곧 구분선 노릇을 하다가
 * 그림 없는 항목에서 그 노릇이 사라진다.
 *
 * **기간과 장소를 두 줄로 갈랐다.** 「2026-08-18~2026-08-28 · 광화문광장
 * (서울특별시 종로구 세종대로 175)」이 한 줄이었는데 390px에서 두 줄로 접히면
 * 어디까지가 날짜인지가 안 보인다 — 주차장 카드와 같은 문제이고 같은 해법이다
 * (`FacilityFact`).
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
    <ul className="flex flex-col gap-3">
      {events.map((event, index) => (
        // 행사에는 고유 ID가 없다. 같은 이름의 행사가 장소만 달리해 여러 건 올 수
        // 있어 이름만으로는 부족하다.
        //
        // `overflow-hidden`이 포스터의 위 두 모서리를 카드 모양대로 깎는다 —
        // 그림이 카드 테두리 밖으로 삐져나오는 자리다.
        <li
          key={`${event.name}-${index}`}
          className="overflow-hidden rounded-card border border-outline-variant bg-surface-container-lowest"
        >
          <EventThumbnail src={event.thumbnail} />
          <div className="p-3">
            <div className="flex items-start justify-between gap-2">
              {event.url === '' ? (
                <p className="min-w-0 flex-1 text-body-md font-bold text-on-surface">
                  {event.name}
                </p>
              ) : (
                // 웹뷰 밖으로 나가는 링크다. opener를 남기면 열린 페이지가 이쪽
                // window를 조작할 수 있다.
                <a
                  href={event.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-w-0 flex-1 text-body-md font-bold text-primary underline"
                >
                  {event.name}
                </a>
              )}
              {/* 무료·유료와 지도 버튼이 제목 줄의 오른쪽 끝이다. **시안은
                  배지를 포스터 위에 얹지만 여기서는 안 얹는다** — 포스터가
                  행사 제목을 크게 박아 둔 그림이라 겹치는 자리가 나온다.
                  「유료」는 실호출에서 한 번도 못 봤다(근거는 `CulturalEvent.free`). */}
              <div className="flex shrink-0 items-center gap-1">
                {event.free !== null && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-label-sm ${
                      event.free
                        ? 'bg-calm-container text-on-calm-container'
                        : 'bg-surface-container text-on-surface-variant'
                    }`}
                  >
                    {event.free ? t('무료') : t('유료')}
                  </span>
                )}
                <ShowOnMapButton place={toFacilityLocation(event)} onShow={onShowOnMap} />
              </div>
            </div>

            {/* 기간이 먼저다. 「지금 하고 있나」가 「어디서 하나」보다 앞선 질문이고,
                시안도 그 차례다. 원문 그대로 적는다 — `EVENT_PERIOD`의 형식이
                명세에 없어(「2024.09.01 ~ 10.29 (매주 토,일)」 같은 것이 온다)
                우리가 다시 짜면 처음 보는 모양에서 날짜를 잃는다. */}
            <div className="mt-2 flex flex-col gap-1">
              {event.period !== '' && (
                <FacilityFact icon="clock">{event.period}</FacilityFact>
              )}
              {event.place !== '' && (
                <FacilityFact icon="pin">{event.place}</FacilityFact>
              )}
            </div>
          </div>
        </li>
      ))}
    </ul>
  )
}
