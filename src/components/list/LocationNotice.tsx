import type { LocationStatus } from '../../hooks/useCurrentLocation'

interface Props {
  readonly status: LocationStatus
  readonly onRetry: () => void
}

// 거부와 그 외 실패를 다르게 안내한다. 전자는 사용자가 풀 수 있고 후자는 아니라서
// 같은 문구를 쓰면 한쪽은 헛수고를 하게 된다.
const NOTICE: Partial<
  Record<LocationStatus, { readonly message: string; readonly action: string }>
> = {
  denied: {
    message: '위치를 허용하면 가까운 곳부터 볼 수 있어요.',
    action: '허용하기',
  },
  unavailable: {
    message: '위치를 확인할 수 없어 혼잡도 낮은 순으로 보여드려요.',
    action: '다시 시도',
  },
}

export function LocationNotice({ status, onRetry }: Props) {
  const notice = NOTICE[status]
  if (notice === undefined) return null

  return (
    <div className="mx-4 flex items-center gap-3 rounded-card bg-surface-container px-4 py-3">
      <p className="min-w-0 flex-1 text-label-md text-on-surface-variant">
        {notice.message}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="min-h-12 shrink-0 rounded-full px-3 text-label-md font-semibold text-primary"
      >
        {notice.action}
      </button>
    </div>
  )
}
