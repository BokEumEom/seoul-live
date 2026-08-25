import type { CongestionTone } from './congestion'

// 실시간 상권 현황(`LIVE_CMRCL_STTS`). 신한카드 결제를 바탕으로 「지금 이
// 동네가 돌아가고 있나」를 말한다.
//
// **`cityInfo.ts`에 안 넣었다.** 그 파일이 723줄이라 상한(800)에 붙어 있고,
// 상권은 다른 것들과 엮이지 않는 독립된 주제다.
//
// **명소에 따라 통째로 안 온다.** 실호출에서 여의도한강공원은 이 섹션 자체가
// 없었다(2026-08-25). 공원·한강은 결제가 일어나는 곳이 아니라 정상이다 —
// 화면은 그때 탭을 빈 상태로 그린다.

/** 업종 한 줄. `CMRCL_RSB`의 항목이다(명세 222~229행). */
export interface CommerceCategory {
  /** RSB_LRG_CTGR — 대분류. 실호출 8곳에서 다섯 종만 봤다 */
  readonly major: string
  /** RSB_MID_CTGR — 중분류. 같은 표본에서 열한 종 */
  readonly minor: string
  /** RSB_PAYMENT_LVL — 지역 지표와 같은 네 단계 */
  readonly level: string
  /** RSB_SH_PAYMENT_CNT — 결제 건수 */
  readonly paymentCount: number | null
  /** RSB_SH_PAYMENT_AMT_MIN/MAX — 결제 금액 구간(원) */
  readonly paymentMin: number | null
  readonly paymentMax: number | null
  /** RSB_MCT_CNT — 가맹점 수 */
  readonly storeCount: number | null
  /** RSB_MCT_TIME — 가맹점 수의 기준 년월(`202607`) */
  readonly storeCountAt: string
}

export interface Commerce {
  /** AREA_CMRCL_LVL — 한산한/보통/분주한/바쁜 */
  readonly level: string
  /** AREA_SH_PAYMENT_CNT — 이 명소 전체의 결제 건수 */
  readonly paymentCount: number | null
  /** AREA_SH_PAYMENT_AMT_MIN/MAX — 결제 금액 구간(원) */
  readonly paymentMin: number | null
  readonly paymentMax: number | null
  readonly categories: readonly CommerceCategory[]
  /** CMRCL_MALE_RATE / CMRCL_FEMALE_RATE */
  readonly maleRate: number | null
  readonly femaleRate: number | null
  /** CMRCL_10_RATE ~ CMRCL_60_RATE. **여섯 칸이다**(인구 구성은 여덟 칸) */
  readonly ageRates: readonly number[]
  /** CMRCL_PERSONAL_RATE / CMRCL_CORPORATION_RATE */
  readonly personalRate: number | null
  readonly corporationRate: number | null
  /** CMRCL_TIME — `20260825 1340` 꼴. 형식을 강제하지 않는다 */
  readonly updatedAt: string
}

/**
 * 소비 연령 여섯 칸의 이름. **인구 구성의 여덟 칸과 다르다** — 양끝이
 * 「이하」·「이상」으로 묶여 있다(명세 232·237행의 설명 그대로다).
 *
 * 도메인은 한국어 값만 주고 화면이 `t()`로 감싼다.
 */
export const COMMERCE_AGE_LABELS: readonly string[] = [
  '10대 이하',
  '20대',
  '30대',
  '40대',
  '50대',
  '60대 이상',
]

/**
 * 성별·결제주체 막대의 칸 이름. **화면이 아니라 여기 둔다** — 데이터의 모양을
 * 말하는 값이고, 화면 파일에 두면 `i18n.test.ts`의 「감싸지 않은 한국어」 검사가
 * 잡는다(2026-08-25에 실제로 잡혔다). 그 검사가 옳다: 화면 상수가 아니라
 * 도메인 어휘라 `AGE_LABELS`와 같은 자리에 있어야 한다.
 */
export const COMMERCE_GENDER_LABELS: readonly string[] = ['남성', '여성']
export const COMMERCE_PAYER_LABELS: readonly string[] = ['개인', '법인']

/**
 * 상권 지표의 톤. 혼잡도 네 톤을 그대로 쓴다.
 *
 * **네 값을 실호출로 확인했다**(2026-08-25, 명소 7곳): `한산한`(가락시장) ·
 * `보통`(쌍문역·청담동) · `분주한`(광화문) · `바쁜`(강남역·홍대·북촌).
 * 명세에는 값 목록이 없어서 **이 넷이 전부라고 단언할 수는 없고**, 도로 지표와
 * 같이 표에 없는 값은 `null`이라 색이 안 붙을 뿐 틀리지 않는다.
 *
 * 순서의 근거도 표본이다 — 서울에서 가장 붐비는 상권(강남역·홍대)이 `바쁜`이고
 * 도매시장 한낮이 `한산한`이었다.
 *
 * **혼잡도와 같은 표를 쓰는 이유**: 한 화면에서 「바쁜」과 「붐빔」이 다른
 * 빨강이면 두 값이 무관해 보인다. 실제로는 같은 질문의 다른 각도다 — 사람이
 * 많은가(혼잡도) / 돈이 도는가(상권).
 */
const TONE_BY_COMMERCE_LEVEL: Readonly<Record<string, CongestionTone>> = {
  한산한: 'calm',
  보통: 'normal',
  분주한: 'busy',
  바쁜: 'crowded',
}

export function commerceLevelTone(level: string): CongestionTone | null {
  return TONE_BY_COMMERCE_LEVEL[level.trim()] ?? null
}

/** 사전과 검사가 같은 목록을 보게 한다. 단계가 하나 늘면 양쪽이 함께 죽는다. */
export const COMMERCE_LEVELS: readonly string[] = Object.keys(TONE_BY_COMMERCE_LEVEL)

/**
 * 그릴 것이 있나. **`level`만으로는 부족하다** — 섹션이 왔는데 값이 전부 빈
 * 경우가 있고, 그때 제목만 있는 빈 탭을 그리게 된다.
 *
 * 이 술어가 「그릴 게 있나」의 유일한 소유자다(`hasReadableComposition`과 같은
 * 규칙). 화면마다 다시 판정하면 판정이 갈린다.
 */
export function hasReadableCommerce(commerce: Commerce): boolean {
  return (
    commerce.level !== '' ||
    commerce.paymentCount !== null ||
    commerce.categories.length > 0 ||
    commerce.ageRates.some((rate) => rate > 0) ||
    (commerce.maleRate ?? 0) > 0 ||
    (commerce.femaleRate ?? 0) > 0
  )
}

/**
 * 결제 금액을 억/만 단위로 접는다. **완성된 글자가 아니라 숫자와 단위를 준다** —
 * 도메인이 「4.5억」을 지으면 영어 화면에서 그 줄만 한국어로 남는다
 * (`forecastHour`와 같은 규칙).
 *
 * 서울 API가 구간으로 주므로 **최소값을 쓴다.** 「4.5억~5.0억」을 그대로 적으면
 * 한 줄이 두 배로 길어지는데, 이 값이 답하는 것은 「대략 얼마나 도나」이지
 * 정확한 액수가 아니다. 최소값이면 적어도 **넘겨 말하지는 않는다.**
 */
export type MoneyScale = 'billion' | 'tenThousand' | 'won'

export function scaleMoney(
  won: number | null,
): { readonly value: number; readonly scale: MoneyScale } | null {
  if (won === null || won < 0) {
    return null
  }
  if (won >= 100_000_000) {
    // 소수 한 자리. 「4억」보다 「4.5억」이 실제로 쓸모 있는 해상도다.
    return { value: Math.round((won / 100_000_000) * 10) / 10, scale: 'billion' }
  }
  if (won >= 10_000) {
    return { value: Math.round(won / 10_000), scale: 'tenThousand' }
  }
  return { value: won, scale: 'won' }
}
