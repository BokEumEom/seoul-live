import { t } from '../../i18n/t'

/**
 * 순위별 농도. **1등이 가장 진하다.**
 *
 * 예전에는 자리로 칠했다(20~30대가 늘 가장 진했다). 그 규칙은 「어느 층이
 * 많은지 색으로 읽힌다」를 목표로 삼았으면서 **실제로는 나이만 말했다** —
 * 50대가 가장 많은 명소에서 20대가 더 진하게 그려졌다. 순위로 칠하면 색과
 * 막대 길이가 같은 말을 한다.
 *
 * **칸 수와 길이가 묶여 있지 않다** — 인구는 여덟 칸이고 상권은 여섯 칸이며
 * 구간이 늘 수도 있다. 칸이 색보다 많으면 색 없는 막대가 조용히 생기므로
 * 아래 `rankClass`가 끝 값으로 떨어뜨리고 `ShareRows.test.tsx`의 「칸이 늘어도」가
 * 잠근다.
 *
 * **동적 클래스 금지라 리터럴 배열이다.** `bg-primary/${n}`으로 지으면
 * Tailwind가 그 클래스를 안 만든다.
 */
const RANK_CLASS: readonly string[] = [
  'bg-primary',
  'bg-primary/80',
  'bg-primary/70',
  'bg-primary/60',
  'bg-primary/50',
  'bg-primary/40',
  'bg-primary/30',
  'bg-primary/20',
]

function rankClass(rank: number): string {
  return RANK_CLASS[Math.min(rank, RANK_CLASS.length - 1)]
}

/**
 * 「31%」·「<1%」. **반올림이 0을 만드는 칸을 0이라고 적지 않는다.**
 *
 * `t()`로 감싸지 않는다 — 숫자와 기호뿐이라 옮길 글자가 없다. 「1% 미만」이라고
 * 쓰면 36px 칸에 안 들어가고, 그 자리를 넓히면 여덟 줄의 막대가 그만큼 짧아진다.
 */
function percentLabel(rate: number): string {
  const rounded = Math.round(rate)
  return rounded === 0 ? '<1%' : `${String(rounded)}%`
}

interface Props {
  /** 칸마다의 백분율. `labels`와 차례가 같아야 한다 */
  readonly rates: readonly number[]
  /** 칸 이름(한국어 키). 화면이 `t()`로 감싼다 */
  readonly labels: readonly string[]
  /**
   * 목록의 접근성 이름. 이미 `t()`를 지난 글자다.
   *
   * **한 카드에 목록이 여럿일 때 필요하다** — 상권 카드에는 업종 목록과 이
   * 목록이 함께 있어서, 이름이 없으면 목록 단위로 훑는 사용자에게 둘 다
   * 「목록, 항목 5개」로만 들린다.
   */
  readonly title: string
}

/**
 * 구성비를 줄로 편 것. 시안 `stitch_ui_ux/_3`의 「연령대별 비율」과 `_8`의
 * 「연령대별 비율」이 같은 모양이다.
 *
 * ```
 * 10대  [▓▓░░░░░░░░]  15%
 * 20대  [▓▓▓▓▓▓░░░░]  35%
 * ```
 *
 * **인구 탭과 상권 탭이 나눠 쓴다.** 칸 수가 여덟과 여섯으로 다르지만 규칙은
 * 하나도 안 다르다 — 아래 성질들이 「연령」이 아니라 「구성비」의 성질이라서다.
 *
 * **한 막대에 여러 칸을 쌓던 것을 여러 줄로 폈다.** 쌓은 막대는 전체가 100%가
 * 되는 것을 보여 주지만 **각 칸의 크기를 서로 견주기 어렵다** — 시작점이 칸마다
 * 달라서다. 줄로 펴면 모든 막대가 같은 왼쪽에서 시작해 길이가 곧 비교가 된다.
 * 시안이 그렇게 그렸고, 그 편이 「어느 층이 많나」에 곧바로 답한다.
 *
 * **막대 길이가 곧 백분율이다**(15% → 트랙의 15%). 최댓값에 맞춰 늘리면 막대가
 * 꽉 차 보여서 「이 명소는 20대가 전부」로 읽히는데, 실제로는 35%다.
 *
 * **0인 칸은 줄을 안 만든다.** 0은 「실제로 0%」가 아니라 「읽지 못함」일 수
 * 있는데(`compositionSchema.ts`의 `rate()`), 줄을 그리면 화면과 스크린리더가
 * 둘 다 「60대 0%」라고 **단정**하게 된다. 쌓은 막대 시절에는 그 칸을 말없이
 * 비우고 이름만 빼서 같은 규칙을 지켰다 — 줄로 펴면 글자가 곧 줄이라 줄째로
 * 빼는 것이 그 규칙의 같은 얼굴이다.
 *
 * **문턱을 두지 않는다.** 옛 상권 막대(`ShareBar`)는 10% 미만인 칸의 이름을
 * 아예 안 적었다 — 화면에는 색만 남고 「50대+ 7%」가 어디에도 없었다. 작은
 * 값은 작게 그리면 되지, 지워야 할 이유가 없다.
 *
 * **반올림이 그 규칙을 뚫는다.** 실호출의 광화문 `PPLTN_RATE_0`가 `0.4`인데
 * 그대로 반올림하면 「0~9세 0%」가 된다 — 사람이 있는 칸을 없다고 적는 것이라
 * 위와 정확히 같은 거짓이다. 헤드리스 화면에서 실제로 그렇게 떴다(2026-08-25).
 * 그래서 1% 미만은 `<1%`로 적는다. 줄을 빼지 않는 이유는 「어린이가 거의 없다」가
 * 그 자체로 정보이기 때문이다.
 */
export function ShareRows({ rates, labels, title }: Props) {
  // 순위표. 값이 같으면 앞 칸이 먼저다 — 어느 쪽이든 색이 하나는 붙는다.
  const ranked = [...rates.keys()].sort((left, right) => rates[right] - rates[left])
  const rankOf = new Map(ranked.map((index, rank) => [index, rank]))
  const top = ranked[0]
  // 자리를 유지한 채 거른다. `filter` 뒤에 `map`하면 인덱스가 밀려 이름과
  // 값이 어긋난다 — 「20대」 줄에 30대의 비율이 붙는 종류의 버그다.
  const visible = [...rates.keys()].filter((index) => rates[index] > 0)

  return (
    // role="list"를 명시하는 이유: preflight의 list-style:none이 WebKit에서
    // 목록 시맨틱을 지운다. 토스 iOS 웹뷰가 WebKit이다.
    <ul role="list" aria-label={title} className="mt-3 flex flex-col gap-2">
      {visible.map((index) => (
        // `key`는 감싸지 않은 값이다 — 언어가 바뀔 때 키까지 바뀌면 React가
        // 같은 줄을 지웠다 새로 만든다.
        <li key={labels[index]} className="flex items-center gap-2">
          {/* **너비가 고정이다.** 이름이 길어지는 만큼 막대가 밀리면 줄마다
              시작점이 달라져 길이를 견줄 수가 없다 — 줄로 편 이유가 사라진다.
              `w-16`은 이 앱에서 가장 긴 이름(상권의 「60대 이상」)이 한 줄에
              드는 폭이다. `w-12`였을 때 그 이름이 두 줄로 접혀 그 줄만 키가
              두 배가 됐다(2026-08-25 헤드리스 화면). */}
          <span className="w-16 shrink-0 text-right text-label-sm text-on-surface-variant">
            {t(labels[index])}
          </span>
          {/* 트랙은 장식이다. 값은 양옆의 글자가 이미 말한다 — 막대에 이름을
              또 붙이면 스크린리더가 여덟 줄을 두 번씩 읽는다. */}
          <span
            aria-hidden="true"
            className="h-2 flex-1 overflow-hidden rounded-full bg-surface-container"
          >
            <span
              className={`block h-full rounded-full ${rankClass(rankOf.get(index) ?? 0)}`}
              // **`shareWidths`를 안 쓴다.** 저쪽은 한 막대에 여러 칸을 쌓을 때
              // 분모를 맞추는 규칙이고, 여기는 줄마다 제 트랙을 갖는다 —
              // 「이 층이 전체의 몇 %인가」가 곧 길이다. 합이 100을 넘게 와도
              // 각 줄은 제 값만 그리므로 트랙 밖으로 나가지 않게만 막는다.
              style={{ width: `${String(Math.min(rates[index], 100))}%` }}
            />
          </span>
          {/* 가장 큰 칸만 굵다. 시안 그대로이고, 여덟 줄을 훑을 때 눈이 멈출
              자리를 하나 준다. */}
          <span
            className={`w-9 shrink-0 text-right text-label-sm ${
              index === top ? 'font-bold text-on-surface' : 'text-on-surface-variant'
            }`}
          >
            {percentLabel(rates[index])}
          </span>
        </li>
      ))}
    </ul>
  )
}
