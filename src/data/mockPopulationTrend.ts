import type { PopulationFlowSlot } from '../domain/populationFlow'
import type {
  AreaPopulation,
  PopulationChange,
  PopulationTrend,
} from '../domain/populationTrend'
import { CONGESTION_LEVELS } from '../domain/types'
import { findAreaByName } from './areas'
import { hashAreaName, mixSeed } from './mock'

/**
 * 목업 인파 변화·24시간 흐름. **명소마다 다르고 다시 부르면 같다** — 다른
 * 목업과 같은 규칙이다.
 *
 * **증가와 감소가 둘 다 나와야 한다.** 화살표와 문구가 방향마다 갈리는데
 * (`PopulationTrendCard`), 한쪽만 나오면 다른 쪽을 개발 중에 한 번도 못 본다.
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

const EMPTY_TREND: PopulationTrend = {
  lastHour: { direction: null, percent: null },
  lastThreeHours: { direction: null, percent: null },
  lastMonth: { direction: null, percent: null },
}

/** 실측 25칸. 「지금」은 언제나 한가운데다. */
const FLOW_SLOTS = 25
const FLOW_NOW = 12

/**
 * 24시간 흐름. **하루 모양을 흉내 낸다** — 새벽에 바닥이고 낮에 봉우리다.
 * 난수를 그냥 흩으면 톱니가 나와서 「흐름」이라는 말이 화면에서 성립하지 않고,
 * 평소 곡선과 견주는 것도 뜻을 잃는다.
 *
 * 평소(4주 평균)는 오늘 값 언저리에서 갈린다 — **위아래로 다 갈려야** 「평소보다
 * 많다」와 「적다」를 둘 다 목업으로 볼 수 있다.
 */
function buildFlow(seed: number): readonly PopulationFlowSlot[] {
  // 「지금」이 몇 시인지는 명소마다 다르게 둔다. 자정을 넘는 칸(0시)을 어떤
  // 명소에서는 보고 어떤 명소에서는 안 보게 하려는 것이다.
  const nowHour = mixSeed(seed, TREND_SALT + 3) % 24
  const scale = 2_000 + (mixSeed(seed, TREND_SALT + 4) % 40_000)

  return Array.from({ length: FLOW_SLOTS }, (_, index): PopulationFlowSlot => {
    const hour = (nowHour - FLOW_NOW + index + 48) % 24
    // 14시 언저리가 봉우리, 4시 언저리가 바닥인 종 모양.
    const fromPeak = Math.min(Math.abs(hour - 14), 24 - Math.abs(hour - 14))
    const shape = Math.max(0.08, 1 - fromPeak / 11)
    const jitter = 0.9 + (mixSeed(seed, TREND_SALT * 20 + index) % 21) / 100
    const people = Math.round(scale * shape * jitter)
    const usualJitter = 0.85 + (mixSeed(seed, TREND_SALT * 30 + index) % 31) / 100

    return {
      hour,
      people,
      usual: Math.round(scale * shape * usualJitter),
      // 인원에 비례해 4단계를 고른다. 색과 높이가 따로 놀면 목업이 실데이터와
      // 다른 모양이 된다.
      congestion: CONGESTION_LEVELS[Math.min(3, Math.floor(shape * 4))] ?? null,
    }
  })
}

export function buildMockAreaPopulation(areaName: string): AreaPopulation {
  // 카탈로그에 없는 이름은 빈 값이다. 실제로도 프록시의 허용 목록에 걸린다.
  if (findAreaByName(areaName) === undefined) {
    return { trend: EMPTY_TREND, flow: { slots: [], nowIndex: null } }
  }

  const seed = hashAreaName(areaName)
  // 한 칸만 비운다 — 셋 다 비면 절이 통째로 사라져 「빈 칸」을 못 본다.
  const blankIndex = mixSeed(seed, TREND_SALT) % 15

  return {
    trend: {
      lastHour: changeAt(seed, 0, blankIndex === 0),
      lastThreeHours: changeAt(seed, 1, blankIndex === 1),
      lastMonth: changeAt(seed, 2, blankIndex === 2),
    },
    flow: { slots: buildFlow(seed), nowIndex: FLOW_NOW },
  }
}
