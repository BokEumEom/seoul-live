import { t } from '../../i18n/t'
import { congestionHeadline } from '../../domain/congestion'
import { findQuietTime } from '../../domain/forecast'
import {
  compareWithUsual,
  observationSlot,
  type UsualDelta,
  type WeekPattern,
} from '../../domain/pattern'
import type { AreaSnapshot } from '../../domain/types'
import { Icon } from '../common/Icon'
import { PopulationCard } from './PopulationCard'

interface Props {
  readonly snapshot: AreaSnapshot
  /** 이 기기에 쌓인 요일×시간 관측. 「평소 대비」의 유일한 근거다 */
  readonly pattern: WeekPattern
}

// 화면이 쓰는 말. 도메인은 delta만 주고 문구는 여기서 고른다 — 같은 판정을
// 다른 화면에서 다르게 부를 수 있어야 한다.
const USUAL_TEXT: Readonly<Record<UsualDelta, string>> = {
  busier: t('평소보다 붐벼요'),
  similar: t('평소와 비슷해요'),
  calmer: t('평소보다 여유로워요'),
}

// 설계 §2.6의 3번 「현재 상태」. 배지는 히어로가 갖는다 — 여기 한 번 더 두면
// 「약간 붐빔」이 바로 아래 제목("다소 혼잡")까지 셋이 같은 말을 한다.
export function CongestionCard({ snapshot, pattern }: Props) {
  const quietHour = findQuietTime(snapshot.congestion, snapshot.forecasts)
  // 관측 시각에서 어느 칸인지 뽑는다. 형식이 다르면 null이고, 그때는 견줄
  // 대상 자체가 없다.
  const slot = observationSlot(snapshot.observedAt)
  const usual =
    slot === null ? null : compareWithUsual(pattern, slot, snapshot.congestion)

  return (
    <section className="mx-4 rounded-card border border-outline-variant bg-surface-container-lowest p-4">
      {/* 보이는 제목은 아래 display-lg 문단이 대신한다. 그건 <p>라 제목으로
          훑는 사용자에게는 이 카드가 통째로 이름 없는 덩어리였다. */}
      <h3 className="sr-only">{t('지금 얼마나 붐비나')}</h3>
      <p className="text-display-lg text-on-surface">
        {t(congestionHeadline(snapshot.congestion))}
      </p>
      <p className="mt-1 text-label-sm text-outline">
        {t('마지막 업데이트: {시각}', { 시각: snapshot.observedAtLabel })}
      </p>

      {/* 갱신 시각 바로 아래다. 이 안내는 **그 시각의 수치가 어디서 왔는가**에
          대한 것이라 시각과 붙어 있어야 뜻이 통한다.

          `=== true`로 명시해서 쓴다. `snapshot.replaced &&`로 적으면 동작은
          같지만 「모름(null)을 실측과 같이 다룬다」는 결정이 코드에서 안 보인다 —
          근거는 `AreaSnapshot.replaced` 주석.

          수치 자체는 숨기지 않는다. 서울 API가 주는 최선의 추정이고, 감추면
          화면에 남는 게 없다. 우리가 하는 일은 출처를 밝히는 것뿐이다. */}
      {snapshot.replaced === true && (
        <p className="mt-1 text-label-sm text-on-surface-variant">
          {t('이 수치는 실측이 아니라 대체값이에요.')}
        </p>
      )}

      {quietHour !== null && (
        <div className="mt-4 flex gap-2 rounded-card bg-secondary-container px-3 py-3">
          <Icon name="info" className="size-5 text-primary" />
          <p className="text-label-md leading-6 text-on-surface">
            {t('{시}시엔 여유 예상 — 한산한 시간을 원하시면 조금만 기다려주세요.', {
              시: quietHour,
            })}
          </p>
        </div>
      )}

      <p className="mt-4 text-body-md leading-6 text-on-surface">{snapshot.message}</p>
      <p className="mt-2 text-label-md text-on-surface-variant">
        {t('추정 인구 {최소}~{최대}명', {
          최소: snapshot.populationMin.toLocaleString(),
          최대: snapshot.populationMax.toLocaleString(),
        })}
      </p>

      {/* detail_page.png의 「평소보다 붐빔 · 같은 요일·비슷한 시각 누적 평균
          대비」 자리다. 추정 인구 바로 아래인 이유는 둘 다 「지금 이 수치를
          어떻게 읽어야 하나」를 말하기 때문이다.

          관측 시각을 못 읽으면(slot === null) 줄을 통째로 뺀다 — 어느 칸과
          견줄지가 없는데 「기록이 부족해요」라고 적으면 쌓으면 해결된다는
          틀린 기대를 준다. */}
      {slot !== null && (
        <p className="mt-2 text-label-md">
          {usual === null ? (
            // 「평소와 비슷」으로 떨어뜨리지 않는다. 안 본 것과 비슷한 것은
            // 정반대의 정보다(pattern.ts의 cellLevel과 같은 규칙).
            <span className="text-on-surface-variant">
              {t('아직 비교할 기록이 부족해요.')}
            </span>
          ) : (
            <>
              <span className="font-bold text-on-surface">
                {USUAL_TEXT[usual.delta]}
              </span>{' '}
              {/* 「평소」가 무엇인지 적지 않으면 어제 대비인지 한 달 대비인지
                  알 수 없다. 표본 수까지 적어야 사용자가 얼마나 믿을지 정한다. */}
              <span className="text-on-surface-variant">
                {t('같은 요일·같은 시간대 관측 {횟수}번과 견줬어요.', {
                  횟수: usual.samples,
                })}
              </span>
            </>
          )}
        </p>
      )}

      {/* 인구 구성은 이 카드 안이다. 근거(폴드 예산·PopulationCard의 여백 규약·
          래퍼가 만드는 빈 칸)는 계획서 Task 8 Step 6의 정정 블록에 한 벌 있다. */}
      {snapshot.composition !== null && (
        <PopulationCard composition={snapshot.composition} />
      )}
    </section>
  )
}
