import { t } from '../../i18n/t'
import { roadIndexTone, type RoadTraffic } from '../../domain/cityInfo'
import { ToneBadge } from '../common/ToneBadge'

interface Props {
  readonly traffic: RoadTraffic
}

/**
 * 도로소통 요약. 시안 `stitch_ui_ux/_4`의 첫 카드다.
 *
 * **숫자가 크고 지표가 배지다.** 예전에는 반대였다 — 「도로 서행」이 제목
 * 크기이고 「평균 18.4km/h」가 그 옆의 작은 글씨였다. 뒤집은 이유는 둘이 같은
 * 값이 아니어서다: 지표는 세 낱말 중 하나라 **알약 하나면 다 말하고**, 속도는
 * 연속값이라 크기가 곧 뜻이다(18과 42는 다른 상황이고 둘 다 「서행」이다).
 *
 * **숫자는 primary이고 톤은 배지가 든다**(시안 그대로). 숫자까지 톤으로 칠하면
 * 정체인 날 카드가 통째로 빨개지는데, 바로 아래 「주요 도로 상황」이 구간별
 * 속도를 톤으로 칠하고 있어서 **그 대비가 죽는다** — 저기서 색은 다섯 줄 중
 * 어디가 막혔나를 훑는 일을 한다.
 *
 * **2026-08-21에 지표에 색이 붙었다.** 그전까지는 「값 목록을 모르니 짐작으로
 * 매핑하면 틀린 색이 붙는다」로 안 붙였는데, 실호출 응답에서 값을 확인하고
 * `roadIndexTone`이 **아는 값에만** 색을 준다 — 모르는 값은 `null`이라 색이
 * 없을 뿐 틀리지 않는다. 근거는 그 함수의 주석.
 */
export function RoadTrafficCard({ traffic }: Props) {
  return (
    <div>
      {(traffic.index !== '' || traffic.speed !== null) && (
        <div className="flex items-start justify-between gap-3">
          {/* 속도를 못 읽었을 때 0으로 떨어뜨리지 않는다 — 「0km/h」는 완전 정체로
              읽힌다. 주차장의 「실시간 미제공」과 같은 규칙이다. */}
          {traffic.speed !== null && (
            <p className="flex items-baseline gap-1.5">
              <span className="text-display-lg text-primary">{traffic.speed}</span>
              <span className="text-label-md text-on-surface-variant">
                {t('km/h (평균 속도)')}
              </span>
            </p>
          )}
          {/* 파서가 지표와 메시지 중 하나만 있어도 항목을 만들므로 지표가 빌 수
              있다. 빈 배지를 그리면 카드 위쪽에 색만 있는 알약이 남는다. */}
          {/* **맨 값을 키로 쓴다.** 예전에는 「도로 원활」로 옮겼는데, 그건 값
              `원활`이 혼잡도 헤드라인의 같은 낱말과 다투던 시절의 대비책이고
              그 상대는 2026-08-20에 사라졌다(`congestionHeadline` →
              `congestionSentence`). 지금은 절 이름이 「도로소통」이라 접두어를
              붙이면 「도로소통 / 도로 정체」가 된다. 요약 카드가 이미 맨 값을
              쓰고 있어(`SummaryGrid`) 두 화면이 같은 키를 나눠 쓴다.
              모르는 값이면 `t()`가 키를 그대로 돌려줘 「○○」로 뜬다. */}
          {traffic.index !== '' && (
            <ToneBadge tone={roadIndexTone(traffic.index)} label={t(traffic.index)} />
          )}
        </div>
      )}

      {traffic.message !== '' && (
        <p className="mt-2 text-body-md leading-6 text-on-surface">{traffic.message}</p>
      )}

      {traffic.updatedAt !== '' && (
        <p className="mt-2 text-label-sm text-outline">{t('기준 {시각}', { 시각: traffic.updatedAt })}</p>
      )}
    </div>
  )
}
