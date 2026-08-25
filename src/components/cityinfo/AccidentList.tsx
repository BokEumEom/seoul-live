import { apiText } from '../../i18n/apiText'
import { t } from '../../i18n/t'
import type { AccidentControl } from '../../domain/accident'
import { toFacilityLocation, type FacilityLocation } from '../../domain/cityInfo'
import { ShowOnMapButton } from './ShowOnMapButton'

interface Props {
  readonly accidents: readonly AccidentControl[]
  readonly onShowOnMap: (place: FacilityLocation) => void
}

// 유형과 세부유형은 둘 중 하나만 오는 경우가 있다. 빈 값을 걸러내고 이어야
// 「교통사고 ·」처럼 구분점만 남는 줄이 생기지 않는다 — 재난문자의
// `category`·`step`을 잇는 방식과 같다.
//
// **조각마다 감싼다.** 이어 붙인 뒤에 감싸면 「교통사고 · 차대차」가 통째로
// 키가 되어 조합마다 새 항목이 필요하다 — 유형이 늘면 곱으로 늘어난다.
//
// **`ACDNT_ENG_TYPE`을 쓰지 않고 사전으로 옮기는 이유**는 `domain/accident.ts`에
// 적었다 — 닫힌 어휘라 사전이 감당하고, 사전에 두면 새 값이 왔을 때 검사가
// 잡아 준다. 아래 `info`가 반대쪽이다: 통제 건마다 다른 자유 문장이라 사전이
// 감당할 수 없어 서울이 준 영어를 그대로 쓴다.
function typeLabel(accident: AccidentControl): string {
  return [accident.type, accident.detailType]
    .filter((part) => part !== '')
    .map((part) => t(part))
    .join(' · ')
}

export function AccidentList({ accidents, onShowOnMap }: Props) {
  if (accidents.length === 0) {
    return null
  }

  return (
    <ul className="flex flex-col">
      {accidents.map((accident, index) => {
        const label = typeLabel(accident)
        // **지도 버튼의 이름도 옮긴다.** `aria-label`이 「{시설} 지도에서 보기」라
        // 여기에 한국어 원문을 넘기면 영어 화면의 스크린리더에서만 한국어가 남는다.
        const info = apiText(accident.info, accident.infoEn)
        return (
          // 사고통제에는 고유 ID가 없다. 같은 지점에서 같은 시각에 두 건이 올 수
          // 있어 시각만으로 부족해서 인덱스를 함께 쓴다(`AlertBanner`와 같다).
          <li
            key={`${accident.occurredAt}-${index}`}
            // **줄마다 배경을 깔지 않는다.** 이 목록은 두 곳에 들어가는데
            // (교통 탭의 주황 배너, 안전 탭의 흰 절) 회색 상자를 들고 다니면
            // 배너 안에서 색이 세 겹이 된다. 구분은 배경이 아니라 선이 한다 —
            // 시안 `_4`의 「주요 도로 상황」이 쓰는 것과 같은 구분선이다.
            className={
              index === 0 ? '' : 'mt-3 border-t border-outline-variant pt-3'
            }
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                {/* 흐린 주황(`text-busy`)은 주황 배너 위에서 3.48:1이라 못 쓴다.
                    `-container`의 짝은 흰 표면에서도 9.38:1이라 두 배경을 다
                    감당한다 — 근거는 `toneClass.ts`의 `TONE_TEXT_CLASS`. */}
                {label !== '' && (
                  <p className="text-label-md text-on-busy-container">{label}</p>
                )}
                {/* **서울이 영어 원문을 함께 준다**(`ACDNT_ENG_INFO`, 명세에
                    없는 필드). 이 줄은 「소공로 서울광장~한국은행앞/양방향
                    하위1개차로 통제」 같은 자유 문장이라 사전으로는 못 옮긴다 —
                    그동안 영어 화면에서 여기만 한국어로 남아 있던 자리다. */}
                <p className="mt-1 text-body-md leading-6 text-on-surface">{info}</p>
                {/* 사용자가 실제로 쓰는 값은 「언제 풀리나」다. 발생 시각보다 이쪽이
                    앞이라 종료 예정만 적는다 — 시트는 좁다. */}
                {/* `text-outline`은 주황 배너 위에서 3.46:1이라 못 쓴다. */}
                {accident.expectedClearAt !== '' && (
                  <p className="mt-1 text-label-sm text-on-surface-variant">
                    {t('{시각}까지 통제', { 시각: accident.expectedClearAt })}
                  </p>
                )}
              </div>
              {/* 어느 길이 막혔는지는 글로 읽기 어렵다 — 위 예시의 「소공로
                  서울광장~한국은행앞」은 그 길을 아는 사람만 읽는다. */}
              <ShowOnMapButton
                place={toFacilityLocation({ name: info, coords: accident.coords })}
                onShow={onShowOnMap}
              />
            </div>
          </li>
        )
      })}
    </ul>
  )
}
