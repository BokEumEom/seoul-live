import { t } from '../../i18n/t'
import { findQuietTime } from '../../domain/forecast'
import type { AreaSnapshot } from '../../domain/types'
import { Icon } from '../common/Icon'

interface Props {
  readonly snapshot: AreaSnapshot
}

// 설계 §2.6의 3번 「현재 상태」 — 지금을 **설명하는** 것들이다.
//
// **숫자도 등급도 안내 문구도 여기 없다.** 셋 다 상세 히어로(`DetailHero`)가
// 갖는다. 예전에는 이 카드가 「다소 혼잡」을 32px로 이고 시작했고, 그 뒤에는
// 서울 API의 안내 문구와 갱신 시각까지 지고 있었다. 상세가 전체 화면 + 탭이
// 되면서 히어로가 **탭과 무관하게 늘 위에 있으므로**, 같은 말을 인구 탭에서
// 한 번 더 하면 한 화면에 두 번 적히는 꼴이 된다.
//
// 그래서 남은 것은 둘이다: **언제 비면 좋은지**(여유 예상)와 **이 수치를 얼마나
// 믿을지**(대체값 주의). 둘 다 숫자를 읽은 **다음에** 궁금해지는 것들이다.
//
// **인구 구성이 2026-08-25에 여기서 나갔다.** 시안(`_3`)이 성별·연령을 각자
// 테두리를 가진 카드로 그리는데, 이 카드 **안**에 있으면 카드 안의 카드가 되어
// 그 모양을 낼 수가 없다. 지금은 `PopulationPanel`이 나란히 놓는다.
export function CongestionCard({ snapshot }: Props) {
  const quietHour = findQuietTime(snapshot.congestion, snapshot.forecasts)

  // 둘 다 없으면 제목만 남은 빈 상자가 된다 — 여백만 먹고 화면에는 아무
  // 말도 안 한다. 실제로 생기는 상태다: 예보가 없고 실측으로 온 명소.
  if (quietHour === null && snapshot.replaced !== true) {
    return null
  }

  return (
    <section className="mx-4 rounded-card border border-outline-variant bg-surface-container-lowest p-4">
      {/* 보이는 제목이 없다. 이 카드에 큰 글씨가 있던 시절에는 그 문단이
          제목 노릇을 했지만 지금은 안내와 구성뿐이라, 제목으로 훑는 사용자에게
          이 이름이 유일한 표지다. */}
      <h3 className="sr-only">{t('지금 얼마나 붐비나')}</h3>

      {quietHour !== null && (
        <div className="flex gap-2 rounded-card bg-surface-container-high px-3 py-3">
          <Icon name="info" className="size-5 text-primary" />
          <p className="text-label-md leading-6 text-on-surface">
            {t('{시}시엔 여유 예상 — 한산한 시간을 원하시면 조금만 기다려주세요.', {
              시: quietHour,
            })}
          </p>
        </div>
      )}

      {/* `=== true`로 명시해서 쓴다. `snapshot.replaced &&`로 적으면 동작은
          같지만 「모름(null)을 실측과 같이 다룬다」는 결정이 코드에서 안 보인다 —
          근거는 `AreaSnapshot.replaced` 주석.

          수치 자체는 숨기지 않는다. 서울 API가 주는 최선의 추정이고, 감추면
          화면에 남는 게 없다. 우리가 하는 일은 출처를 밝히는 것뿐이다. */}
      {snapshot.replaced === true && (
        <p className={`text-label-sm text-on-surface-variant ${quietHour === null ? '' : 'mt-4'}`}>
          {t('이 수치는 실측이 아니라 대체값이에요.')}
        </p>
      )}
    </section>
  )
}
