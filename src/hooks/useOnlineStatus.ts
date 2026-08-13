import { useSyncExternalStore } from 'react'

// 모듈 수준에 두어 신원을 고정한다. `useSyncExternalStore`는 이 함수가 바뀌면
// 구독을 끊고 다시 건다 — 렌더마다 새 함수를 주면 매 렌더 재구독한다.
function subscribe(onChange: () => void): () => void {
  window.addEventListener('online', onChange)
  window.addEventListener('offline', onChange)
  return () => {
    window.removeEventListener('online', onChange)
    window.removeEventListener('offline', onChange)
  }
}

function readOnline(): boolean {
  return navigator.onLine
}

/**
 * 지금 네트워크에 닿는가.
 *
 * **서비스워커가 생기면서 필요해졌다.** 예전에는 끊기면 화면 자체가 안 떠서
 * 「오프라인」이라는 상태를 앱이 표현할 일이 없었다. 지금은 셸이 캐시에서 뜨고
 * 목록도 마지막 기억으로 서므로, **지도만 회색 빈칸으로 남는다.** 그 빈칸이
 * 무엇인지 말해 주려면 앱이 오프라인을 알아야 한다.
 *
 * `navigator.onLine`은 「랜선이 꽂혀 있는가」에 가깝고 인터넷이 실제로 되는지는
 * 모른다 — 거짓 true가 날 수 있다. 그래도 거짓 false는 거의 없어서, **끊겼다고
 * 말할 때는 믿을 수 있다.** 우리가 쓰는 방향이 그쪽이다(안내를 띄울지 말지).
 *
 * **`useState` + `useEffect`가 아니라 `useSyncExternalStore`다.** 브라우저가 들고
 * 있는 값을 구독해 읽는 것이 정확히 이 훅의 용도다. 직접 짜면 「구독을 거는
 * 사이에 상태가 바뀌면?」을 effect 안에서 `setState`로 메워야 하는데, 그건
 * 연쇄 렌더를 부르고 `react-hooks` 린트가 막는다(실제로 막혔다). 여기서는
 * React가 구독 직후 스냅숏을 다시 읽어 그 틈을 알아서 닫는다.
 */
export function useOnlineStatus(): boolean {
  return useSyncExternalStore(subscribe, readOnline)
}
