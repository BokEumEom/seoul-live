import { AGE_LABELS, residentLabel } from '../../domain/composition'
import type { PopulationComposition } from '../../domain/composition'

/** 이 비율 이상인 연령대만 라벨을 적는다. 여덟 칸을 다 적으면 두 줄을 먹는다. */
const LABEL_THRESHOLD = 10

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

const CHIP_CLASS =
  'rounded-lg bg-surface-container px-2.5 py-1 text-label-sm text-on-surface-variant'

interface Props {
  readonly composition: PopulationComposition
}

export function PopulationCard({ composition }: Props) {
  const total = composition.ageRates.reduce((sum, value) => sum + value, 0)
  const label = residentLabel(composition)

  // 0은 "실제로 0%"가 아니라 "읽지 못함"일 수 있다(compositionSchema.ts의 rate()).
  // 못 읽은 값을 사실처럼 그리지 않는다 — 칸마다 값이 있을 때만 그린다.
  // 하나도 못 읽었으면 제목만 남는데, 그건 Task 8이 composition이 null일 때
  // 섹션을 통째로 숨기는 것과 다른 상태다(키는 왔는데 내용이 쓰레기).
  const hasGender = composition.maleRate > 0 || composition.femaleRate > 0

  // 막대 여덟 칸은 글자가 없어서 스크린리더에 아무것도 남기지 않고, 아래
  // 텍스트 라벨은 LABEL_THRESHOLD 미만을 뺀다. 이름이 없으면 작은 연령대는
  // 화면에도 소리에도 안 나온다 — 여기서만 여덟 칸을 다 읽어준다.
  const chartLabel = composition.ageRates
    .map((value, index) => `${AGE_LABELS[index]} ${Math.round(value)}%`)
    .join(', ')

  return (
    <section className="mt-4 border-t border-outline-variant pt-3">
      {/* font-bold(700)는 --text-label-md--font-weight(500)를 덮는다. 같은 값을
          두 번 쓰는 font-medium과 달리 실제로 무게를 올린다. */}
      <h3 className="text-label-md font-bold text-on-surface">지금 누가 있나</h3>

      {/* 알약이 없는 칸을 남기지 않으려고 li로 센다. residentLabel이 null일 때
          알약 안에 넣으면 글자 없는 빈 칸이 남는다. */}
      <ul className="mt-2 flex flex-wrap gap-1.5">
        {hasGender && (
          <li className={CHIP_CLASS}>
            남 {Math.round(composition.maleRate)}% · 여{' '}
            {Math.round(composition.femaleRate)}%
          </li>
        )}
        {composition.nonResidentRate > 0 && (
          <li className={CHIP_CLASS}>
            비상주 {Math.round(composition.nonResidentRate)}%
          </li>
        )}
        {label !== null && (
          <li className="rounded-lg bg-secondary-container px-2.5 py-1 text-label-sm text-primary">
            {label}
          </li>
        )}
      </ul>

      {/* 합이 100이라는 보장이 없다. 실제 합으로 나눠 폭을 낸다 — 폭의 합은
          정확히 100%가 되고, 남는 소수점은 브라우저가 서브픽셀로 흡수한다.
          합이 0이면 균등 8칸을 그리는 대신 막대를 통째로 뺀다 — 균등 막대는
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
                // 막대에 글자가 없어 테스트가 셀 방법이 이것뿐이다.
                data-age={AGE_LABELS[index]}
                style={{ width: `${(value / total) * 100}%` }}
                className={AGE_CLASS[index]}
              />
            ))}
          </div>

          <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-label-sm text-on-surface-variant">
            {composition.ageRates.map((value, index) =>
              value >= LABEL_THRESHOLD ? (
                <span key={AGE_LABELS[index]}>
                  {/* font-semibold를 쓰지 않는다 — --text-label-sm--font-weight가
                      이미 600이라 옆 글자와 무게가 같아져 굵게 보이지 않는다. */}
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
