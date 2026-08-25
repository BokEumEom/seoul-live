import { t } from '../../i18n/t'
import {
  AGE_LABELS,
  hasGenderSplit,
  hasReadableComposition,
  residentLabel,
} from '../../domain/composition'
import type { PopulationComposition } from '../../domain/composition'
import { shareWidths } from '../../domain/share'

/** 이 비율 이상인 연령대만 라벨을 적는다. 여덟 칸을 다 적으면 두 줄을 먹는다. */
const LABEL_THRESHOLD = 10

// 막대 폭의 셈은 `domain/share.ts`가 갖는다. **2026-08-25에 여기서 꺼냈다** —
// 상권 소비 구성이 같은 규칙을 필요로 했고, 두 화면이 각자 들고 있으면 한쪽만
// 고치는 날이 온다. 그때 같은 화면의 두 막대가 다른 셈을 하는데 눈으로는 안 보인다.

// 동적 클래스 금지라 리터럴 맵으로 둔다. 20~30대를 진하게 해서 어느 층이
// 많은지 색만으로도 읽히게 한다.
//
// **한 색상의 농도 단계다.** 예전에는 secondary(갈색)와 primary(파랑)를 번갈아
// 썼는데, 새 배색에서 secondary는 중립 상자가 아니라 **「여유」의 초록**이라
// 그대로 두면 연령 막대가 혼잡도를 말하는 것처럼 읽힌다. 여기서 말하려는 것은
// 등급이 아니라 **많고 적음**이고, 그건 색상이 아니라 농도가 나른다.
//
// AGE_LABELS와 길이가 묶여 있지 않다 — 연령 구간이 늘면 여기 칸이 모자라
// className이 undefined가 되고 색 없는 막대가 조용히 생긴다. 타입으로는 못
// 막아서 PopulationCard.test.tsx의 "연령 구간이 늘어도"가 잠근다.
const AGE_CLASS: readonly string[] = [
  'bg-primary/30',
  'bg-primary/60',
  'bg-primary',
  'bg-primary',
  'bg-primary/60',
  'bg-primary/30',
  'bg-surface-container-highest',
  'bg-surface-container-highest',
]

// 알약 기하는 셋이 함께 움직인다. 색만 갈라 두어 패딩을 고칠 때 한쪽만 고치는
// 일이 없게 한다.
const CHIP_BASE = 'rounded-card px-2.5 py-1 text-label-sm'
const CHIP_NEUTRAL = `${CHIP_BASE} bg-surface-container text-on-surface-variant`
const CHIP_ACCENT = `${CHIP_BASE} bg-primary/10 text-primary`

interface Props {
  readonly composition: PopulationComposition
}

export function PopulationCard({ composition }: Props) {
  // 0은 "실제로 0%"가 아니라 "읽지 못함"일 수 있다(compositionSchema.ts의 rate()).
  // 하나도 못 읽었으면 제목만 남기지 않고 카드가 통째로 빠진다 — 사용자에게
  // 「키는 왔는데 쓰레기」와 「키가 안 왔다」는 구분할 이유가 없는 같은 상태다.
  // 그 판정의 소유자는 도메인이다. 여기서 다시 세면 Task 8과 판정이 갈린다.
  if (!hasReadableComposition(composition)) {
    return null
  }

  const total = composition.ageRates.reduce((sum, value) => sum + value, 0)
  const widths = shareWidths(composition.ageRates)
  const label = residentLabel(composition)
  const showGender = hasGenderSplit(composition)
  // 세 알약의 조건이 한 줄로 읽힌다. residentLabel은 nonResidentRate가 0일 때만
  // null이라 비상주 알약과 조건이 같다 — 같은 술어를 두 번 쓰지 않는다.
  const showChips = showGender || label !== null

  // 막대 여덟 칸은 글자가 없어서 스크린리더에 아무것도 남기지 않고, 아래
  // 텍스트 라벨은 LABEL_THRESHOLD 미만을 뺀다. 이름이 없으면 작은 연령대는
  // 화면에도 소리에도 안 나온다 — 여기서 읽은 칸을 다 읽어준다.
  //
  // 0인 칸은 뺀다. 화면은 그 칸을 말없이 비우는데 이름만 "0%"라고 단정하면
  // 카드가 지키는 규칙이 소리 채널에서만 깨진다.
  //
  // **`t()`로 감싼다.** 도메인이 주는 값(`20대`)을 그대로 쓰면 영어 화면에서
  // 이 줄만 한국어로 남는다 — 사전에는 항목이 있는데 아무도 요청하지 않는
  // 상태라 완결성 검사도 통과한다(변수로 넘기는 키는 정적으로 못 센다).
  const chartLabel = composition.ageRates
    .flatMap((value, index) =>
      value > 0 ? [`${t(AGE_LABELS[index])} ${Math.round(value)}%`] : [],
    )
    .join(', ')

  return (
    <section className="mt-4 border-t border-outline-variant pt-3">
      {/* font-bold(700)는 --text-label-md--font-weight(500)를 덮는다. 같은 값을
          두 번 쓰는 font-medium과 달리 실제로 무게를 올린다.
          h4인 이유: 이 카드는 「지금 얼마나 붐비나」 카드 안의 하위 블록이다
          (AreaDetail). h3로 올리면 제목 층이 한 칸 건너뛴다. */}
      <h4 className="text-label-md font-bold text-on-surface">{t('지금 누가 있나')}</h4>

      {/* 알약이 없는 칸을 남기지 않으려고 li로 센다. residentLabel이 null일 때
          알약 안에 넣으면 글자 없는 빈 칸이 남는다.
          role="list"를 명시하는 이유: preflight의 list-style:none이 WebKit에서
          목록 시맨틱을 지운다. 토스 iOS 웹뷰가 WebKit이다. */}
      {showChips && (
        <ul role="list" className="mt-2 flex flex-wrap gap-1.5">
          {showGender && (
            <li className={CHIP_NEUTRAL}>
              {t('남 {남}% · 여 {여}%', {
                남: Math.round(composition.maleRate),
                여: Math.round(composition.femaleRate),
              })}
            </li>
          )}
          {composition.nonResidentRate > 0 && (
            <li className={CHIP_NEUTRAL}>
              {t('비상주 {비율}%', { 비율: Math.round(composition.nonResidentRate) })}
            </li>
          )}
          {/* 도메인은 한국어 값을 주고 화면이 감싼다 — AGENTS.md 「언어」. */}
          {label !== null && <li className={CHIP_ACCENT}>{t(label)}</li>}
        </ul>
      )}

      {/* 합이 0이면 균등 8칸을 그리는 대신 막대를 통째로 뺀다 — 균등 막대는
          "모든 연령대가 고르게 있다"는 없는 사실을 그린다. */}
      {total > 0 && (
        <>
          <div
            role="img"
            aria-label={t('연령대 비율: {내용}', { 내용: chartLabel })}
            className="mt-3 flex h-2.5 overflow-hidden rounded-full"
          >
            {widths.map((width, index) => (
              <span
                // `key`는 감싸지 않은 값이다 — 언어가 바뀔 때 키까지 바뀌면
                // React가 같은 칸을 지웠다 새로 만든다.
                key={AGE_LABELS[index]}
                style={{
                  width: `${width}%`,
                }}
                className={AGE_CLASS[index]}
              />
            ))}
          </div>

          {/* 차트의 aria-label이 같은 값을 이미 읽어준다. 표지 없이 부분집합을
              한 번 더 낭독하게 두지 않는다 — 이 줄은 시각 전용이다. */}
          <p
            aria-hidden="true"
            className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-label-sm text-on-surface-variant"
          >
            {composition.ageRates.map((value, index) =>
              // `key`는 감싸지 않은 값이다 — 언어가 바뀔 때 키까지 바뀌면
              // React가 같은 칸을 지웠다 새로 만든다.
              value >= LABEL_THRESHOLD ? (
                <span key={AGE_LABELS[index]}>
                  {/* font-semibold를 쓰지 않는다 — --text-label-sm--font-weight가
                      이미 600이라 옆 숫자와 무게가 같아져 굵게 보이지 않는다. */}
                  <b className="font-bold text-on-surface">
                    {t(AGE_LABELS[index])}
                  </b>{' '}
                  {Math.round(value)}%
                </span>
              ) : null,
            )}
          </p>
        </>
      )}
    </section>
  )
}
