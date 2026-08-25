import { subwayLineBadge } from '../../domain/subwayLine'
import { subwayLineText } from '../../i18n/subway'

interface Props {
  /** 서울이 준 값 그대로. 「3호선」·「공항철도」 */
  readonly line: string
}

/**
 * 노선 동그라미. 시안 `stitch_ui_ux/_4`의 「⑤ 광화문역」에서 앞의 알약이다.
 *
 * **글자보다 색이 먼저 읽힌다.** 예전에는 역 이름 옆에 「3호선」을 작은 회색
 * 글자로 적었는데, 지하철을 색으로 외우는 곳에서 그건 한 번 더 읽어야 하는
 * 표기다 — 노선색은 역 표지에도 노선도에도 있고 사용자가 이미 아는 기호다.
 *
 * **그렇다고 색만으로 말하지 않는다.** 숫자·이름이 배지 안에 그대로 있고
 * (색각 이상이면 3호선 주황과 6호선 갈색이 같아 보인다), 소리 쪽에는
 * `aria-label`로 「3호선」이 통째로 간다.
 *
 * **모르는 노선이면 `null`이다.** 회색 동그라미를 그리면 「색이 없는 노선」이라는
 * 없는 분류가 생긴다. 부르는 쪽이 옛 글자 표기로 돌아간다 —
 * `SubwayArrivals`가 그 자리다.
 */
export function SubwayLineBadge({ line }: Props) {
  const badge = subwayLineBadge(line)

  if (badge === null) {
    return null
  }

  return (
    <span
      role="img"
      aria-label={subwayLineText(line)}
      // **`style`로 칠한다.** 노선색은 우리 배색이 아니라 서울교통공사의
      // 자산이라 `index.css`의 토큰이 아니다 — 근거는 `domain/subwayLine.ts`.
      style={{ backgroundColor: badge.color, color: badge.ink }}
      // 숫자 하나면 `min-w-6`가 정원을 만들고, 「공항철도」면 좌우로 늘어난다.
      className="inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full px-1.5 text-label-sm font-bold"
    >
      {badge.label}
    </span>
  )
}
