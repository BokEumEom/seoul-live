import type { PopulationChange, PopulationTrend } from '../domain/populationTrend'
import { findAreaByName } from './areas'
import { hashAreaName, mixSeed } from './mock'

/**
 * 목업 인구 대비. **명소마다 다르고 다시 부르면 같다** — 다른 목업과 같은 규칙이다.
 *
 * **증가와 감소가 둘 다 나와야 한다.** 화살표와 문구가 방향마다 갈리는데
 * (`PopulationTrendRow`), 한쪽만 나오면 다른 쪽을 개발 중에 한 번도 못 본다.
 * 실호출 10곳에서도 증가 7곳 · 감소 3곳으로 섞여 있었다(2026-08-27).
 *
 * **한 칸이 빈 경우도 만든다.** 상류가 문서화된 API가 아니라 필드가 예고 없이
 * 빠질 수 있고, 그때 화면이 「↑ 만 있고 숫자가 없는 칸」을 그리지 않는지가
 * 목업으로 보여야 한다. 명소 다섯 곳 중 하나 꼴이다.
 */
const TREND_SALT = 21

/** 실호출 30칸의 폭이 1.6%~58.9%였다. 그 언저리에서 흩는다. */
function changeAt(seed: number, index: number, blank: boolean): PopulationChange {
  if (blank) {
    return { direction: null, percent: null }
  }
  const mixed = mixSeed(seed, TREND_SALT * 10 + index)
  return {
    direction: mixed % 3 === 0 ? 'down' : 'up',
    // 소수 한 자리까지. 실응답이 「7.0%」·「58.9%」처럼 언제나 한 자리다.
    percent: Math.round((1 + (mixed % 580)) / 10 * 10) / 10,
  }
}

export function buildMockPopulationTrend(areaName: string): PopulationTrend {
  // 카탈로그에 없는 이름은 빈 값이다. 실제로도 프록시의 허용 목록에 걸린다.
  if (findAreaByName(areaName) === undefined) {
    return {
      lastHour: { direction: null, percent: null },
      lastThreeHours: { direction: null, percent: null },
      lastMonth: { direction: null, percent: null },
    }
  }

  const seed = hashAreaName(areaName)
  // 한 칸만 비운다 — 셋 다 비면 절이 통째로 사라져 「빈 칸」을 못 본다.
  const blankIndex = mixSeed(seed, TREND_SALT) % 15

  return {
    lastHour: changeAt(seed, 0, blankIndex === 0),
    lastThreeHours: changeAt(seed, 1, blankIndex === 1),
    lastMonth: changeAt(seed, 2, blankIndex === 2),
  }
}
