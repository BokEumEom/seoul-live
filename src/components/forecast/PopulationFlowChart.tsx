import { t } from '../../i18n/t'
import { congestionTone } from '../../domain/congestion'
import { niceAxisMax } from '../../domain/forecast'
import {
  flowPeaks,
  hasUsualCurve,
  type PopulationFlow,
  type PopulationFlowSlot,
} from '../../domain/populationFlow'
import { TONE_FILL_CLASS } from '../common/toneClass'
import { ChartYAxis } from './ChartYAxis'

interface Props {
  readonly flow: PopulationFlow
}

/**
 * 24시간 인파 흐름 — **과거 12시간 + 지금 + 예보 12시간**에 최근 4주 평균을
 * 겹친다. 서울 인파레이더 상세의 그 그래프다.
 *
 * **`ForecastChart`가 못 하던 것이다.** 저쪽 주석이 「그쪽은 24시간에 어제
 * 곡선을 겹치는데 **둘 다 못 한다** — 서울 API의 요청 인자에 날짜가 없어 과거를
 * 조회할 방법이 없다」고 적어 뒀는데, 그 전제가 공식 API에만 해당했다.
 * 인증키를 안 쓰는 SeoulRtd 쪽은 과거를 준다(`domain/populationFlow.ts`).
 *
 * **저쪽을 지우지 않았다.** 이 상류는 문서화된 API가 아니라 조용히 깨지는데,
 * 그때 폴백이 없으면 인구 탭의 그래프가 통째로 사라진다. 오른쪽 절반(예보 12칸)이
 * 공식 API와 **인원·등급 96/96 일치**라(2026-08-27 실측 8곳) 폴백으로 떨어져도
 * 곡선이 달라지지 않는다. 고르는 자리는 `PopulationFlowSection`이다.
 */
export function PopulationFlowChart({ flow }: Props) {
  const axisMax = niceAxisMax(Math.max(...flowPeaks(flow)))
  const slots = flow.slots
  const withUsual = hasUsualCurve(flow)

  // 가로축 글자를 전부 적으면 25칸이 겹친다. 넷 걸러 하나만 눈에 보이고, 소리로는
  // 막대마다 제 시각이 붙어 있다(`ForecastChart`와 같은 규칙, 간격만 다르다).
  const showLabel = (index: number): boolean =>
    index === flow.nowIndex || index % 4 === 0

  return (
    <div>
      <div className="mt-3 flex gap-2">
        <ChartYAxis axisMax={axisMax} />

        {/* **막대와 곡선이 같은 상자를 쓴다.** 곡선은 이 상자를 꽉 채우는 SVG라
            좌표계가 막대와 정확히 겹친다 — 따로 두면 여백 한 픽셀 차이로 어긋난다. */}
        <div className="relative h-32 flex-1">
          {/* 예보 구간의 바탕. **이미 일어난 일과 아직 아닌 일을 가른다** —
              막대 색은 혼잡도가 쓰고 있어서 다른 채널이 필요하다. `nowIndex`
              다음 칸부터 오른쪽 끝까지다. */}
          {flow.nowIndex !== null && (
            <div
              aria-hidden="true"
              style={{ left: `${(((flow.nowIndex + 1) / slots.length) * 100).toFixed(2)}%` }}
              className="absolute inset-y-0 right-0 rounded-xs bg-surface-container-low"
            />
          )}

          {/* `ul`인 이유는 스크린리더가 「목록, 25개 항목」으로 먼저 규모를
              알려주기 때문이다 — 그래프에는 그런 안내가 없다.

              **`gap`이 없다.** `ForecastChart`는 `gap-px`인데 여기서는 곡선이
              막대 가운데를 지나야 해서, 간격이 있으면 SVG 좌표(`i + 0.5`)와
              실제 가운데가 오른쪽으로 갈수록 벌어진다(25칸이면 24px). 붙여 두면
              색이 바뀌는 자리가 곧 경계라 칸이 여전히 읽힌다. */}
          <ul className="relative flex size-full items-end border-b border-outline-variant">
            {slots.map((slot, index) => (
              <FlowBar
                key={index}
                slot={slot}
                axisMax={axisMax}
                current={index === flow.nowIndex}
                forecast={flow.nowIndex !== null && index > flow.nowIndex}
              />
            ))}
          </ul>

          {withUsual && <UsualCurve slots={slots} axisMax={axisMax} />}
        </div>
      </div>

      {/* 가로축 글자. 왼쪽 여백은 세로축 폭 `w-11` + 사이 간격 `gap-2`의 합이다. */}
      <div aria-hidden="true" className="mt-1 flex pl-13">
        {slots.map((slot, index) => (
          <span
            key={index}
            className={`flex-1 whitespace-nowrap text-center text-label-sm ${
              index === flow.nowIndex
                ? 'font-semibold text-on-surface'
                : 'text-on-surface-variant'
            }`}
          >
            {showLabel(index) ? hourLabel(slot, index === flow.nowIndex) : ''}
          </span>
        ))}
      </div>

      {withUsual && (
        // **곡선이 무엇인지 글자로 말한다.** 점선은 그림이라 혼자서는 아무것도
        // 뜻하지 않고, 이 그래프의 값은 「오늘 대 평소」의 견줌에 있다.
        <p className="mt-2 flex items-center gap-1.5 text-label-sm text-on-surface-variant">
          <span aria-hidden="true" className="h-0 w-5 border-t-2 border-dashed border-outline" />
          {t('점선은 최근 4주 같은 요일의 평균이에요')}
        </p>
      )}
    </div>
  )
}

function hourLabel(slot: PopulationFlowSlot, current: boolean): string {
  if (current) {
    return t('지금')
  }
  return slot.hour === null ? '' : t('{시}시', { 시: slot.hour })
}

function FlowBar({
  slot,
  axisMax,
  current,
  forecast,
}: {
  readonly slot: PopulationFlowSlot
  readonly axisMax: number
  readonly current: boolean
  readonly forecast: boolean
}) {
  const height = slot.people === null ? 0 : (slot.people / axisMax) * 100
  const spokenTime = current
    ? t('지금')
    : slot.hour === null
      ? ''
      : t('{시}시', { 시: slot.hour })

  return (
    <li
      // 「지금」을 의미 채널로도 짚는다 — `ForecastChart`·`WeeklyPatternCard`와
      // 같은 값이다.
      aria-current={current ? 'time' : undefined}
      // **`relative z-10`이 없으면 테두리가 반만 보인다.** 칸이 붙어 있어서
      // (`gap`이 없다) 다음 막대가 나중에 그려지며 오른쪽 테두리를 덮는다 —
      // 실제로 왼쪽만 남은 세로선처럼 보였다.
      className={`flex h-full flex-1 flex-col justify-end ${current ? 'relative z-10' : ''}`}
    >
      <div
        data-bar
        data-height={height.toFixed(2)}
        style={{ height: `${height.toFixed(2)}%` }}
        // 혼잡도를 모르면 색을 안 쓴다 — 틀린 색은 없는 색보다 나쁘다.
        className={`${
          slot.congestion === null
            ? 'bg-surface-container-high'
            : TONE_FILL_CLASS[congestionTone(slot.congestion)]
        } ${
          // 지금 막대만 테두리로 짚는다. 색을 바꾸면 그 시각의 혼잡도를 못
          // 읽게 되므로 **다른 채널**을 쓴다.
          //
          // **`ring-inset`이 아니다.** `ForecastChart`는 안쪽에 그리는데 저기는
          // 막대가 21px이라 견딘다(390px 실측). 여기는 25칸이라 한 칸이 10px
          // 남짓이고, 안쪽으로 2px씩 물리면 채움이 6px만 남아 **검은 막대처럼
          // 보인다**(실제로 그렇게 보였다). 바깥에 그리면 채움을 안 먹는다.
          current ? 'ring-2 ring-on-surface' : ''
        }`}
      />
      {/* **곡선은 그림이라 소리 채널에 안 실린다.** 평소 값을 여기 함께 넣어야
          「오늘 대 평소」가 그래프를 못 보는 사용자에게도 남는다. */}
      <span className="sr-only">
        {spokenTime} {slot.congestion === null ? '' : t(slot.congestion)}{' '}
        {slot.people === null
          ? t('인원 정보 없음')
          : t('약 {인원}명', { 인원: slot.people.toLocaleString() })}
        {slot.usual !== null &&
          `, ${t('평소 약 {인원}명', { 인원: slot.usual.toLocaleString() })}`}
        {forecast ? `, ${t('예상')}` : ''}
      </span>
    </li>
  )
}

/**
 * 최근 4주 평균 곡선.
 *
 * **`viewBox`가 칸 수 × 100이고 `preserveAspectRatio="none"`이다.** 그러면 x는
 * 칸 번호, y는 퍼센트가 되어 좌표 계산에 픽셀이 안 들어온다 — 이 상자의 실제
 * 폭을 몰라도 된다는 뜻이다. `ForecastChart`가 SVG를 피한 이유(글자가 찌그러진다)는
 * 여기 해당하지 않는다: **이 SVG에는 글자가 없다.** 선 굵기만
 * `vector-effect="non-scaling-stroke"`로 찌그러짐에서 뺀다.
 *
 * 값이 없는 칸에서는 **선을 끊는다.** 이어 버리면 없는 값을 있는 것처럼 가로지른다.
 */
function UsualCurve({
  slots,
  axisMax,
}: {
  readonly slots: readonly PopulationFlowSlot[]
  readonly axisMax: number
}) {
  const runs: string[][] = []
  let run: string[] = []
  slots.forEach((slot, index) => {
    if (slot.usual === null) {
      if (run.length > 0) runs.push(run)
      run = []
      return
    }
    const y = 100 - (slot.usual / axisMax) * 100
    run.push(`${String(index + 0.5)},${y.toFixed(2)}`)
  })
  if (run.length > 0) runs.push(run)

  return (
    <svg
      aria-hidden="true"
      viewBox={`0 0 ${String(slots.length)} 100`}
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-0 size-full text-outline"
    >
      {runs
        // 점 하나는 선이 아니다. 그려도 아무것도 안 보이므로 뺀다.
        .filter((points) => points.length >= 2)
        .map((points) => (
          <polyline
            key={points[0]}
            points={points.join(' ')}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeDasharray="4 3"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        ))}
    </svg>
  )
}
