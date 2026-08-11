import type { CityAlert } from '../../domain/cityInfo'

interface Props {
  readonly alerts: readonly CityAlert[]
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
          <p className="text-label-md text-crowded">
            {[alert.category, alert.step].filter((part) => part !== '').join(' ')}
          </p>
          <p className="mt-1 text-body-md leading-6 text-on-surface">{alert.message}</p>
          {alert.createdAt !== '' && (
            <p className="mt-1 text-label-sm text-outline">{alert.createdAt}</p>
          )}
        </div>
      ))}
    </div>
  )
}
