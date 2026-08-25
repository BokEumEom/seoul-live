import type { ReactNode } from 'react'
import { t } from '../../i18n/t'
import {
  GENDER_LABELS,
  hasGenderSplit,
  hasReadableComposition,
  hasResidenceSplit,
  RESIDENCE_SHARE_LABELS,
  residentLabel,
} from '../../domain/composition'
import type { PopulationComposition } from '../../domain/composition'
import { Icon } from '../common/Icon'
import { AgeShareRows } from './AgeShareRows'
import { SplitShareBar } from './SplitShareBar'

/**
 * 시안 `stitch_ui_ux/_3`의 카드 하나. 테두리·여백이 한 곳에 있다.
 *
 * `InfoSection`(도시정보 절)과 모양이 같지만 합치지 않는다 — 저쪽은 개수 칩과
 * 「언제 기준인가」 줄을 지고 있고 `id`로 포커스를 받는다. 여기는 제목과 내용뿐이다.
 */
function ShareCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-card border border-outline-variant bg-surface-container-lowest p-4">
      <h4 className="flex items-center gap-1.5 text-label-md text-on-surface-variant">
        <Icon name="people" className="size-4" />
        {title}
      </h4>
      {children}
    </section>
  )
}

interface Props {
  readonly composition: PopulationComposition
}

/**
 * 인구 구성 카드 셋. 시안 `stitch_ui_ux/_3`의 「성별 비율」·「연령대별 비율」이다.
 *
 * **셋인 이유.** 시안은 둘인데 서울 API가 하나를 더 준다 — 상주/비상주다
 * (`RESNT_PPLTN_RATE`·`NON_RESNT_PPLTN_RATE`). 예전에는 그 값이 「비상주 71%」
 * 알약 하나였는데, 성별과 **모양이 같은 두 칸짜리 비율**이라 같은 막대로 그린다.
 * 시안이 모르던 값을 시안의 언어로 적는 것이라 덧붙인 티가 안 난다.
 *
 * **알약 셋이 사라졌다.** 「남 48% · 여 52%」·「비상주 71%」·「동네 생활권이에요」가
 * 글자로만 있던 자리다. 앞의 둘은 이제 막대가 되었고 — 글자만으로는 두 값의
 * 크기를 눈으로 견줄 수 없다 — 마지막 하나는 거주 막대의 결론이라 그 아래 남는다.
 */
export function PopulationCard({ composition }: Props) {
  // 0은 "실제로 0%"가 아니라 "읽지 못함"일 수 있다(compositionSchema.ts의 rate()).
  // 하나도 못 읽었으면 제목만 남기지 않고 카드가 통째로 빠진다 — 사용자에게
  // 「키는 왔는데 쓰레기」와 「키가 안 왔다」는 구분할 이유가 없는 같은 상태다.
  // 그 판정의 소유자는 도메인이다. 여기서 다시 세면 판정이 갈린다.
  if (!hasReadableComposition(composition)) {
    return null
  }

  const total = composition.ageRates.reduce((sum, value) => sum + value, 0)
  const label = residentLabel(composition)

  return (
    <div className="mx-4 flex flex-col gap-3">
      {/* 성별은 한 쌍으로만 말할 수 있다. 한쪽만 읽힌 것을 그리면 「남 100% ·
          여 0%」처럼 못 읽은 값을 사실로 적게 된다 — 판정은 도메인이 갖는다. */}
      {hasGenderSplit(composition) && (
        <ShareCard title={t('성별 비율')}>
          <div className="mt-3">
            <SplitShareBar
              leftLabel={GENDER_LABELS[0]}
              leftValue={composition.maleRate}
              rightLabel={GENDER_LABELS[1]}
              rightValue={composition.femaleRate}
              title={t('성별 비율')}
            />
          </div>
        </ShareCard>
      )}

      {/* 합이 0이면 여덟 줄을 전부 0%로 그리는 대신 카드를 통째로 뺀다 —
          0% 여덟 줄은 「모든 연령대가 0명」이라는 없는 사실을 그린다. */}
      {total > 0 && (
        <ShareCard title={t('연령대별 비율')}>
          <AgeShareRows rates={composition.ageRates} />
        </ShareCard>
      )}

      {/* **시안에 없는 셋째 카드다** — 근거는 위 주석. 한쪽만 0인 것은 정상이라
          `hasGenderSplit`과 판정이 다르다(`hasResidenceSplit`). */}
      {hasResidenceSplit(composition) && (
        <ShareCard title={t('거주 비율')}>
          <div className="mt-3">
            <SplitShareBar
              leftLabel={RESIDENCE_SHARE_LABELS[0]}
              leftValue={composition.residentRate}
              rightLabel={RESIDENCE_SHARE_LABELS[1]}
              rightValue={composition.nonResidentRate}
              title={t('거주 비율')}
            />
          </div>
          {/* 도메인은 한국어 값을 주고 화면이 감싼다 — AGENTS.md 「언어」.
              막대가 숫자를 말하고 이 줄이 그 뜻을 말한다. */}
          {label !== null && (
            <p className="mt-2 text-label-sm text-primary">{t(label)}</p>
          )}
        </ShareCard>
      )}
    </div>
  )
}
