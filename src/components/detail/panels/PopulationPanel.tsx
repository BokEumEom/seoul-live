import { useAreaPopulation } from '../../../data/queries'
import type { WeekPattern } from '../../../domain/pattern'
import type { AreaSnapshot } from '../../../domain/types'
import { PopulationFlowSection } from '../PopulationFlowSection'
import { PopulationTrendCard } from '../PopulationTrendCard'
import { CongestionCard } from '../../home/CongestionCard'
import { PopulationCard } from '../../home/PopulationCard'
import { PopulationLead } from '../../home/PopulationLead'
import { WeeklyPatternCard } from '../../home/WeeklyPatternCard'

interface Props {
  /** 서울 API 호출 키. **한국어 원문이어야 한다**(`entry.name`) */
  readonly areaName: string
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
 *
 * **SeoulRtd 조회를 여기서 한 번만 한다.** 인파 변화·24시간 흐름·「평소 대비」
 * 셋이 같은 응답을 나눠 쓰는데, 각자 부르게 두면 「props만 받는다」를 깨는
 * 컴포넌트가 셋이 된다 — 하나로 모으면 자식들이 순수해지고 예외도 하나다
 * (AGENTS.md 레이어 규칙). 이 패널은 `tab === 'population'`일 때만 마운트되므로
 * 조회 시점도 그대로다.
 */
export function PopulationPanel({ areaName, snapshot, pattern, now }: Props) {
  const { data } = useAreaPopulation(areaName)

  return (
    <div className="flex flex-col gap-3">
      {/* 히어로가 이미 인원수를 크게 적었는데 여기 또 있는 것은 되풀이가
          아니다 — 이 줄이 지고 있는 것은 **「평소 대비」**이고, 그 판정은
          숫자 없이 혼자 서지 못한다(「평소보다 붐벼요」가 몇 명을 두고 하는
          말인지 알 수 없다). 시안도 `_2` 히어로와 `_3` 인구 상세에 같은
          숫자를 둘 다 적는다. */}
      <PopulationLead snapshot={snapshot} pattern={pattern} flow={data?.flow} />

      <CongestionCard snapshot={snapshot} />

      {/* **인원수 바로 다음이다.** 이 절이 답하는 것은 「그래서 지금이 평소와
          견줘 어떤가」이고, 그 물음은 인원수를 본 직후에 생긴다 — 구성비(누가
          있나)보다 앞이다.

          공식 API가 못 주던 값이다(요청 인자에 날짜가 없다). */}
      {data !== undefined && <PopulationTrendCard trend={data.trend} />}

      {/* 시안 `_3`의 성별·연령 카드다. **`CongestionCard` 안이 아니라 옆이다** —
          시안이 각자 테두리를 가진 카드로 그리는데 안에 있으면 카드 안의 카드가
          된다. 차례도 시안 그대로: 지금 몇 명인가 다음이 누가 있나다. */}
      {snapshot.composition !== null && (
        <PopulationCard composition={snapshot.composition} />
      )}

      {/* **제목과 출처가 함께 간다.** SeoulRtd가 답하면 과거 12시간까지 그린
          「24시간 인파 흐름」이고, 안 답하면 공식 API의 예보 12칸이다 — 고르는
          자리와 근거는 `PopulationFlowSection`에 있다. */}
      <PopulationFlowSection flow={data?.flow} snapshot={snapshot} />

      {/* 시간축 바로 아래다. 예측이 「오늘 앞으로」를 말하고 이 표가 「평소
          이맘때」를 말한다. */}
      <WeeklyPatternCard pattern={pattern} now={now} />
    </div>
  )
}
