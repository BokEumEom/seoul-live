import type { CityAlert } from '../../domain/cityInfo'

interface Props {
  readonly alerts: readonly CityAlert[]
}

export function AlertDigest({ alerts }: Props) {
  // 같은 경보가 여러 명소에 실려 온다. 중복을 지우지 않으면 화면이 같은
  // 문장으로 도배된다 — 폭염 경보 하나가 30줄이 된다.
  const unique = Array.from(new Map(alerts.map((a) => [a.message, a])).values())
  if (unique.length === 0) return null

  return (
    <section className="mx-4 mt-3 rounded-card bg-error-container p-4" role="alert">
      <h3 className="text-label-md font-semibold text-on-error-container">
        재난문자 {unique.length}건
      </h3>
      <ul className="mt-1">
        {unique.map((alert) => (
          <li key={alert.message} className="py-1 text-body-md text-on-error-container">
            {alert.message}
          </li>
        ))}
      </ul>
    </section>
  )
}
