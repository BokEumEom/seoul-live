import { useEffect, useState } from 'react'
import { observationSlot, recordObservation, type WeekPattern } from '../domain/pattern'
import type { AreaSnapshot } from '../domain/types'
import { loadPattern, savePattern, type StoredPattern } from '../platform/weekPattern'

/** 참조가 안정적이어야 한다 — 매번 새 `{}`를 돌려주면 보는 쪽이 계속 새로 그린다. */
const EMPTY_PATTERN: WeekPattern = Object.freeze({})

interface Loaded {
  /** 어느 명소의 것인가. 이게 없으면 명소를 바꾼 직후 앞 명소의 패턴이 비친다. */
  readonly areaName: string
  readonly stored: StoredPattern
}

/**
 * 이 기기에 쌓인 요일×시간 패턴을 읽고, 새 관측이면 한 칸 더한다.
 *
 * **즐겨찾기와 달리 모듈 스토어를 쓰지 않는다.** `favoritesStore`가 그래야 했던
 * 이유는 한 화면에서 칩·목록·상세가 같은 값을 동시에 보기 때문인데, 패턴은
 * 상세의 카드 한 곳만 본다. 읽는 곳이 하나면 지역 상태로 충분하고, 스토어를
 * 두면 명소마다 다른 값을 담을 그릇을 또 만들어야 한다.
 *
 * 읽기와 기록을 **한 effect에 둔다.** 나누면 스냅샷이 저장소 읽기보다 먼저
 * 도착한 경우 빈 패턴 위에 기록했다가 뒤늦은 읽기가 그걸 덮는다.
 */
export function useWeekPattern(
  areaName: string | undefined,
  snapshot: AreaSnapshot | undefined,
): WeekPattern {
  const [loaded, setLoaded] = useState<Loaded | null>(null)

  useEffect(() => {
    if (areaName === undefined) {
      return
    }
    let cancelled = false

    void (async () => {
      const stored = await loadPattern(areaName)
      // 명소를 빠르게 갈아타면 앞 명소의 읽기가 뒤늦게 도착한다. 그대로 앉히면
      // 다른 명소의 패턴이 이 카드에 뜬다.
      if (cancelled) {
        return
      }
      const slot = snapshot === undefined ? null : observationSlot(snapshot.observedAt)
      // 같은 `PPLTN_TIME`이면 같은 관측이다. 상세를 두 번 열었다고 두 번 세면
      // 평균은 그대로여도 「몇 번 봤나」가 부푼다 — 화면이 신뢰도로 내놓는 값이다.
      if (snapshot === undefined || slot === null || stored.lastObservedAt === snapshot.observedAt) {
        setLoaded({ areaName, stored })
        return
      }
      const next: StoredPattern = {
        pattern: recordObservation(stored.pattern, slot, snapshot.congestion),
        lastObservedAt: snapshot.observedAt,
      }
      setLoaded({ areaName, stored: next })
      // 저장이 늦거나 실패해도 화면은 이미 새 칸을 들고 있다. 패턴은 부가
      // 정보라 저장 결과를 기다려 화면을 막을 이유가 없다.
      await savePattern(areaName, next)
    })()

    return () => {
      cancelled = true
    }
  }, [areaName, snapshot])

  // 읽는 중이거나 명소가 막 바뀐 순간에는 **빈 패턴**이다. 앞 명소의 것을
  // 그대로 두면 다른 곳의 패턴을 이 명소의 것으로 읽게 된다.
  return loaded !== null && loaded.areaName === areaName ? loaded.stored.pattern : EMPTY_PATTERN
}
