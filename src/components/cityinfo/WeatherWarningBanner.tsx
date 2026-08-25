import { t } from '../../i18n/t'
import { isActiveWarning, type WeatherWarning } from '../../domain/cityInfo'

interface Props {
  readonly warnings: readonly WeatherWarning[]
}

// 종류와 강도. 둘 중 하나만 오는 경우가 있어 빈 값을 걸러낸다 — `AlertBanner`·
// `AccidentList`와 같은 모양이고, **조각마다 감싸는 이유도 같다**: 통째로
// 감싸면 종류×강도 조합마다 사전 항목이 필요해진다.
function warningLabel(warning: WeatherWarning): string {
  return [warning.kind, warning.level]
    .filter((part) => part !== '')
    .map((part) => t(part))
    .join(' ')
}

/**
 * 기상특보 배너 — `WEATHER_STTS[0].NEWS_LIST`.
 *
 * **재난문자(`AlertBanner`)와 같은 옷을 입힌다.** 출처는 기상청과 행정안전부로
 * 다르지만 사용자에게는 둘 다 「지금 당장 알아야 하는 것」이라, 생김새가 다르면
 * 하나를 덜 급한 것으로 읽는다. `role="alert"`도 같은 이유로 단다.
 *
 * **해제·취소된 특보는 걷어낸다**(`isActiveWarning`). 다만 모르는 값은 남긴다 —
 * 살아 있는 경보를 숨치는 쪽의 대가가 훨씬 크다. 근거는 도메인에 있다.
 */
export function WeatherWarningBanner({ warnings }: Props) {
  const active = warnings.filter(isActiveWarning)

  if (active.length === 0) {
    return null
  }

  return (
    <div
      role="alert"
      className="mx-4 rounded-card border border-crowded bg-crowded-container p-4"
    >
      {active.map((warning, index) => (
        // 특보에도 고유 ID가 없다. 같은 종류가 두 단계로 함께 올 수 있어
        // 종류만으로 부족하다 — `AlertBanner`와 같은 이유로 인덱스를 함께 쓴다.
        <div
          key={`${warning.kind}-${warning.announcedAt}-${index}`}
          className={index > 0 ? 'mt-4' : ''}
        >
          <p className="text-label-md text-crowded">{warningLabel(warning)}</p>
          {/* 행동강령은 기상청의 자유 문장이라 옮기지 않는다. */}
          {warning.message !== '' && (
            <p className="mt-1 text-body-md leading-6 text-on-surface">{warning.message}</p>
          )}
          {/* `text-outline`은 이 붉은 바탕에서 3.46:1이라 못 쓴다 —
              근거는 `AlertBanner`의 같은 자리. */}
          {warning.announcedAt !== '' && (
            <p className="mt-1 text-label-sm text-on-surface-variant">
              {t('{시각} 발효', { 시각: warning.announcedAt })}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}
