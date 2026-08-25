import { t } from '../../i18n/t'
import { hasShare, shareWidths } from '../../domain/share'

interface Props {
  /** 칸마다의 백분율. 라벨과 길이가 같아야 한다 */
  readonly values: readonly number[]
  /** 칸 이름(한국어 키). 화면이 `t()`로 감싼다 */
  readonly labels: readonly string[]
  /** 칸마다의 Tailwind 배경 클래스. **동적 조합 금지라 리터럴 배열이다** */
  readonly classNames: readonly string[]
  /** 막대 전체의 접근성 이름 앞에 붙는 말 */
  readonly title: string
  /** 이 비율 이상인 칸만 아래 글자로 적는다 */
  readonly labelThreshold?: number
}

const DEFAULT_LABEL_THRESHOLD = 10

/**
 * 비율 막대 한 줄과 그 아래 글자. 상권 소비 구성이 쓴다.
 *
 * **`PopulationCard`를 일반화하지 않고 따로 두었다.** 저쪽은 여덟 칸에
 * 상주비율 알약까지 얽혀 있고 그 얽힘마다 근거 주석이 붙어 있다 — 상권은
 * 여섯 칸에 개인/법인이라 모양이 다르다. 억지로 한 컴포넌트에 넣으면 두
 * 화면의 규칙이 서로를 제약한다.
 *
 * **대신 셈은 나눠 쓴다**(`domain/share.ts`). 폭 계산이 두 벌이면 같은 화면의
 * 두 막대가 다른 셈을 하게 되고, 그건 눈으로 안 보인다.
 */
export function ShareBar({
  values,
  labels,
  classNames,
  title,
  labelThreshold = DEFAULT_LABEL_THRESHOLD,
}: Props) {
  if (!hasShare(values)) {
    return null
  }

  const widths = shareWidths(values)
  // 막대에는 글자가 없어 스크린리더에 아무것도 안 남고, 아래 글자는 문턱
  // 미만을 뺀다. 이름이 없으면 작은 칸은 화면에도 소리에도 안 나온다.
  const spoken = values
    .flatMap((value, index) =>
      value > 0 ? [`${t(labels[index])} ${Math.round(value)}%`] : [],
    )
    .join(', ')

  return (
    <>
      <div
        role="img"
        aria-label={`${title}: ${spoken}`}
        className="mt-2 flex h-2.5 overflow-hidden rounded-full"
      >
        {widths.map((width, index) => (
          // `key`는 감싸지 않은 값이다 — 언어가 바뀔 때 키까지 바뀌면 React가
          // 같은 칸을 지웠다 새로 만든다.
          <span key={labels[index]} style={{ width: `${width}%` }} className={classNames[index]} />
        ))}
      </div>

      {/* 막대의 aria-label이 같은 값을 이미 읽어준다. 표지 없이 부분집합을 한 번
          더 낭독하게 두지 않는다 — 이 줄은 시각 전용이다. */}
      <p
        aria-hidden="true"
        className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-label-sm text-on-surface-variant"
      >
        {values.map((value, index) =>
          value >= labelThreshold ? (
            <span key={labels[index]}>
              <b className="font-bold text-on-surface">{t(labels[index])}</b>{' '}
              {Math.round(value)}%
            </span>
          ) : null,
        )}
      </p>
    </>
  )
}
