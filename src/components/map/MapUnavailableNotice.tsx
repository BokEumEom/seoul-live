import { t } from '../../i18n/t'
import { ErrorState } from '../common/ErrorState'

export type MapUnavailableReason = 'no-key' | 'load-failed' | 'offline'

// 두 상황을 같은 문구로 묶지 않는다. 개발자는 "왜 안 뜨지"에서 키를 의심하고
// 사용자는 네트워크를 의심하는데, 문구가 하나면 양쪽 다 엉뚱한 곳을 본다.
// 어느 쪽이든 앱의 나머지는 멀쩡하다는 걸 함께 알린다 — 지도의 실패가 앱
// 전체의 실패로 읽히지 않게.
//
// 살아 있는 것으로 「목록과 검색」을 든다. 예전에는 「내 주변」과 「혼잡예보」였는데
// 둘 다 이제 없는 것을 가리킨다: 「혼잡예보」는 화면이 아니라 명소 상세로
// 녹아들었고, 「내 주변」은 **지도 위에 뜨는 FAB**이 됐다 — 지도가 없는 화면에서
// 지도 위 버튼으로 안내하는 꼴이었다. 목록과 검색은 시트 안에 있어 지도가
// 죽어도 그대로 선다.
// **오프라인은 서비스워커가 생기면서 늘어난 세 번째 상태다.** 예전에는 끊기면
// 화면 자체가 안 떠서 표현할 일이 없었는데, 지금은 셸이 캐시에서 뜨고 목록도
// 마지막 기억으로 서므로 지도만 회색 빈칸으로 남는다.
//
// 「불러오지 못했어요」로 묶지 않았다. 그 문구는 「네트워크 상태를 확인해
// 주세요」로 이어지는데, 끊긴 걸 이미 아는 사용자에게 확인하라는 건 할 일을
// 되돌려주는 것이다. 여기서 해야 할 말은 **끊긴 동안에도 목록은 선다**는 사실이고,
// 그건 마지막 기억이라 시각을 함께 말해야 오해가 없다 — 그 시각은 각 명소 카드의
// 「마지막 업데이트」가 이미 들고 있다.
//
// **상수 표가 아니라 함수인 이유**는 `i18n/t.ts`에 한 벌 있다 — 모듈
// 최상위의 `t()`는 import 시점의 언어로 굳는다.
function message(reason: MapUnavailableReason): string {
  const text: Readonly<Record<MapUnavailableReason, string>> = {
    'no-key':
      t('VITE_GOOGLE_MAPS_API_KEY가 설정되지 않아 지도를 표시할 수 없어요. 아래 목록과 검색은 그대로 쓸 수 있어요.'),
    'load-failed':
      t('지도를 불러오지 못했어요. 네트워크 상태를 확인해 주세요. 아래 목록과 검색은 그대로 쓸 수 있어요.'),
    offline:
      t('오프라인이에요. 연결되면 지도가 다시 나와요. 아래 목록과 검색은 그대로 쓸 수 있어요.'),
  }
  return text[reason]
}

interface Props {
  readonly reason: MapUnavailableReason
}

export function MapUnavailableNotice({ reason }: Props) {
  return (
    <div className="px-4 pt-6">
      <ErrorState message={message(reason)} />
    </div>
  )
}
