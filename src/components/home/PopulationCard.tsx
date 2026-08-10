import {
  AGE_LABELS,
  hasGenderSplit,
  hasReadableComposition,
  residentLabel,
} from '../../domain/composition'
import type { PopulationComposition } from '../../domain/composition'

/** 이 비율 이상인 연령대만 라벨을 적는다. 여덟 칸을 다 적으면 두 줄을 먹는다. */
const LABEL_THRESHOLD = 10

/** 막대 폭의 최소 분모. 서울 API가 합을 100으로 준다는 보장이 없다.
 *
 * 실제 합으로만 정규화하면 절반만 읽힌 구성에서 남은 두 칸이 100%를 나눠 가져
 * 「10대와 30대가 이 장소의 전부」라고 그린다 — 바로 아래 글자는 25%·15%라고
 * 적으니 두 줄이 모순되고 막대 쪽이 거짓이다. 못 읽은 칸의 빈자리는 그대로 둔다.
 * 합이 99면 눈에 안 띄는 1% 여백만 남고, 100을 넘으면 실제 합으로 되돌아간다.
 *
 * 넘칠 때의 이득은 **지금은 화면에 안 보인다.** flex 기본 shrink가 폭 합이
 * 100%를 넘으면 basis에 비례해 압축해서 `value/total`과 같은 픽셀을 낸다 —
 * 브라우저로 재서 확인했다. 이 분기가 값을 갖는 건 막대에 `shrink-0`이나
 * `flex-none`이 붙는 순간이다. 그때는 이것만이 넘침을 막는다. */
const MIN_DENOMINATOR = 100

// 동적 클래스 금지라 리터럴 맵으로 둔다. 20~30대를 진하게 해서 어느 층이
// 많은지 색만으로도 읽히게 한다.
//
// AGE_LABELS와 길이가 묶여 있지 않다 — 연령 구간이 늘면 여기 칸이 모자라
// className이 undefined가 되고 색 없는 막대가 조용히 생긴다. 타입으로는 못
// 막아서 PopulationCard.test.tsx의 "연령 구간이 늘어도"가 잠근다.
const AGE_CLASS: readonly string[] = [
  'bg-secondary-container',
  'bg-secondary',
  'bg-primary',
  'bg-primary',
  'bg-secondary',
  'bg-secondary-container',
  'bg-surface-container',
  'bg-surface-container',
]

// 알약 기하는 셋이 함께 움직인다. 색만 갈라 두어 패딩을 고칠 때 한쪽만 고치는
// 일이 없게 한다.
const CHIP_BASE = 'rounded-lg px-2.5 py-1 text-label-sm'
const CHIP_NEUTRAL = `${CHIP_BASE} bg-surface-container text-on-surface-variant`
const CHIP_ACCENT = `${CHIP_BASE} bg-secondary-container text-primary`

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
  const chartLabel = composition.ageRates
    .flatMap((value, index) =>
      value > 0 ? [`${AGE_LABELS[index]} ${Math.round(value)}%`] : [],
    )
    .join(', ')

  return (
    <section className="mt-4 border-t border-outline-variant pt-3">
      {/* font-bold(700)는 --text-label-md--font-weight(500)를 덮는다. 같은 값을
          두 번 쓰는 font-medium과 달리 실제로 무게를 올린다. */}
      <h3 className="text-label-md font-bold text-on-surface">지금 누가 있나</h3>

      {/* 알약이 없는 칸을 남기지 않으려고 li로 센다. residentLabel이 null일 때
          알약 안에 넣으면 글자 없는 빈 칸이 남는다.
          role="list"를 명시하는 이유: preflight의 list-style:none이 WebKit에서
          목록 시맨틱을 지운다. 토스 iOS 웹뷰가 WebKit이다. */}
      {showChips && (
        <ul role="list" className="mt-2 flex flex-wrap gap-1.5">
          {showGender && (
            <li className={CHIP_NEUTRAL}>
              남 {Math.round(composition.maleRate)}% · 여{' '}
              {Math.round(composition.femaleRate)}%
            </li>
          )}
          {composition.nonResidentRate > 0 && (
            <li className={CHIP_NEUTRAL}>
              비상주 {Math.round(composition.nonResidentRate)}%
            </li>
          )}
          {label !== null && <li className={CHIP_ACCENT}>{label}</li>}
        </ul>
      )}

      {/* 합이 0이면 균등 8칸을 그리는 대신 막대를 통째로 뺀다 — 균등 막대는
          "모든 연령대가 고르게 있다"는 없는 사실을 그린다. */}
      {total > 0 && (
        <>
          <div
            role="img"
            aria-label={`연령대 비율: ${chartLabel}`}
            className="mt-3 flex h-2.5 overflow-hidden rounded-full"
          >
            {composition.ageRates.map((value, index) => (
              <span
                key={AGE_LABELS[index]}
                style={{
                  width: `${(value / Math.max(total, MIN_DENOMINATOR)) * 100}%`,
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
              value >= LABEL_THRESHOLD ? (
                <span key={AGE_LABELS[index]}>
                  {/* font-semibold를 쓰지 않는다 — --text-label-sm--font-weight가
                      이미 600이라 옆 숫자와 무게가 같아져 굵게 보이지 않는다. */}
                  <b className="font-bold text-on-surface">{AGE_LABELS[index]}</b>{' '}
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
