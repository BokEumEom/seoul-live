import { t } from '../../../i18n/t'
import { CommerceCard } from '../../cityinfo/CommerceCard'
import { CityInfoBoundary } from '../CityInfoBoundary'

interface Props {
  readonly areaName: string
}

/**
 * 상권 탭 — 시안 `stitch_ui_ux/_8`.
 *
 * **명소에 따라 통째로 빈다.** 실호출에서 여의도한강공원은 `LIVE_CMRCL_STTS`가
 * 아예 없었고(2026-08-25), 121곳 중 공원류가 서른 곳 넘는다. 결제가 일어나지
 * 않는 곳이라 정상이므로 「없다」를 그대로 말한다 — 다른 탭들과 같은 방식이다.
 */
export function CommercePanel({ areaName }: Props) {
  return (
    <CityInfoBoundary
      areaName={areaName}
      has={(info) => info.commerce !== null}
      empty={t('이 명소에는 상권 정보가 없어요.')}
    >
      {(info) => (info.commerce === null ? null : <CommerceCard commerce={info.commerce} />)}
    </CityInfoBoundary>
  )
}
