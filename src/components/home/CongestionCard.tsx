import { congestionHeadline } from '../../domain/congestion'
import { findQuietTime } from '../../domain/forecast'
import type { AreaSnapshot } from '../../domain/types'
import { Icon } from '../common/Icon'
import { PopulationCard } from './PopulationCard'

interface Props {
  readonly snapshot: AreaSnapshot
}

// 설계 §2.6의 3번 「현재 상태」. 배지는 히어로가 갖는다 — 여기 한 번 더 두면
// 「약간 붐빔」이 바로 아래 제목("다소 혼잡")까지 셋이 같은 말을 한다.
export function CongestionCard({ snapshot }: Props) {
  const quietHour = findQuietTime(snapshot.congestion, snapshot.forecasts)

  return (
    <section className="mx-4 rounded-card border border-outline-variant bg-surface-container-lowest p-4">
      {/* 보이는 제목은 아래 display-lg 문단이 대신한다. 그건 <p>라 제목으로
          훑는 사용자에게는 이 카드가 통째로 이름 없는 덩어리였다. */}
      <h3 className="sr-only">지금 얼마나 붐비나</h3>
      <p className="text-display-lg text-on-surface">
        {congestionHeadline(snapshot.congestion)}
      </p>
      <p className="mt-1 text-label-sm text-outline">
        마지막 업데이트: {snapshot.observedAtLabel}
      </p>

      {quietHour !== null && (
        <div className="mt-4 flex gap-2 rounded-card bg-secondary-container px-3 py-3">
          <Icon name="info" className="size-5 text-primary" />
          <p className="text-label-md leading-6 text-on-surface">
            <span className="font-bold text-primary">{quietHour}시엔 여유 예상</span>{' '}
            한산한 시간을 원하시면 조금만 기다려주세요.
          </p>
        </div>
      )}

      <p className="mt-4 text-body-md leading-6 text-on-surface">{snapshot.message}</p>
      <p className="mt-2 text-label-md text-on-surface-variant">
        추정 인구 {snapshot.populationMin.toLocaleString()}~
        {snapshot.populationMax.toLocaleString()}명
      </p>

      {/* 인구 구성은 이 카드 안이다. 근거(폴드 예산·PopulationCard의 여백 규약·
          래퍼가 만드는 빈 칸)는 계획서 Task 8 Step 6의 정정 블록에 한 벌 있다. */}
      {snapshot.composition !== null && (
        <PopulationCard composition={snapshot.composition} />
      )}
    </section>
  )
}
