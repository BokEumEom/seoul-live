import { t } from '../../../i18n/t'
import type { FacilityLocation } from '../../../domain/cityInfo'
import { EventList } from '../../cityinfo/EventList'
import { InfoSection } from '../../cityinfo/InfoSection'
import { CityInfoBoundary } from '../CityInfoBoundary'

interface Props {
  readonly areaName: string
  readonly onShowOnMap: (place: FacilityLocation) => void
}

/**
 * 행사 탭 — 이 명소에서 지금 열리는 문화행사.
 *
 * 시안(stitch_ui_ux/_7)에는 분류 칩(축제·전시·공연)과 「Featured」 카드가
 * 있지만 **여기서는 안 그린다.** 서울 API의 행사 항목에 분류 필드가 없어
 * 없는 값으로 칩을 세우면 누를 때마다 빈 목록이 나온다 — 자세한 근거는
 * `EventList`.
 */
export function EventsPanel({ areaName, onShowOnMap }: Props) {
  return (
    <CityInfoBoundary
      areaName={areaName}
      has={(info) => info.events.length > 0}
      empty={t('진행 중인 문화행사가 없어요.')}
    >
      {(info) => (
        <InfoSection title={t('문화행사')} icon="event" count={info.events.length}>
          <EventList events={info.events} onShowOnMap={onShowOnMap} />
        </InfoSection>
      )}
    </CityInfoBoundary>
  )
}
