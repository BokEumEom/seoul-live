import { ErrorState } from '../common/ErrorState'

export type MapUnavailableReason = 'no-key' | 'load-failed'

// 두 상황을 같은 문구로 묶지 않는다. 개발자는 "왜 안 뜨지"에서 키를 의심하고
// 사용자는 네트워크를 의심하는데, 문구가 하나면 양쪽 다 엉뚱한 곳을 본다.
// 어느 쪽이든 나머지 화면 둘은 정상이라는 걸 함께 알린다 — 지도 탭의 실패가
// 앱 전체의 실패로 읽히지 않게.
const MESSAGE: Readonly<Record<MapUnavailableReason, string>> = {
  'no-key':
    'VITE_GOOGLE_MAPS_API_KEY가 설정되지 않아 지도를 표시할 수 없어요. 「내 주변」과 「혼잡예보」는 그대로 쓸 수 있어요.',
  'load-failed':
    '지도를 불러오지 못했어요. 네트워크 상태를 확인해 주세요. 「내 주변」과 「혼잡예보」는 그대로 쓸 수 있어요.',
}

interface Props {
  readonly reason: MapUnavailableReason
}

export function MapUnavailableNotice({ reason }: Props) {
  return (
    <div className="px-4 pt-6">
      <ErrorState message={MESSAGE[reason]} />
    </div>
  )
}
