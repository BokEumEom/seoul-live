import { t } from '../../i18n/t'
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
    // **`role="alert"`을 두지 않는다.** assertive 리전이라 보조기술이 읽던
    // 것을 끊는데, 그 값을 하는 것은 「방금 일어난 일」이다. 이 절은 상세에서
    // 이미 받아둔 캐시를 모아 보여주는 목록이고 「오늘의 서울」을 열 때 내용을
    // 가진 채로 삽입된다 — 사용자가 스스로 연 화면의 한 절을 읽다 말고 끊길
    // 이유가 없다. 아래 h3가 구조를 주고, 형제 절들도 같은 모양이다.
    <section className="mx-4 mt-3 rounded-card bg-error-container p-4">
      <h3 className="text-label-md font-semibold text-on-error-container">
        {t('재난문자 {건수}건', { 건수: unique.length })}
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
