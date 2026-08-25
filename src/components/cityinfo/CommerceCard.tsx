import { t } from '../../i18n/t'
import {
  commerceLevelTone,
  COMMERCE_AGE_LABELS,
  COMMERCE_GENDER_LABELS,
  COMMERCE_PAYER_LABELS,
  scaleMoney,
  type Commerce,
  type CommerceCategory,
  type MoneyScale,
} from '../../domain/commerce'
import { hasShare } from '../../domain/share'
import { toneTextClass, TONE_CLASS, NEUTRAL_TONE_CLASS } from '../common/toneClass'
import { ShareRows } from '../common/ShareRows'
import { SplitShareBar } from '../common/SplitShareBar'

/** 업종이 열두 줄까지 온다(홍대). 결제가 많은 순으로 몇 줄만 보여준다. */
const VISIBLE_CATEGORIES = 6

/** 「4.5억」·「95만」·「800원」. 도메인이 숫자와 단위를 주고 글자는 여기서 짓는다. */
function money(won: number | null): string | null {
  const scaled = scaleMoney(won)
  if (scaled === null) {
    return null
  }
  const byScale: Readonly<Record<MoneyScale, string>> = {
    billion: t('{금액}억', { 금액: scaled.value }),
    tenThousand: t('{금액}만', { 금액: scaled.value.toLocaleString() }),
    won: t('{금액}원', { 금액: scaled.value.toLocaleString() }),
  }
  return byScale[scaled.scale]
}

/**
 * 「결제 건수 / 1,420 건」. 시안 `stitch_ui_ux/_8`의 머릿수치 카드다.
 *
 * 단위는 숫자 옆의 작은 글씨다 — 「1,420건」으로 붙이면 단위까지 24px이 되어
 * 두 칸의 숫자가 서로 다른 자리에서 끝난다.
 */
function PaymentTile({
  label,
  value,
  unit,
}: {
  readonly label: string
  readonly value: string
  readonly unit?: string
}) {
  return (
    <div className="rounded-card bg-surface-container-low p-3">
      <p className="text-label-sm text-on-surface-variant">{label}</p>
      <p className="mt-1 flex items-baseline gap-1">
        <span className="text-display-lg text-primary">{value}</span>
        {unit !== undefined && (
          <span className="text-label-sm text-on-surface-variant">{unit}</span>
        )}
      </p>
    </div>
  )
}

function CategoryRow({ category }: { readonly category: CommerceCategory }) {
  const tone = commerceLevelTone(category.level)

  return (
    <li className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        {/* 중분류가 본체다 — 「음식·음료」만으로는 카페인지 식당인지 모른다. */}
        <p className="truncate text-body-md text-on-surface">{t(category.minor)}</p>
        <p className="mt-0.5 text-label-sm text-on-surface-variant">
          {category.major !== '' && t(category.major)}
          {category.major !== '' && category.storeCount !== null && ' · '}
          {category.storeCount !== null &&
            t('가맹점 {개수}곳', { 개수: category.storeCount.toLocaleString() })}
        </p>
      </div>
      {category.level !== '' && (
        <span
          className={`shrink-0 rounded-card px-2.5 py-1 text-label-sm ${
            tone === null ? NEUTRAL_TONE_CLASS : TONE_CLASS[tone]
          }`}
        >
          {t(category.level)}
        </span>
      )}
    </li>
  )
}

interface Props {
  readonly commerce: Commerce
}

/**
 * 실시간 상권. 시안 `stitch_ui_ux/_8`의 차례다 — 요약 → 결제 → 업종별 → 누가.
 *
 * **결제 금액은 최소값을 쓴다.** 서울 API가 구간으로 주는데 「4.5억~5.0억」을
 * 그대로 적으면 한 줄이 두 배로 길어진다. 이 값이 답하는 것은 「대략 얼마나
 * 도나」이지 정확한 액수가 아니고, 최소값이면 적어도 넘겨 말하지 않는다.
 */
export function CommerceCard({ commerce }: Props) {
  const tone = commerceLevelTone(commerce.level)
  const amount = money(commerce.paymentMin)
  const visible = [...commerce.categories]
    .sort((left, right) => (right.paymentCount ?? 0) - (left.paymentCount ?? 0))
    .slice(0, VISIBLE_CATEGORIES)

  const genderValues = [commerce.maleRate ?? 0, commerce.femaleRate ?? 0]
  const payerValues = [commerce.personalRate ?? 0, commerce.corporationRate ?? 0]

  return (
    <section className="mx-4 rounded-card border border-outline-variant bg-surface-container-lowest p-4">
      {commerce.level !== '' && (
        <p className={`text-headline-sm ${toneTextClass(tone) ?? 'text-on-surface'}`}>
          {t('지금 이 동네 상권은 {정도}편이에요', { 정도: t(commerce.level) })}
        </p>
      )}

      {/* **건수와 금액이 저마다의 칸이다**(시안 `_8`). 예전에는 「결제 168건 ·
          3.9억」 한 줄이었는데, 이 둘은 규모를 말하는 **머릿수치**라 본문 크기로
          적으면 아래 업종 목록의 글자와 구별이 안 된다. 시안이 카드 둘로 떼어
          숫자를 키운 이유가 그것이다.

          한 칸만 있어도 격자를 쓴다 — 두 값 중 하나만 오는 응답에서 남은
          하나가 폭 전체를 차지해도 어색하지 않다. */}
      {(commerce.paymentCount !== null || amount !== null) && (
        <div className="mt-3 grid grid-cols-2 gap-3">
          {commerce.paymentCount !== null && (
            <PaymentTile
              label={t('결제 건수')}
              value={commerce.paymentCount.toLocaleString()}
              unit={t('건')}
            />
          )}
          {amount !== null && <PaymentTile label={t('결제 금액')} value={amount} />}
        </div>
      )}

      {visible.length > 0 && (
        <div className="mt-4 border-t border-outline-variant pt-3">
          <h4 className="text-label-md font-bold text-on-surface">{t('업종별')}</h4>
          {/* role="list"를 명시하는 이유: preflight의 list-style:none이 WebKit에서
              목록 시맨틱을 지운다. 토스 iOS 웹뷰가 WebKit이다. */}
          {/* 이름이 없으면 목록 단위로 훑는 사용자에게 이 목록과 아래 연령
              목록이 둘 다 「목록, 항목 6개」로만 들린다. */}
          <ul role="list" aria-label={t('업종별')} className="mt-2 flex flex-col gap-3">
            {visible.map((category) => (
              // 대분류+중분류가 키다. 중분류만으로는 두 대분류에 같은 이름이
              // 올 때 부딪힌다.
              <CategoryRow key={`${category.major}-${category.minor}`} category={category} />
            ))}
          </ul>
          {commerce.categories.length > visible.length && (
            <p className="mt-3 text-label-sm text-outline">
              {t('외 {개수}종', { 개수: commerce.categories.length - visible.length })}
            </p>
          )}
        </div>
      )}

      {/* **인구 탭과 같은 막대를 쓴다**(2026-08-25). 예전에는 상권만의
          `ShareBar`가 있었다 — 여러 칸을 한 막대에 쌓고 10% 미만인 칸의 이름은
          아예 안 적는 것이었는데, 그러면 「50대+ 7%」가 화면 어디에도 없이 색만
          남는다. 시안 `_8`의 「누가 많이 이용하고 있나요?」가 `_3`의 인구
          구성과 같은 모양이라 컴포넌트를 나눠 쓰는 것이 맞았다. */}
      {hasShare(commerce.ageRates) && (
        <div className="mt-4 border-t border-outline-variant pt-3">
          <h4 className="text-label-md font-bold text-on-surface">
            {t('연령대별 소비 비율')}
          </h4>
          <ShareRows
            rates={commerce.ageRates}
            labels={COMMERCE_AGE_LABELS}
            title={t('연령대별 소비 비율')}
          />
        </div>
      )}

      {hasShare(genderValues) && (
        <div className="mt-4 border-t border-outline-variant pt-3">
          <SplitShareBar
            leftLabel={COMMERCE_GENDER_LABELS[0]}
            leftValue={genderValues[0]}
            rightLabel={COMMERCE_GENDER_LABELS[1]}
            rightValue={genderValues[1]}
            title={t('성별 소비 비율')}
          />
        </div>
      )}

      {hasShare(payerValues) && (
        <div className="mt-4 border-t border-outline-variant pt-3">
          <SplitShareBar
            leftLabel={COMMERCE_PAYER_LABELS[0]}
            leftValue={payerValues[0]}
            rightLabel={COMMERCE_PAYER_LABELS[1]}
            rightValue={payerValues[1]}
            title={t('개인·법인 소비 비율')}
          />
        </div>
      )}

      {commerce.updatedAt !== '' && (
        <p className="mt-3 text-label-sm text-outline">
          {t('기준 {시각}', { 시각: commerce.updatedAt })}
        </p>
      )}
    </section>
  )
}
