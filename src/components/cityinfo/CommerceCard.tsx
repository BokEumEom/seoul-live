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
import { toneTextClass, TONE_CLASS, NEUTRAL_TONE_CLASS } from '../common/toneClass'
import { ShareBar } from './ShareBar'

/** 업종이 열두 줄까지 온다(홍대). 결제가 많은 순으로 몇 줄만 보여준다. */
const VISIBLE_CATEGORIES = 6

// 20~40대를 진하게 해서 어느 층이 쓰는지 색만으로도 읽히게 한다. 인구 구성과
// 같은 뜻(많고 적음)이라 같은 방식 — 색상이 아니라 **농도**가 나른다.
// 여섯 칸이라 인구 쪽 여덟 칸 표를 그대로 못 쓴다.
const AGE_CLASS: readonly string[] = [
  'bg-primary/30',
  'bg-primary/60',
  'bg-primary',
  'bg-primary',
  'bg-primary/60',
  'bg-primary/30',
]

const PAYER_CLASS: readonly string[] = ['bg-primary', 'bg-primary/30']
const GENDER_CLASS: readonly string[] = ['bg-primary/60', 'bg-primary/30']

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

      {/* 건수와 금액은 한 줄에 함께 둔다. 「168건 · 3.9억」이 한 눈에 규모를
          말하고, 둘 중 하나만 있으면 그 하나만 남는다. */}
      {(commerce.paymentCount !== null || amount !== null) && (
        <p className="mt-2 text-body-md text-on-surface">
          {commerce.paymentCount !== null &&
            t('결제 {건수}건', { 건수: commerce.paymentCount.toLocaleString() })}
          {commerce.paymentCount !== null && amount !== null && ' · '}
          {amount}
        </p>
      )}

      {visible.length > 0 && (
        <div className="mt-4 border-t border-outline-variant pt-3">
          <h4 className="text-label-md font-bold text-on-surface">{t('업종별')}</h4>
          {/* role="list"를 명시하는 이유: preflight의 list-style:none이 WebKit에서
              목록 시맨틱을 지운다. 토스 iOS 웹뷰가 WebKit이다. */}
          <ul role="list" className="mt-2 flex flex-col gap-3">
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

      <div className="mt-4 border-t border-outline-variant pt-3">
        <h4 className="text-label-md font-bold text-on-surface">{t('누가 쓰고 있나')}</h4>
        <ShareBar
          values={commerce.ageRates}
          labels={COMMERCE_AGE_LABELS}
          classNames={AGE_CLASS}
          title={t('연령대별 소비 비율')}
        />
        <ShareBar
          values={genderValues}
          labels={COMMERCE_GENDER_LABELS}
          classNames={GENDER_CLASS}
          title={t('성별 소비 비율')}
          // 남녀는 둘뿐이라 문턱을 두면 한쪽이 사라진다.
          labelThreshold={0}
        />
        <ShareBar
          values={payerValues}
          labels={COMMERCE_PAYER_LABELS}
          classNames={PAYER_CLASS}
          title={t('개인·법인 소비 비율')}
          labelThreshold={0}
        />
      </div>

      {commerce.updatedAt !== '' && (
        <p className="mt-3 text-label-sm text-outline">
          {t('기준 {시각}', { 시각: commerce.updatedAt })}
        </p>
      )}
    </section>
  )
}
