import { formatPopulationTick } from '../../i18n/format'
import { AXIS_TICKS } from '../../domain/forecast'

/**
 * 인원 그래프의 세로축. 위가 최댓값이고 아래가 0이다.
 *
 * **`justify-between`이 아니라 절대 위치다.** flex로 펼치면 글자 상자의 높이만큼
 * 눈금이 안쪽으로 밀려, 「0」이 막대 바닥선보다 위에 뜨고 최댓값은 천장보다 아래에
 * 앉는다(390px 실측에서 눈에 보였다). 각 눈금의 **가운데**가 제 격자선에 와야
 * 하므로 위치를 퍼센트로 주고 절반만큼 끌어올린다.
 *
 * `w-11`은 「4.5만」이 안 접히는 최소 폭이다. **이 값이 가로축 글자의 왼쪽
 * 여백(`pl-13` = `w-11` + `gap-2`)과 짝**이라 한쪽을 고치면 다른 쪽이 어긋난다.
 *
 * 예보 그래프와 24시간 흐름이 나눠 쓴다 — 둘이 같은 축을 그리므로 여기 있는
 * 절대 위치 계산을 두 벌로 두면 한쪽만 낡는다.
 */
export function ChartYAxis({ axisMax }: { readonly axisMax: number }) {
  return (
    <div aria-hidden="true" className="relative h-32 w-11 shrink-0">
      {Array.from({ length: AXIS_TICKS + 1 }, (_, index) => (
        <span
          key={index}
          style={{ top: `${String((index / AXIS_TICKS) * 100)}%` }}
          className="absolute right-0 -translate-y-1/2 whitespace-nowrap text-label-sm leading-none text-outline"
        >
          {formatPopulationTick((axisMax * (AXIS_TICKS - index)) / AXIS_TICKS)}
        </span>
      ))}
    </div>
  )
}
