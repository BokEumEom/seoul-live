import { t } from '../../i18n/t'
import { roadIndexTone, type RoadTraffic } from '../../domain/cityInfo'
import { TONE_TEXT_CLASS } from '../common/toneClass'

interface Props {
  readonly traffic: RoadTraffic
}

// **2026-08-21에 지표에 색이 붙었다.** 그전까지는 「값 목록을 모르니 짐작으로
// 매핑하면 틀린 색이 붙는다」로 안 붙였는데, 실호출 응답에서 값을 확인하고
// `roadIndexTone`이 **아는 값에만** 색을 준다 — 모르는 값은 `null`이라 색이
// 없을 뿐 틀리지 않는다. 근거는 그 함수의 주석.
//
// 요약 카드와 같은 함수를 쓴다. 두 곳이 각자 매핑을 들면 한쪽만 고쳤을 때
// 같은 도로가 카드에서는 초록이고 절에서는 검정인 화면이 된다.
export function RoadTrafficCard({ traffic }: Props) {
  const tone = roadIndexTone(traffic.index)
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
            <h4
              className={`text-headline-sm ${tone === null ? 'text-on-surface' : TONE_TEXT_CLASS[tone]}`}
            >
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
