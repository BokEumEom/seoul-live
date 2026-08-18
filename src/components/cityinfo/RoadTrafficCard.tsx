import { t } from '../../i18n/t'
import type { RoadTraffic } from '../../domain/cityInfo'

interface Props {
  readonly traffic: RoadTraffic
}

// **지표에 색을 붙이지 않는다.** 혼잡도와 통합대기환경등급은 값의 종류를 알기
// 때문에 네 톤에 겹칠 수 있지만(`congestionTone`·`airGradeTone`), 도로소통
// 지표는 공식 명세에 출력명만 있고 값 목록이 없다. 짐작으로 매핑하면 처음 보는
// 값에서 색이 안 붙는 게 아니라 **틀린 색이 붙는다.** 근거와 확인법은
// `domain/cityInfo.ts`의 `RoadTraffic.index` 주석에 있다.
export function RoadTrafficCard({ traffic }: Props) {
  return (
    <div>
      {(traffic.index !== '' || traffic.speed !== null) && (
        <div className="flex items-baseline gap-2">
          {/* 파서가 지표와 메시지 중 하나만 있어도 항목을 만들므로 지표가 빌 수
              있다. 빈 제목을 그리면 카드 위쪽에 빈 줄이 남는다. */}
          {/* **`도로`를 앞에 붙인 키로 옮긴다.** 값(`원활`)을 그대로 키로
              쓰면 혼잡도 헤드라인의 같은 낱말과 다투는데 뜻이 다르다(장소가
              한산하다 / 차가 잘 흐른다). 요약 칩이 쓰는 키와 같은 것이라
              칩과 절이 같은 말을 한다 — 근거는 `domain/cityInfoSummary.ts`.
              모르는 값이면 `t()`가 키를 그대로 돌려줘 「도로 ○○」로 뜬다. */}
          {traffic.index !== '' && (
            <h4 className="text-headline-sm text-on-surface">
              {t(`도로 ${traffic.index}`)}
            </h4>
          )}
          {/* 속도를 못 읽었을 때 0으로 떨어뜨리지 않는다 — 「0km/h」는 완전 정체로
              읽힌다. 주차장의 「실시간 미제공」과 같은 규칙이다. */}
          {traffic.speed !== null && (
            <p className="text-label-md text-on-surface-variant">
              {t('평균 {속도}km/h', { 속도: traffic.speed })}
            </p>
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
