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
// (`AreaDetailScreen`) 그 문장 그대로는 더 이상 맞지 않는다.
//
// 그런데도 여전히 안전하다 — **인구 탭에 가려면 반드시 요약을 거친다.**
// 상세는 언제나 요약으로 시작하고(`AreaDetailScreen`의 `useState('summary')`),
// 명소를 갈아타도 `key={entry.name}`로 컴포넌트가 통째로 새로 만들어져 다시
// 요약이다. 인구 탭으로 가는 길은 탭 줄과 요약 카드의 `onOpenTab` 둘뿐이고
// 둘 다 요약 화면 위에서 누르는 조작이다 — 즉 이 카드가 그려질 때는 등급
// 문장과 안내 문구를 **이미 본 뒤**다.
//
// **이 안전은 탭이 URL에 안 실린다는 사실에 기댄다**(`appUrl.ts`·`history.ts`에
// 탭 파라미터가 없다, 확인함). 딥링크가 탭을 나르게 되는 날 이 근거가 깨지고,
// 그때는 이 카드에 등급·안내를 되살릴지 다시 판단해야 한다.
//
// 남는 빈틈은 하나다: **요약에서 혼잡도가 아직 도착하기 전에** 인구 탭으로
// 넘어가면 등급을 못 본 채로 간다. 좁은 창이고, 목록이 이미 받아 둔 등급을
// 상세 헤더에 즉시 꽂는 씨앗 심기(`findSeededSnapshot`, 지금은 멈춰 있다 —
// AGENTS.md 77번째 줄)가 되살아나면 그 창도 없어진다.
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
