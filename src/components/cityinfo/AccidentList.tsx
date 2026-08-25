import { t } from '../../i18n/t'
import type { AccidentControl } from '../../domain/cityInfo'

interface Props {
  readonly accidents: readonly AccidentControl[]
}

// 유형과 세부유형은 둘 중 하나만 오는 경우가 있다. 빈 값을 걸러내고 이어야
// 「교통사고 ·」처럼 구분점만 남는 줄이 생기지 않는다 — 재난문자의
// `category`·`step`을 잇는 방식과 같다.
//
// **조각마다 감싼다.** 이어 붙인 뒤에 감싸면 「교통사고 · 차대차」가 통째로
// 키가 되어 조합마다 새 항목이 필요하다 — 유형이 늘면 곱으로 늘어난다.
// 아래 `info`는 서울 API의 자유 문장이라 감싸지 않는 것이 맞다.
function typeLabel(accident: AccidentControl): string {
  return [accident.type, accident.detailType]
    .filter((part) => part !== '')
    .map((part) => t(part))
    .join(' · ')
}

export function AccidentList({ accidents }: Props) {
  if (accidents.length === 0) {
    return null
  }

  return (
    <ul className="flex flex-col gap-3">
      {accidents.map((accident, index) => {
        const label = typeLabel(accident)
        return (
          // 사고통제에는 고유 ID가 없다. 같은 지점에서 같은 시각에 두 건이 올 수
          // 있어 시각만으로 부족해서 인덱스를 함께 쓴다(`AlertBanner`와 같다).
          <li
            key={`${accident.occurredAt}-${index}`}
            className="rounded-card bg-surface-container-low p-3"
          >
            {label !== '' && <p className="text-label-md text-busy">{label}</p>}
            <p className="mt-1 text-body-md leading-6 text-on-surface">{accident.info}</p>
            {/* 사용자가 실제로 쓰는 값은 「언제 풀리나」다. 발생 시각보다 이쪽이
                앞이라 종료 예정만 적는다 — 시트는 좁다. */}
            {accident.expectedClearAt !== '' && (
              <p className="mt-1 text-label-sm text-outline">
                {t('{시각}까지 통제', { 시각: accident.expectedClearAt })}
              </p>
            )}
          </li>
        )
      })}
    </ul>
  )
}
