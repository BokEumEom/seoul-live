import { Storage } from '@apps-in-toss/web-framework'
import type { PatternCell, WeekPattern } from '../domain/pattern'

/**
 * 저장 봉투. 패턴만 담지 않고 **마지막으로 기록한 관측 시각**을 함께 든다.
 *
 * 없으면 같은 시간대에 상세를 두 번 열 때 같은 관측이 두 번 쌓인다. 평균은
 * 그대로지만(같은 값을 더하고 나누므로) 「몇 번 봤나」가 부풀고, 그 숫자는
 * 화면이 신뢰도로 내놓는 값이다. 세션 안에서만 막으면 새로고침마다 다시
 * 셈해지므로 저장소에 남긴다.
 */
export interface StoredPattern {
  readonly pattern: WeekPattern
  /** 서울 API의 `PPLTN_TIME` 원문. 이 값이 같으면 같은 관측이다. */
  readonly lastObservedAt: string | null
}

// 요일×시간 패턴은 기기에 남는다. 즐겨찾기(`favorites.ts`)와 같은 이유이고 같은
// 폴백이다 — 토스 Storage 브리지를 먼저 쓰고, 브리지가 없는 환경(개발 서버·
// 브라우저·테스트)에서만 localStorage로 떨어진다.
//
// **명소마다 따로 저장한다.** 한 덩어리로 묶으면 명소 하나를 볼 때마다 30곳치를
// 읽고 쓰게 되고, 값이 커질수록 그 비용이 매 조회에 붙는다. 상세는 한 번에 한
// 명소만 본다.
//
// 저장 실패로 화면을 막지 않는다. 패턴은 부가 정보이고, 카드가 비는 것보다
// 상세가 안 뜨는 편이 나쁘다.
export function storageKey(areaName: string): string {
  return `seoul-live:pattern:${areaName}`
}

async function readRaw(key: string): Promise<string | null> {
  try {
    return await Storage.getItem(key)
  } catch {
    // 브리지가 없다. 웹 표준으로 넘어간다.
  }
  return localStorage.getItem(key)
}

async function writeRaw(key: string, value: string): Promise<void> {
  try {
    await Storage.setItem(key, value)
    return
  } catch {
    // 브리지가 없다. 웹 표준으로 넘어간다.
  }
  localStorage.setItem(key, value)
}

// 저장된 값은 지난 버전이 쓴 것일 수도, 사람이 만진 것일 수도 있다. 칸 하나가
// 이상하다고 패턴을 통째로 버리지 않고 **그 칸만** 버린다 — 도시정보 파서가
// 관대한 것과 같은 이유다. 여기서 던지면 상세가 못 뜬다.
function parseCell(value: unknown): PatternCell | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null
  }
  const { rankSum, count } = value as Record<string, unknown>
  if (typeof rankSum !== 'number' || typeof count !== 'number') {
    return null
  }
  // 음수·NaN·소수는 우리가 쓴 값이 아니다. `count`가 0이면 칸이 없는 것과 같다.
  if (!Number.isInteger(rankSum) || !Number.isInteger(count) || rankSum < 0 || count <= 0) {
    return null
  }
  return { rankSum, count }
}

const EMPTY: StoredPattern = { pattern: {}, lastObservedAt: null }

function parseCells(value: unknown): WeekPattern {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return {}
  }
  const entries = Object.entries(value).flatMap(([at, cell]) => {
    const parsed = parseCell(cell)
    return parsed === null ? [] : [[at, parsed] as const]
  })
  return Object.fromEntries(entries)
}

function parse(raw: string | null): StoredPattern {
  if (raw === null) {
    return EMPTY
  }
  const parsed: unknown = JSON.parse(raw)
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return EMPTY
  }
  const { cells, lastObservedAt } = parsed as Record<string, unknown>
  return {
    pattern: parseCells(cells),
    // 이상한 값이면 「기록한 적 없음」으로 둔다. 최악이 관측 하나 더 세는 것이라
    // 여기서 패턴을 버릴 이유가 없다.
    lastObservedAt: typeof lastObservedAt === 'string' ? lastObservedAt : null,
  }
}

export async function loadPattern(areaName: string): Promise<StoredPattern> {
  try {
    return parse(await readRaw(storageKey(areaName)))
  } catch (error) {
    // "쌓인 게 없음"과 "읽지 못함"은 다르다. 전자는 정상이고 후자는 남긴다.
    console.error('방문 패턴을 읽지 못했습니다:', error)
    return EMPTY
  }
}

export async function savePattern(areaName: string, stored: StoredPattern): Promise<void> {
  try {
    await writeRaw(
      storageKey(areaName),
      JSON.stringify({ cells: stored.pattern, lastObservedAt: stored.lastObservedAt }),
    )
  } catch (error) {
    console.error('방문 패턴을 저장하지 못했습니다:', error)
  }
}
