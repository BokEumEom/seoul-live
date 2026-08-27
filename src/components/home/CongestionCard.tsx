import { t } from '../../i18n/t'
import { findQuietTime } from '../../domain/forecast'
import type { AreaSnapshot } from '../../domain/types'
import { Icon } from '../common/Icon'

interface Props {
  readonly snapshot: AreaSnapshot
}

// 설계 §2.6의 3번 「현재 상태」 — 지금을 **설명하는** 것들이다.
//
// **디렉터리는 `components/home/`이지만 실제로 부르는 곳은 `PopulationPanel`
// 하나뿐이다**(`grep -rn CongestionCard src` 확인, 2026-08-27) — 즉 이 카드는
// 상세의 **인구 탭에서만** 그려진다. 이름이 남은 것은 2026-08-25에 인구
// 구성이 이 카드 밖으로 나갔을 때 파일을 안 옮겨서다.
//
// **숫자는 여기 없다.** `PopulationLead`가 같은 탭 위쪽에서 이미 인원수와
// 「평소 대비」를 적는다 — 이 카드가 또 적으면 한 탭 안에서 숫자가 두 번
// 적히는 꼴이다. 이 근거는 히어로와 무관하게 지금도 유효하다.
//
// **등급 문장·안내 문구는 사정이 다르다.** 예전에는 이 자리에 「히어로가
// 탭과 무관하게 늘 위에 있으므로 여기서 또 적으면 중복」이라고 적혀
// 있었는데, 2026-08-27에 히어로가 **요약 탭에서만** 그려지도록 바뀌면서
// (`AreaDetailScreen`) 그 전제가 깨졌다. 요약을 거치지 않고 인구 탭으로 바로
// 들어온 사용자는 지금 이 화면 어디서도 등급 문장(「지금은 약간 붐벼요」)이나
// 안내 문구(「조금 붐벼요.」)를 못 본다 — **이 카드가 둘을 안 그리는 근거가
// 약해졌다.** 다시 넣을지는 이 파일만 봐서 판단할 일이 아니라 남겨 둔다.
//
// 그래서 지금 이 카드가 확실히 갖는 것은 둘이다: **언제 비면 좋은지**(여유
// 예상)와 **이 수치를 얼마나 믿을지**(대체값 주의). 둘 다 숫자를 읽은
// **다음에** 궁금해지는 것들이다.
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
