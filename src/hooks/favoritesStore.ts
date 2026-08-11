import { loadFavorites, saveFavorites } from '../platform/favorites'

// 즐겨찾기는 한 화면에서 여러 곳이 동시에 본다 — 홈의 필터 칩, 명소 상세의 별,
// 즐겨찾기 목록. 이들이 각자 상태를 들면 서로 다른 말을 한다. 상세는 명소를
// 누를 때마다 새로 마운트되므로 "토글 시점에 떠 있던 인스턴스에만 알린다"로는
// 부족하다 — 저장이 늦거나 실패하면 새로 뜬 쪽이 옛 값을 본다.
//
// 그래서 값을 모듈에 한 벌만 둔다. useSyncExternalStore가 붙을 자리이고,
// 구독 해제가 subscribe의 반환값으로 드러나 테스트로 잠글 수 있다.

type Listener = () => void

/** 스냅샷은 참조가 안정적이어야 한다 — useSyncExternalStore는 매번 새 배열을
 *  받으면 무한 루프로 죽는다. 읽기 전 상태를 매번 새 `[]`로 만들지 않는다. */
const EMPTY: readonly string[] = Object.freeze([])

/** `null`은 "저장소를 아직 안 읽었다"는 뜻이다. 빈 목록과 구분해야 늦게 온
 *  읽기가 그 사이의 토글을 덮는지 판단할 수 있다. */
let current: readonly string[] | null = null
let loading = false
/** `reset()`이 진행 중인 읽기를 무효화하는 수단. 세대가 다르면 그 읽기는
 *  앞 테스트의 것이다 — 도착해도 버려야 다음 테스트가 제 읽기를 내보낸다. */
let generation = 0
/** 저장을 직렬화하는 큐. 두 곳이 같은 배치에서 토글하면 저장 둘이 await 없이
 *  나가고, 브리지가 순서를 보장하지 않으면 옛 목록이 마지막에 남는다. */
let writing: Promise<void> = Promise.resolve()

const listeners = new Set<Listener>()

export function subscribe(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getSnapshot(): readonly string[] {
  return current ?? EMPTY
}

function emit(): void {
  for (const listener of listeners) {
    listener()
  }
}

/** 저장소를 한 번만 읽는다. 인스턴스마다 불러도 요청은 하나다. */
export function ensureLoaded(): void {
  if (current !== null || loading) {
    return
  }
  loading = true
  const started = generation
  void loadFavorites()
    .then((stored) => {
      // reset() 뒤에 도착한 앞 세대의 읽기는 버린다. 받아들이면 current가
      // 채워져 다음 세대가 제 읽기를 아예 안 내보낸다.
      if (generation !== started) return
      // 읽는 사이에 별을 눌렀으면 그쪽이 이긴다. 늦게 도착한 목록이 방금 담은
      // 곳을 지우면 사용자에게는 별이 눌렸다가 저절로 풀리는 것으로 보인다.
      if (current === null) {
        current = stored
        emit()
      }
    })
    // 둘이 막는 것이 다르다.
    // .catch — 미처리 거절이 새어 나가는 것을 막는다. 단언으로는 못 잡고
    //          vitest의 unhandled-error 채널이 실행 자체를 실패시킨다.
    // .finally — loading을 반드시 푼다. 이게 없으면 loading이 true로 굳어
    //          세션 내내 빈 목록에 갇히고 재시도 경로도 없다.
    // loadFavorites가 스스로 예외를 삼키지만 이 모듈의 정합성을 남의 파일
    // 내부 구현에 걸어 두지 않는다.
    .catch(() => undefined)
    .finally(() => {
      if (generation === started) loading = false
    })
}

export function toggle(name: string): void {
  const base = current ?? EMPTY
  const next = base.includes(name)
    ? base.filter((item) => item !== name)
    : [...base, name]

  // 저장 결과를 기다리지 않고 화면부터 바꾼다. 저장이 막혀도 별은 눌린다.
  current = next
  emit()

  // saveFavorites는 스스로 예외를 삼키지만 큐가 남의 처리에 기대게 두지
  // 않는다 — 체인이 한 번 끊기면 이후 저장이 전부 조용히 사라진다.
  writing = writing.then(() => saveFavorites(next)).catch(() => undefined)
}

/** 테스트 격리용. 모듈에 값이 남으면 앞 테스트의 즐겨찾기가 다음으로 샌다.
 *  프로덕션 경로에서는 부르지 않는다. */
export function reset(): void {
  generation += 1
  current = null
  loading = false
  writing = Promise.resolve()
  listeners.clear()
}
