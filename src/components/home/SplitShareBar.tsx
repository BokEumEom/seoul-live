import { t } from '../../i18n/t'
import { shareWidths } from '../../domain/share'

interface Props {
  /** 왼쪽 칸 이름(한국어 키). 화면이 `t()`로 감싼다 */
  readonly leftLabel: string
  readonly leftValue: number
  readonly rightLabel: string
  readonly rightValue: number
  /** 막대의 접근성 이름 앞에 붙는 말. 이미 `t()`를 지난 글자다 */
  readonly title: string
}

/**
 * 두 칸짜리 비율 막대. 시안 `stitch_ui_ux/_3`의 「성별 비율」 모양이다.
 *
 * ```
 * 남성 48%              52% 여성
 * [██████████░░░░░░░░░░░]
 * ```
 *
 * **양쪽 끝에 이름을 두는 것이 이 모양의 요점이다.** 예전에는 「남 48% · 여 52%」
 * 알약 하나였는데, 그러면 두 값이 글자로만 있고 **크기를 눈으로 견줄 수가 없다.**
 * 막대가 그 일을 하고 이름이 각자 제 칸 쪽에 붙는다.
 *
 * **시안의 주황(tertiary)을 안 쓴다.** 이 배색에서 `tertiary`는 혼잡도
 * 「약간 붐빔」과 **같은 값**이다(`--color-tertiary-container`와 `--color-busy`가
 * 둘 다 `#c55500`). 그대로 쓰면 여성 칸이 혼잡도 단계처럼 읽힌다. 상권 카드가
 * 같은 문제를 이미 농도로 풀었고(`CommerceCard`의 `GENDER_CLASS`) 여기도 그
 * 방식을 따른다 — 색상이 아니라 **농도**가 두 칸을 가른다.
 *
 * **`ShareBar`와 합치지 않는다.** 저쪽은 칸이 여럿이고 이름이 막대 **아래**에
 * 모여 붙는다. 여기는 둘뿐이라 이름이 양 끝으로 갈라지고, 그 배치가 이
 * 컴포넌트의 전부다.
 */
export function SplitShareBar({
  leftLabel,
  leftValue,
  rightLabel,
  rightValue,
  title,
}: Props) {
  // 폭의 셈은 `domain/share.ts`가 갖는다. 합이 100 미만이면 여백이 남는다 —
  // 한쪽만 읽힌 구성에서 그 한쪽이 막대를 다 차지하지 않게 하는 규칙이다.
  const [leftWidth, rightWidth] = shareWidths([leftValue, rightValue])

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-label-md text-on-surface">
          {t(leftLabel)}
          <b className="font-bold text-primary">{Math.round(leftValue)}%</b>
        </p>
        {/* 오른쪽은 숫자가 먼저다. 시안 그대로이고, 그래야 두 숫자가 막대의
            가운데를 향해 마주 보아 어느 쪽이 큰지가 눈에 바로 들어온다. */}
        <p className="flex items-center gap-1.5 text-label-md text-on-surface">
          <b className="font-bold text-primary">{Math.round(rightValue)}%</b>
          {t(rightLabel)}
        </p>
      </div>

      {/* 막대에는 글자가 없어 스크린리더에 아무것도 안 남는다. 위 두 줄이 같은
          값을 이미 읽어 주므로 이 이름은 **막대가 무엇의 비율인지**만 더한다. */}
      <div
        role="img"
        aria-label={`${title}: ${t(leftLabel)} ${String(Math.round(leftValue))}%, ${t(rightLabel)} ${String(Math.round(rightValue))}%`}
        className="mt-2 flex h-3 overflow-hidden rounded-full bg-surface-container"
      >
        {/* `key`가 없다 — 두 칸이 고정이라 배열이 아니다. 언어가 바뀌어도
            React가 같은 노드를 지웠다 새로 만들 일이 없다. */}
        <span style={{ width: `${String(leftWidth)}%` }} className="bg-primary/60" />
        <span style={{ width: `${String(rightWidth)}%` }} className="bg-primary/25" />
      </div>
    </>
  )
}
