import { formatDistance } from '../../domain/distance'
import { kakaoMapSearchUrl } from '../../domain/mapLinks'
import type { NearbyArea } from '../../domain/types'
import { openExternalUrl } from '../../platform/links'
import { CongestionBadge } from '../common/CongestionBadge'
import { Icon } from '../common/Icon'

interface Props {
  readonly area: NearbyArea | null
  readonly onClose: () => void
  readonly onOpenForecast: (name: string) => void
}

// 앱인토스 심사 체크리스트: "미니앱에 진입하자마자 바텀시트가 자동으로 나타나지
// 않아요." 선택된 명소가 없으면 아예 렌더하지 않는다. 시안(stitch_ui/_1)은 시트가
// 열린 채로 그려져 있지만 그대로 옮기면 반려된다.
export function AreaSheet({ area, onClose, onOpenForecast }: Props) {
  if (area === null) {
    return null
  }

  const { entry, snapshot, distanceMeters } = area
  const directionsUrl = kakaoMapSearchUrl(entry.name)

  return (
    // role="dialog"가 아니다. 이 시트는 의도적으로 모달이 아니라서 — 뒤의 지도가
    // 계속 동작한다 — 대화상자라고 알리면 스크린리더 사용자는 포커스 이동과
    // 포커스 가둠을 기대하는데 둘 다 없다. 실제 성격에 맞게 region으로 알린다.
    <section
      role="region"
      aria-label={`${entry.name} 요약`}
      className="pointer-events-auto absolute inset-x-4 bottom-4 z-20 rounded-card border border-outline-variant bg-surface p-4 shadow-floating"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-headline-sm text-on-surface">
              {entry.name}
            </h2>
            <CongestionBadge level={snapshot?.congestion ?? null} />
          </div>
          <p className="mt-1 flex items-center gap-1.5 text-label-md text-on-surface-variant">
            {distanceMeters !== null && (
              <>
                <Icon name="near" className="size-4 text-primary" />
                <span className="font-bold text-primary">
                  {formatDistance(distanceMeters)}
                </span>
              </>
            )}
            <span>{entry.category}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="grid size-10 shrink-0 place-items-center rounded-full text-on-surface-variant"
        >
          <Icon name="back" className="size-5 rotate-90" />
        </button>
      </div>

      {snapshot !== null && (
        <>
          <p className="mt-3 text-body-md text-on-surface">{snapshot.message}</p>
          <p className="mt-2 text-label-sm text-outline">
            {snapshot.observedAtLabel} 기준
          </p>
        </>
      )}

      <div className="mt-4 flex gap-3">
        {/* href를 실제로 채운 <a>로 둔다. 브리지가 없을 때 열 주소가 여기
            남아 있어야 폴백이 성립하고, 스크린리더도 링크로 읽는다. */}
        <a
          href={directionsUrl}
          target="_blank"
          rel="noreferrer"
          onClick={(event) => {
            event.preventDefault()
            void openExternalUrl(directionsUrl)
          }}
          className="flex min-h-12 flex-1 items-center justify-center gap-1.5 rounded-action border border-outline-variant bg-surface-container-lowest text-label-md font-semibold text-on-surface"
        >
          <Icon name="pin" className="size-5" />
          길찾기
        </a>
        <button
          type="button"
          onClick={() => onOpenForecast(entry.name)}
          className="flex min-h-12 flex-1 items-center justify-center gap-1.5 rounded-action bg-primary text-label-md font-semibold text-on-primary"
        >
          <Icon name="forecast" className="size-5" />
          혼잡예보 보기
        </button>
      </div>
    </section>
  )
}
