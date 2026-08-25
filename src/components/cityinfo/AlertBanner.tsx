import { t } from '../../i18n/t'
import type { CityAlert } from '../../domain/cityInfo'

interface Props {
  readonly alerts: readonly CityAlert[]
}

// 재해구분명과 긴급단계명. 둘 중 하나만 오는 경우가 있어 빈 값을 걸러낸다 —
// `AccidentList`의 `typeLabel`과 같은 모양이다.
//
// **이 둘은 갈래 이름이라 옮긴다.** 바로 아랫줄 `message`(재난문자 본문)는
// 사람이 쓴 자유 문장이라 못 옮기는데, 한 상자에 있다는 이유로 이쪽까지
// 한국어로 남아 있었다 — 영어 화면에서 배너 머리가 「호우 주의보」였다.
// 조각마다 감싸는 이유도 저쪽과 같다: 이어 붙인 뒤 감싸면 재해×단계 조합마다
// 새 사전 항목이 필요해진다.
function alertLabel(alert: CityAlert): string {
  return [alert.category, alert.step]
    .filter((part) => part !== '')
    .map((part) => t(part))
    .join(' ')
}

// 재난문자는 나머지 정보와 성격이 다르다 — 사용자가 찾아 읽는 게 아니라 지금
// 당장 알아야 하는 내용이라 화면 맨 위에 두고 role="alert"로 노출한다.
export function AlertBanner({ alerts }: Props) {
  if (alerts.length === 0) {
    return null
  }

  return (
    <div
      role="alert"
      className="mx-4 rounded-card border border-crowded bg-crowded-container p-4"
    >
      {alerts.map((alert, index) => (
        // 재난문자에는 고유 ID가 없다. 같은 시각에 여러 건이 올 수 있어 시각만으로도
        // 부족해서 인덱스를 함께 쓴다.
        <div key={`${alert.createdAt}-${index}`} className={index > 0 ? 'mt-4' : ''}>
          <p className="text-label-md text-crowded">{alertLabel(alert)}</p>
          <p className="mt-1 text-body-md leading-6 text-on-surface">{alert.message}</p>
          {alert.createdAt !== '' && (
            <p className="mt-1 text-label-sm text-outline">{alert.createdAt}</p>
          )}
        </div>
      ))}
    </div>
  )
}
