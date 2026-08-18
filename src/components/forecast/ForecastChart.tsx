import { formatPopulationTick } from '../../i18n/format'
import { t } from '../../i18n/t'
import { congestionTone } from '../../domain/congestion'
import {
  AXIS_TICKS,
  forecastPopulation,
  niceAxisMax,
  peakForecast,
} from '../../domain/forecast'
import type { AreaSnapshot, CongestionLevel } from '../../domain/types'
import { TONE_FILL_CLASS } from '../common/toneClass'

interface Props {
  readonly snapshot: AreaSnapshot
}

/** 막대 하나가 아는 것 전부. 화면은 이 모양만 그린다. */
interface Bar {
  readonly key: string
  /** 눈에 보이는 가로축 글자. 지금은 시각 대신 「지금」이다. */
  readonly label: string
  readonly congestion: CongestionLevel
  readonly populationMin: number
  readonly populationMax: number
  /** 소리로 읽히는 시각. 「지금」과 「15시」를 가른다. */
  readonly spokenTime: string
  readonly current: boolean
}

// **막대그래프다. 예전에는 혼잡도 4단계를 y축에 그대로 쓴 점선이었다.**
// 그러면 40,000명과 46,000명이 같은 높이가 되어 「어느 시각이 정점인가」를
// 그래프가 말하지 못했다 — 정점을 아는 것이 이 절의 유일한 용도인데도.
// 지금은 높이가 인원, 색이 단계다. 둘을 갈라 두는 값은 명소마다 「붐빔」의
// 절대 인원이 다르다는 데 있다: 남산공원의 붐빔과 강남역의 붐빔은 자릿수가
// 다르고, 그 차이는 높이로만 보인다.
//
// **서울 인파레이더 상세(detail_page_sample.png)를 옮긴 것이다.** 그쪽은
// 24시간(과거+현재+미래)에 어제 곡선을 점선으로 겹치는데 **둘 다 못 한다** —
// 서울 API의 요청 인자에 날짜가 없어 과거를 조회할 방법이 없다. 실데이터에서
// 예보는 12개(12시간)라 이 그래프는 「지금 + 앞으로 12시간」이고, 제목도
// 그렇게 적는다. 「24시간」이라고 쓰면 거짓말이 된다.
//
// SVG를 쓰지 않는다. 막대는 사각형이라 div 높이로 충분하고, SVG로 그리면
// 글자가 `preserveAspectRatio`에 찌그러져(예전 차트가 축 라벨을 밖으로 뺀
// 이유가 그것이다) 시각·인원을 막대 안에 둘 수가 없다. 값을 소리로 내보내려면
// 그 글자가 막대와 같은 요소 안에 있어야 한다.
export function ForecastChart({ snapshot }: Props) {
  if (snapshot.forecasts.length === 0) {
    return (
      <p className="py-8 text-center text-label-md text-on-surface-variant">
        {t('예측 정보가 아직 없어요.')}
      </p>
    )
  }

  // 지금을 맨 앞에 세운다. 예보만 그리면 「지금 대비 앞으로」를 눈으로 못 견준다.
  const bars: readonly Bar[] = [
    {
      key: 'now',
      label: t('지금'),
      congestion: snapshot.congestion,
      populationMin: snapshot.populationMin,
      populationMax: snapshot.populationMax,
      spokenTime: t('지금'),
      current: true,
    },
    ...snapshot.forecasts.map((item) => ({
      key: item.time,
      label: t('{시}시', { 시: item.hour }),
      congestion: item.congestion,
      populationMin: item.populationMin,
      populationMax: item.populationMax,
      spokenTime: t('{시}시', { 시: item.hour }),
      current: false,
    })),
  ]

  const axisMax = niceAxisMax(Math.max(...bars.map(forecastPopulation)))
  const peak = peakForecast(snapshot.forecasts)

  // 가로축 글자를 전부 적으면 좁은 시트에서 겹친다. 「지금」과 세 칸 걸러
  // 하나만 눈에 보이고, 소리로는 막대마다 제 시각이 붙어 있다.
  const showLabel = (index: number): boolean => index === 0 || index % 3 === 0

  return (
    <div>
      {peak !== null && (
        // 그래프를 볼 수 없는 사용자에게는 이 한 줄이 그래프를 **대신하고**,
        // 볼 수 있는 사용자에게는 결론을 먼저 준다. 샘플에도 같은 자리에 있다.
        // **한 문장으로 둔다.** 예전에는 시각만 굵게 하려고 셋으로 쪼개져
        // 있었는데(「앞으로는」 + 시각 + 「에 가장 붐빌 전망이에요」), 영어는
        // 어순이 달라 그 조각들을 다시 이을 수가 없다. 굵기를 잃는 대신
        // 어느 언어에서도 문장이 성립한다.
        <p className="text-body-sm text-on-surface-variant">
          {t('앞으로는 {시}시에 가장 붐빌 전망이에요 ({단계})', {
            시: peak.hour,
            단계: t(peak.congestion),
          })}
        </p>
      )}

      <div className="mt-3 flex gap-2">
        {/* 세로축. 위가 최댓값이고 아래가 0이다.
            **`justify-between`이 아니라 절대 위치다.** flex로 펼치면 글자
            상자의 높이만큼 눈금이 안쪽으로 밀려, 「0」이 막대 바닥선보다 위에
            뜨고 최댓값은 천장보다 아래에 앉는다(390px 실측에서 눈에 보였다).
            각 눈금의 **가운데**가 제 격자선에 와야 하므로 위치를 퍼센트로 주고
            절반만큼 끌어올린다. `w-11`은 「4.5만」이 안 접히는 최소 폭이다. */}
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

        {/* 막대들. `ul`인 이유는 스크린리더가 「목록, 5개 항목」으로 먼저
            규모를 알려주기 때문이다 — 그래프에는 그런 안내가 없다. */}
        <ul className="flex h-32 flex-1 items-end gap-px border-b border-outline-variant">
          {bars.map((bar) => {
            const height = (forecastPopulation(bar) / axisMax) * 100
            return (
              <li
                key={bar.key}
                // 「지금」을 의미 채널로도 짚는다. 테두리는 눈에만 보이고,
                // `WeeklyPatternCard`가 지금 시간대 열에 쓰는 것과 같은 값이다.
                aria-current={bar.current ? 'time' : undefined}
                className="flex h-full flex-1 flex-col justify-end"
              >
                <div
                  data-bar
                  data-height={height.toFixed(2)}
                  style={{ height: `${height.toFixed(2)}%` }}
                  className={`rounded-t-xs ${TONE_FILL_CLASS[congestionTone(bar.congestion)]} ${
                    // 지금 막대만 테두리로 짚는다. 색을 바꾸면 그 시각의
                    // 혼잡도를 못 읽게 되므로 **다른 채널**을 쓴다.
                    bar.current ? 'ring-2 ring-on-surface ring-inset' : ''
                  }`}
                />
                {/* **소리로만 나가는 줄도 화면 언어를 따른다.** 「명」과
                    `ko-KR`이 박혀 있어 영어 화면에서 이 줄만 한국어로
                    남았는데, 눈으로는 보이지 않아 알 길이 없었다. */}
                <span className="sr-only">
                  {bar.spokenTime} {t(bar.congestion)}{' '}
                  {t('{최소}~{최대}명', {
                    최소: bar.populationMin.toLocaleString(),
                    최대: bar.populationMax.toLocaleString(),
                  })}
                </span>
              </li>
            )
          })}
        </ul>
      </div>

      {/* 가로축 글자. 막대와 같은 flex 규칙을 써야 칸이 어긋나지 않는다.
          왼쪽 여백(`pl-13`)은 세로축 폭 `w-11` + 사이 간격 `gap-2`의 합이다.

          **`whitespace-nowrap`이 없으면 「지금」이 「지/금」으로 접힌다.**
          13개 막대에 칸 하나가 21px인데(390px 실측) 「17시」는 28px이 필요하다.
          접지 않게 두면 글자가 제 칸을 넘어가지만, 넘어가는 쪽은 세 칸 걸러
          비어 있는 자리라 부딪힐 것이 없다 — 그래서 칸을 넓히는 대신 넘치게 둔다. */}
      <div aria-hidden="true" className="mt-1 flex gap-px pl-13">
        {bars.map((bar, index) => (
          <span
            key={bar.key}
            className={`flex-1 whitespace-nowrap text-center text-label-sm ${
              bar.current ? 'font-semibold text-on-surface' : 'text-on-surface-variant'
            }`}
          >
            {showLabel(index) ? bar.label : ''}
          </span>
        ))}
      </div>
    </div>
  )
}
