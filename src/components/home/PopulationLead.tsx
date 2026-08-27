import { t } from '../../i18n/t'
import {
  compareWithUsual,
  observationSlot,
  type UsualDelta,
  type WeekPattern,
} from '../../domain/pattern'
import {
  compareFlowWithUsual,
  type PopulationFlow,
} from '../../domain/populationFlow'
import type { AreaSnapshot } from '../../domain/types'

// 상세에서 **가장 먼저, 가장 크게** 나오는 값. 샘플(서울 인파레이더)의
// 「지금 약 40,000~42,000명」 자리다.
//
// **예전에는 이 자리가 「다소 혼잡」 32px였다.** 두 가지가 겹쳐 있었다.
//
// 하나는 크기다(사용자 지적). 다른 하나가 더 중요한데 — **그게 제목 줄의
// 배지와 같은 말이었다.** 「약간 붐빔」 배지를 달아 놓고 그 바로 아래에
// 「다소 혼잡」을 32px로 한 번 더 적고 있었다. 샘플은 등급을 배지 하나로
// 끝내고 큰 글씨를 **숫자**에 쓴다. 그 편이 맞다: 혼잡도는 다섯 등급이라
// 배지 한 칸에 다 들어가지만, **사람 수는 등급이 뭉갠 것을 되살리는 유일한
// 값이다** — 같은 「약간 붐빔」이 광화문에서는 40,000명이고 서촌에서는
// 4,000명이다.
//
// 「평소 대비」가 바로 아래 붙는 이유는 둘이 한 문장이기 때문이다. 40,000명이
// 많은지 적은지는 그 자체로 알 수 없고, 평소와 견줘야 뜻이 생긴다.

interface Props {
  readonly snapshot: AreaSnapshot
  /**
   * 이 기기에 쌓인 요일×시간 관측. **`flow`가 없을 때의 근거다** — 예전에는
   * 유일한 근거였다.
   */
  readonly pattern: WeekPattern
  /**
   * 24시간 흐름. 「지금」 칸의 최근 4주 평균이 여기 있다(`compareFlowWithUsual`).
   * SeoulRtd가 안 답하면 `undefined`이고, 그때만 `pattern`으로 떨어진다.
   */
  readonly flow: PopulationFlow | undefined
}

// 화면이 쓰는 말. 도메인은 delta만 주고 문구는 여기서 고른다 — 같은 판정을
// 다른 화면에서 다르게 부를 수 있어야 한다.
//
// **상수 표가 아니라 함수인 이유**는 `i18n/t.ts`에 한 벌 있다 — 모듈
// 최상위의 `t()`는 import 시점의 언어로 굳는다.
function usualText(delta: UsualDelta): string {
  const text: Readonly<Record<UsualDelta, string>> = {
    busier: t('평소보다 붐벼요'),
    similar: t('평소와 비슷해요'),
    calmer: t('평소보다 여유로워요'),
  }
  return text[delta]
}

export function PopulationLead({ snapshot, pattern, flow }: Props) {
  /**
   * **서울이 준 평균을 먼저 쓴다.** 근거의 질이 다르다 — 저쪽은 최근 4주
   * 같은 요일·같은 시각의 **인원 평균**이고, 이 기기 쪽은 사용자가 이 명소를
   * 열어 본 **관측 서너 번의 등급 평균**이다. 4단계로 뭉갠 값을 서넛 모아 낸
   * 판정보다, 연속값을 4주로 낸 평균이 낫다.
   *
   * **기기 쪽을 지우지는 않았다.** SeoulRtd는 문서화된 API가 아니라 조용히
   * 깨지는데, 그때 이 줄이 통째로 사라지면 인원수가 다시 「많은지 적은지 알 수
   * 없는 숫자」로 돌아간다.
   */
  const fromFlow = flow === undefined ? null : compareFlowWithUsual(flow)

  // 관측 시각에서 어느 칸인지 뽑는다. 형식이 다르면 null이고, 그때는 견줄
  // 대상 자체가 없다.
  const slot = observationSlot(snapshot.observedAt)
  const fromPattern =
    slot === null ? null : compareWithUsual(pattern, slot, snapshot.congestion)

  // 서울 쪽이 있으면 기기 쪽 「기록이 부족해요」 안내도 필요 없다.
  const hasBasis = fromFlow !== null || slot !== null

  return (
    <div className="px-4">
      {/* **키를 둘로 나눈 이유는 굵기다.** 샘플처럼 「지금 약」은 흐리고
          숫자만 굵게 두려면 span이 갈려야 한다. 한 키로 묶으면 어순은
          안전해지지만 32px 시절과 같은 「덩어리 한 줄」로 돌아간다.
          영어에서도 앞뒤가 그대로 붙는다: 「Now about 40,000–42,000 people」. */}
      {/* **`headline-md`(24px)에서 내렸다.** 그 크기는 제목(`광화문·덕수궁`)과
          **똑같아서** 한 화면에 헤드라인이 둘 있는 꼴이었다 — 무엇이 이 화면의
          주인인지 흐려진다. 게다가 우리 숫자가 샘플보다 넓다: 같은
          「40,000~42,000명」이 우리는 197px, 샘플은 줄 전체가 208px이다
          (390×844 / 412px 실측). 20px이면 숫자 부분이 약 164px이라 「지금 약」과
          함께 한 줄에 넉넉히 들어가고, 제목보다 한 단 작아 위계가 선다.

          여전히 화면에서 둘째로 큰 글씨다 — 「인원을 먼저」는 유지된다. */}
      <p className="text-headline-sm text-on-surface">
        <span className="text-label-md font-normal text-on-surface-variant">
          {t('지금 약')}{' '}
        </span>
        {t('{최소}~{최대}명', {
          최소: snapshot.populationMin.toLocaleString(),
          최대: snapshot.populationMax.toLocaleString(),
        })}
      </p>

      {/* 관측 시각을 못 읽으면(slot === null) 줄을 통째로 뺀다 — 어느 칸과
          견줄지가 없는데 「기록이 부족해요」라고 적으면 쌓으면 해결된다는
          틀린 기대를 준다. */}
      {hasBasis && (
        <p className="mt-0.5 text-label-sm">
          {fromFlow !== null ? (
            <>
              <span className="font-bold text-on-surface">
                {usualText(fromFlow.delta)}
              </span>{' '}
              {/* **무엇과 견줬는지 적는다.** 「평소」가 어제인지 한 달인지 모르면
                  판정이 공중에 뜬다. 표본 수 대신 **평소 인원**을 적는 이유는
                  그게 더 구체적이라서다 — 「4주 평균과 견줬다」보다 「평소는 약
                  38,000명」이 판정을 스스로 설명한다. */}
              <span className="text-on-surface-variant">
                {t('이 시간대 평소는 약 {인원}명이에요.', {
                  인원: fromFlow.usual.toLocaleString(),
                })}
              </span>
            </>
          ) : fromPattern === null ? (
            // 「평소와 비슷」으로 떨어뜨리지 않는다. 안 본 것과 비슷한 것은
            // 정반대의 정보다(pattern.ts의 cellLevel과 같은 규칙).
            <span className="text-on-surface-variant">
              {t('아직 비교할 기록이 부족해요.')}
            </span>
          ) : (
            <>
              <span className="font-bold text-on-surface">
                {usualText(fromPattern.delta)}
              </span>{' '}
              {/* 「평소」가 무엇인지 적지 않으면 어제 대비인지 한 달 대비인지
                  알 수 없다. 표본 수까지 적어야 사용자가 얼마나 믿을지 정한다. */}
              <span className="text-on-surface-variant">
                {t('같은 요일·같은 시간대 관측 {횟수}번과 견줬어요.', {
                  횟수: fromPattern.samples,
                })}
              </span>
            </>
          )}
        </p>
      )}
    </div>
  )
}
