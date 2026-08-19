import { t } from '../../i18n/t'
import { findQuietTime } from '../../domain/forecast'
import type { AreaSnapshot } from '../../domain/types'
import { Icon } from '../common/Icon'
import { PopulationCard } from './PopulationCard'

interface Props {
  readonly snapshot: AreaSnapshot
}

// 설계 §2.6의 3번 「현재 상태」 — 지금을 **설명하는** 것들이다.
//
// **숫자와 등급은 여기 없다.** 등급은 제목 줄의 배지가, 사람 수는 그 아래
// `PopulationLead`가 갖는다. 예전에는 이 카드가 「다소 혼잡」을 32px로 이고
// 시작했는데, 그건 배지와 같은 말이었고 정작 사람 수는 14px로 안내 문구 밑에
// 깔려 있었다 — 근거는 `PopulationLead`의 주석.
//
// 그래서 남은 것은 셋이다: **언제 비면 좋은지**(여유 예상), **지금 어떤
// 느낌인지**(서울 API의 안내 문구), **지금 누가 있는지**(인구 구성). 셋 다
// 숫자를 읽은 **다음에** 궁금해지는 것들이라 이 차례가 맞다.
export function CongestionCard({ snapshot }: Props) {
  const quietHour = findQuietTime(snapshot.congestion, snapshot.forecasts)

  return (
    <section className="mx-4 rounded-card border border-outline-variant bg-surface-container-lowest p-4">
      {/* 보이는 제목이 없다. 이 카드에 큰 글씨가 있던 시절에는 그 문단이
          제목 노릇을 했지만 지금은 안내와 구성뿐이라, 제목으로 훑는 사용자에게
          이 이름이 유일한 표지다. */}
      <h3 className="sr-only">{t('지금 얼마나 붐비나')}</h3>

      {quietHour !== null && (
        <div className="flex gap-2 rounded-card bg-secondary-container px-3 py-3">
          <Icon name="info" className="size-5 text-primary" />
          <p className="text-label-md leading-6 text-on-surface">
            {t('{시}시엔 여유 예상 — 한산한 시간을 원하시면 조금만 기다려주세요.', {
              시: quietHour,
            })}
          </p>
        </div>
      )}

      <p
        className={`text-body-md leading-6 text-on-surface ${
          quietHour === null ? '' : 'mt-4'
        }`}
      >
        {snapshot.message}
      </p>

      {/* 갱신 시각과 대체값 주의가 안내 문구 **아래**다. 위쪽 큰 숫자 옆에
          두면 그 줄이 세 조각(수·평소 대비·시각)으로 갈려 무엇이 제일 중요한지가
          흐려진다 — 시각은 값을 다 읽은 뒤에 「얼마나 믿을까」를 묻는 자리다.

          `=== true`로 명시해서 쓴다. `snapshot.replaced &&`로 적으면 동작은
          같지만 「모름(null)을 실측과 같이 다룬다」는 결정이 코드에서 안 보인다 —
          근거는 `AreaSnapshot.replaced` 주석.

          수치 자체는 숨기지 않는다. 서울 API가 주는 최선의 추정이고, 감추면
          화면에 남는 게 없다. 우리가 하는 일은 출처를 밝히는 것뿐이다. */}
      <p className="mt-2 text-label-sm text-outline">
        {t('마지막 업데이트: {시각}', { 시각: snapshot.observedAtLabel })}
      </p>
      {snapshot.replaced === true && (
        <p className="mt-1 text-label-sm text-on-surface-variant">
          {t('이 수치는 실측이 아니라 대체값이에요.')}
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
