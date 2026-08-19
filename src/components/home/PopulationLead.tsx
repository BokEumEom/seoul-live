import { t } from '../../i18n/t'
import {
  compareWithUsual,
  observationSlot,
  type UsualDelta,
  type WeekPattern,
} from '../../domain/pattern'
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
  /** 이 기기에 쌓인 요일×시간 관측. 「평소 대비」의 유일한 근거다. */
  readonly pattern: WeekPattern
}

// 화면이 쓰는 말. 도메인은 delta만 주고 문구는 여기서 고른다 — 같은 판정을
// 다른 화면에서 다르게 부를 수 있어야 한다.
//
// **상수 표가 아니라 함수인 이유**는 `SortSegmented`에 한 벌 있다 — 모듈
// 최상위의 `t()`는 import 시점의 언어로 굳는다.
function usualText(delta: UsualDelta): string {
  const text: Readonly<Record<UsualDelta, string>> = {
    busier: t('평소보다 붐벼요'),
    similar: t('평소와 비슷해요'),
    calmer: t('평소보다 여유로워요'),
  }
  return text[delta]
}

export function PopulationLead({ snapshot, pattern }: Props) {
  // 관측 시각에서 어느 칸인지 뽑는다. 형식이 다르면 null이고, 그때는 견줄
  // 대상 자체가 없다.
  const slot = observationSlot(snapshot.observedAt)
  const usual =
    slot === null ? null : compareWithUsual(pattern, slot, snapshot.congestion)

  return (
    <div className="px-4">
      {/* **키를 둘로 나눈 이유는 굵기다.** 샘플처럼 「지금 약」은 흐리고
          숫자만 굵게 두려면 span이 갈려야 한다. 한 키로 묶으면 어순은
          안전해지지만 32px 시절과 같은 「덩어리 한 줄」로 돌아간다.
          영어에서도 앞뒤가 그대로 붙는다: 「Now about 40,000–42,000 people」. */}
      <p className="text-headline-md text-on-surface">
        <span className="text-body-md font-normal text-on-surface-variant">
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
      {slot !== null && (
        <p className="mt-0.5 text-label-sm">
          {usual === null ? (
            // 「평소와 비슷」으로 떨어뜨리지 않는다. 안 본 것과 비슷한 것은
            // 정반대의 정보다(pattern.ts의 cellLevel과 같은 규칙).
            <span className="text-on-surface-variant">
              {t('아직 비교할 기록이 부족해요.')}
            </span>
          ) : (
            <>
              <span className="font-bold text-on-surface">
                {usualText(usual.delta)}
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
    </div>
  )
}
