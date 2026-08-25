import { t } from '../../../i18n/t'
import type { WeekPattern } from '../../../domain/pattern'
import type { AreaSnapshot } from '../../../domain/types'
import { ForecastChart } from '../../forecast/ForecastChart'
import { CongestionCard } from '../../home/CongestionCard'
import { PopulationCard } from '../../home/PopulationCard'
import { PopulationLead } from '../../home/PopulationLead'
import { WeeklyPatternCard } from '../../home/WeeklyPatternCard'

interface Props {
  readonly snapshot: AreaSnapshot
  /** 이 기기에 쌓인 요일×시간 관측. 「평소 대비」의 유일한 근거다. */
  readonly pattern: WeekPattern
  readonly now: Date
}

/**
 * 인구 탭 — 지금 몇 명인가, 누가 있나, 앞으로 어떻게 되나.
 *
 * 시안(stitch_ui_ux/_3)의 차례다: 현재 인구 → 성별 → 연령대 →
 * 「앞으로 얼마나 붐빌까요?」. 우리 쪽이 하나 더 갖는다 — **요일×시간 패턴**은
 * 서울 API가 과거를 안 줘서 이 기기에 직접 쌓은 값이고, 「평소 대비」가 뜻을
 * 가지려면 그 표가 함께 보여야 한다.
 */
export function PopulationPanel({ snapshot, pattern, now }: Props) {
  return (
    <div className="flex flex-col gap-3">
      {/* 히어로가 이미 인원수를 크게 적었는데 여기 또 있는 것은 되풀이가
          아니다 — 이 줄이 지고 있는 것은 **「평소 대비」**이고, 그 판정은
          숫자 없이 혼자 서지 못한다(「평소보다 붐벼요」가 몇 명을 두고 하는
          말인지 알 수 없다). 시안도 `_2` 히어로와 `_3` 인구 상세에 같은
          숫자를 둘 다 적는다. */}
      <PopulationLead snapshot={snapshot} pattern={pattern} />

      <CongestionCard snapshot={snapshot} />

      {/* 시안 `_3`의 성별·연령 카드다. **`CongestionCard` 안이 아니라 옆이다** —
          시안이 각자 테두리를 가진 카드로 그리는데 안에 있으면 카드 안의 카드가
          된다. 차례도 시안 그대로: 지금 몇 명인가 다음이 누가 있나다. */}
      {snapshot.composition !== null && (
        <PopulationCard composition={snapshot.composition} />
      )}

      <section className="mx-4 rounded-card border border-outline-variant bg-surface-container-lowest p-4">
        {/* 「예측」은 시스템 용어에 가깝다. Google Maps의 「인기 시간대」 자리다.
            **「24시간 인파 흐름」이라고 쓰지 않는다** — 샘플(서울 인파레이더)의
            제목이지만 그쪽은 과거까지 그린다. 서울 API의 요청 인자에 날짜가
            없어 우리는 과거를 못 받고, 실데이터에서 예보는 12개다. */}
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-headline-sm text-on-surface">{t('시간대별 인파')}</h3>
          <span className="text-label-sm text-outline">{t('막대 = 예상 인원')}</span>
        </div>
        <div className="mt-3">
          <ForecastChart snapshot={snapshot} />
        </div>
      </section>

      {/* 시간축 바로 아래다. 예측이 「오늘 앞으로」를 말하고 이 표가 「평소
          이맘때」를 말한다. */}
      <WeeklyPatternCard pattern={pattern} now={now} />
    </div>
  )
}
