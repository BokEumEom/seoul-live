import { t } from '../../i18n/t'
import { hasPopulationFlow, type PopulationFlow } from '../../domain/populationFlow'
import type { AreaSnapshot } from '../../domain/types'
import { ForecastChart } from '../forecast/ForecastChart'
import { PopulationFlowChart } from '../forecast/PopulationFlowChart'

interface Props {
  /** 못 받았으면 `undefined`. 그때는 공식 API의 예보 12칸으로 떨어진다 */
  readonly flow: PopulationFlow | undefined
  readonly snapshot: AreaSnapshot
}

/**
 * 인파 그래프의 절. **어느 출처로 그릴지를 여기서 고른다.**
 *
 * SeoulRtd가 답하면 25칸(과거 12 + 지금 + 예보 12) + 최근 4주 평균, 안 답하면
 * 공식 API의 예보 12칸이다. **오른쪽 절반은 두 문이 같은 값**이라(2026-08-27
 * 실측 8곳 × 12칸, 인원 96/96 · 등급 96/96) 폴백으로 떨어져도 곡선이 안 바뀐다 —
 * 과거가 사라질 뿐이다.
 *
 * **제목이 출처를 따라간다.** 예보만 있을 때 「24시간」이라고 쓰면 거짓말이다 —
 * `PopulationPanel`이 이 제목을 안 갖고 있던 시절의 주석이 그 이유를 적어 뒀고,
 * 그때는 과거를 받을 길이 아예 없어서 「시간대별 인파」로 고정이었다.
 *
 * **조회는 `PopulationPanel`이 한 번에 한다.** 이 절과 인파 변화가 같은 응답을
 * 나눠 쓰므로, 각자 부르는 대신 위에서 받아 내려온다.
 */
export function PopulationFlowSection({ flow, snapshot }: Props) {
  const full = flow !== undefined && hasPopulationFlow(flow)

  return (
    <section className="mx-4 rounded-card border border-outline-variant bg-surface-container-lowest p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-headline-sm text-on-surface">
          {full ? t('24시간 인파 흐름') : t('시간대별 인파')}
        </h3>
        <span className="text-label-sm text-outline">
          {full ? t('막대 = 인원') : t('막대 = 예상 인원')}
        </span>
      </div>
      {full ? (
        <PopulationFlowChart flow={flow} />
      ) : (
        <div className="mt-3">
          <ForecastChart snapshot={snapshot} />
        </div>
      )}
    </section>
  )
}
