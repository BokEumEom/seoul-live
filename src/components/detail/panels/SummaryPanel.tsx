import { t } from '../../../i18n/t'
import { useCityInfo } from '../../../data/queries'
import type { DetailTabId } from '../../../domain/detailTabs'
import type { AreaCatalogEntry, AreaSnapshot } from '../../../domain/types'
import { AlertBanner } from '../../cityinfo/AlertBanner'
import { CctvSection } from '../../cityinfo/CctvSection'
import { ErrorState } from '../../common/ErrorState'
import { SkeletonList } from '../../common/SkeletonCard'
import { NearbyCalmSection } from '../../home/NearbyCalmSection'
import { SummaryGrid } from '../SummaryGrid'

interface Props {
  readonly entry: AreaCatalogEntry
  readonly snapshot: AreaSnapshot | undefined
  /** 혼잡도 조회가 실패했나. 카드 격자가 통째로 비는 유일한 이유다. */
  readonly congestionFailed: boolean
  readonly onRetryCongestion: () => void
  readonly onOpenTab: (tab: DetailTabId) => void
  readonly onSelectArea: (name: string) => void
  readonly openCctvStreamUrl: string | null
  readonly onToggleCctv: (streamUrl: string) => void
}

/**
 * 요약 탭 — **이 화면의 첫 얼굴**.
 *
 * 카드 여덟 칸이 목차이면서 값이다. 접이식 절과 다른 점이 그것이다: 접힌
 * 절은 「무엇이 있는지」조차 감추지만 카드는 값까지 보여준 뒤 자세히 볼
 * 사람만 넘긴다.
 *
 * 카드 아래에 둘이 더 온다.
 *
 * - **실시간 영상.** 혼잡도 숫자를 보고 나서 가장 먼저 묻는 것이 「그래서
 *   지금 어떤데」이고, 영상이 그 질문에 유일하게 직접 답한다. 도메인 탭으로
 *   내리지 않은 이유가 그것이다 — 이건 분류가 아니라 요약의 일부다.
 * - **근처 쾌적한 장소.** 요약을 다 읽고 「여긴 아니겠다」가 되는 자리라
 *   대안이 바로 뒤에 있어야 한다.
 */
export function SummaryPanel({
  entry,
  snapshot,
  congestionFailed,
  onRetryCongestion,
  onOpenTab,
  onSelectArea,
  openCctvStreamUrl,
  onToggleCctv,
}: Props) {
  // **`CityInfoBoundary`를 안 쓴다.** 이 탭은 도시 정보가 없어도 서야 한다 —
  // 혼잡도 카드와 CCTV와 대안 목록은 다른 조회에서 온다. 여기서 필요한 것은
  // 「있으면 쓰고 없으면 조용히 지나가기」뿐이다.
  const cityInfo = useCityInfo(entry.name)

  return (
    <div className="flex flex-col gap-3">
      {/* **재난문자는 탭 뒤에 숨기지 않는다.** 사용자가 찾아 읽는 값이 아니라
          지금 당장 알아야 하는 내용이라, 안전 탭에도 있지만 여기에도 뜬다.
          `role="alert"`이 붙어 있어 도착하면 낭독된다. */}
      <AlertBanner alerts={cityInfo.data?.alerts ?? []} />

      {congestionFailed && (
        <div className="px-4">
          <ErrorState
            message={t('혼잡도 정보를 가져오지 못했어요.')}
            onRetry={onRetryCongestion}
          />
        </div>
      )}

      {/* 혼잡도와 도시 정보 **둘 다** 오기 전에는 격자에 세울 칸이 없다.
          한쪽만 와도 그 몫의 카드는 바로 선다 — 늦게 오는 쪽을 기다리지
          않는다. 둘 다 아직이면 스켈레톤이 자리를 잡는다. */}
      {snapshot === undefined && cityInfo.isPending ? (
        <div className="px-4">
          <SkeletonList count={2} />
        </div>
      ) : (
        <SummaryGrid
          snapshot={snapshot}
          cityInfo={cityInfo.data}
          onOpenTab={onOpenTab}
        />
      )}

      <CctvSection
        areaName={entry.name}
        origin={{ lat: entry.lat, lng: entry.lng }}
        openStreamUrl={openCctvStreamUrl}
        onToggle={onToggleCctv}
      />

      <NearbyCalmSection exclude={entry.name} onSelectArea={onSelectArea} />
    </div>
  )
}
