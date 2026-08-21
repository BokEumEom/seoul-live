import { t } from '../../i18n/t'
import { congestionTone, type CongestionTone } from '../../domain/congestion'
import {
  airGradeTone,
  formatTemperature,
  roadIndexTone,
  type CityInfo,
} from '../../domain/cityInfo'
import {
  parkingVacancyRate,
  subwayLineCount,
  totalBikes,
} from '../../domain/cityInfoSummary'
import { DETAIL_TABS, type DetailTabId } from '../../domain/detailTabs'
import type { AreaSnapshot } from '../../domain/types'
import { TONE_DOT_CLASS, TONE_TEXT_CLASS } from '../common/toneClass'
import type { IconName } from '../common/Icon'
import { SummaryCard } from './SummaryCard'

interface Props {
  readonly snapshot: AreaSnapshot | undefined
  readonly cityInfo: CityInfo | undefined
  readonly onOpenTab: (tab: DetailTabId) => void
}

/** 카드 하나를 세울 재료. 값이 없으면 만들지 않는다 — 아래 주석. */
interface Card {
  readonly key: string
  readonly icon: IconName
  readonly label: string
  readonly value: string
  readonly caption?: string
  readonly valueClassName?: string
  readonly dotClassName?: string
  readonly tab: DetailTabId
}

/** 톤을 모르면 본문 색이다. `undefined`를 넘기면 카드가 제 기본값을 쓴다. */
function toneTextClass(tone: CongestionTone | null): string | undefined {
  return tone === null ? undefined : TONE_TEXT_CLASS[tone]
}

function tabLabel(id: DetailTabId): string {
  // `?? id`는 닿지 않는다 — 아래에서 넘기는 값이 전부 `DETAIL_TABS`의 것이다.
  // 그래도 적어 두는 이유는 탭 하나를 지웠을 때 화면이 빈 이름으로 조용히
  // 도는 대신 id가 보이게 하려는 것이다.
  return DETAIL_TABS.find((tab) => tab.id === id)?.label ?? id
}

/**
 * 요약 탭의 2열 카드 그리드. 시안(stitch_ui_ux/_2)의 여덟 칸이다.
 *
 * **값이 없는 카드는 아예 안 만든다.** 「—」로 채운 칸을 여덟 개 세우면 화면이
 * 「이 앱은 아무것도 모른다」로 읽히고, 실제로 121곳 중 도시 정보가 거의 없는
 * 명소가 있다. 빈 칸 대신 격자가 짧아진다.
 *
 * **추가 호출이 0이다.** 위 화면이 이미 받아 둔 두 응답을 다시 셀 뿐이다.
 */
export function SummaryGrid({ snapshot, cityInfo, onOpenTab }: Props) {
  const weather = cityInfo?.weather ?? null
  const road = cityInfo?.roadTraffic ?? null

  const cards: readonly Card[] = [
    ...(snapshot === undefined
      ? []
      : [
          {
            key: 'congestion',
            icon: 'people' as IconName,
            label: t('혼잡도'),
            value: t(snapshot.congestion),
            valueClassName: TONE_TEXT_CLASS[congestionTone(snapshot.congestion)],
            dotClassName: TONE_DOT_CLASS[congestionTone(snapshot.congestion)],
            tab: 'population' as DetailTabId,
          },
        ]),

    ...(weather === null || weather.temperature === null
      ? []
      : [
          {
            key: 'weather',
            icon: 'thermostat' as IconName,
            label: t('날씨'),
            value: formatTemperature(weather.temperature),
            caption:
              weather.maxTemperature === null && weather.minTemperature === null
                ? undefined
                : t('최고 {높} · 최저 {낮}', {
                    높: formatTemperature(weather.maxTemperature),
                    낮: formatTemperature(weather.minTemperature),
                  }),
            tab: 'weather' as DetailTabId,
          },
        ]),

    ...(weather === null || weather.airGrade === ''
      ? []
      : [
          {
            key: 'air',
            icon: 'air' as IconName,
            label: t('대기질'),
            value: t(weather.airGrade),
            caption: t('통합대기'),
            // 대기 등급의 톤은 도메인이 안다(`airGradeTone`). 혼잡도와 같은
            // 네 단계로 겹치므로 같은 표를 쓴다 — 한 화면에서 「좋음」과
            // 「여유」가 다른 초록이면 두 값이 무관해 보인다.
            //
            // **모르는 등급이면 색을 안 붙인다.** 서울 API가 자유 문자열을
            // 주므로 처음 보는 값이 올 수 있고, 그때 아무 톤이나 고르면 색이
            // 안 붙는 게 아니라 **틀린 색이 붙는다**(`RoadTrafficCard`가 도로
            // 지표에 색을 안 붙이는 것과 같은 판단이다).
            valueClassName: toneTextClass(airGradeTone(weather.airGrade)),
            tab: 'weather' as DetailTabId,
          },
        ]),

    ...(road === null || road.index === ''
      ? []
      : [
          {
            key: 'road',
            icon: 'road' as IconName,
            label: t('도로'),
            // **여기서는 「도로」를 안 붙인 키를 쓴다.** 절과 칩은
            // `t('도로 원활')`을 쓰는데(근거는 `RoadTrafficCard`의 주석 —
            // 예전에 값 `원활`이 혼잡도 헤드라인의 같은 낱말과 다퉜다), 이
            // 카드에는 바로 위에 「도로」라는 이름표가 이미 있어 그대로 쓰면
            // 「도로 / 도로 원활」이 된다. 다투던 상대는 2026-08-20에
            // 사라졌으므로(`congestionHeadline` → `congestionSentence`) 맨 값을
            // 키로 써도 뜻이 안 겹친다. `i18n.test.ts`의 `ROAD_STATE_LABELS`가
            // 이 세 키를 사전에 붙들어 둔다.
            value: t(road.index),
            // 시안(stitch_ui_ux/_2)의 「원활」이 초록이다. 2026-08-21에 붙였고
            // 근거는 `roadIndexTone` — 대기질과 같은 표를 쓰므로 한 화면에서
            // 「원활」과 「좋음」과 「여유」가 같은 초록이다. 셋 다 「가도 된다」다.
            valueClassName: toneTextClass(roadIndexTone(road.index)),
            caption:
              road.speed === null
                ? undefined
                : t('평균 {속도}km/h', { 속도: road.speed }),
            tab: 'traffic' as DetailTabId,
          },
        ]),

    ...(cityInfo === undefined || cityInfo.subway.length === 0
      ? []
      : [
          {
            key: 'subway',
            icon: 'subway' as IconName,
            label: t('지하철'),
            // **열차 수가 아니라 역·호선 수다.** 「12」라고 적으면 무엇이
            // 열둘인지 알 수 없다 — 도메인이 그 셈을 갖는다.
            value: t('{개수}곳', { 개수: subwayLineCount(cityInfo) }),
            caption: t('가까운 역'),
            tab: 'traffic' as DetailTabId,
          },
        ]),

    ...(cityInfo === undefined || cityInfo.parking.length === 0
      ? []
      : [
          {
            key: 'parking',
            icon: 'parking' as IconName,
            label: t('주차'),
            value: t('{개수}곳', { 개수: cityInfo.parking.length }),
            // **비율은 「아는 것 중에서」다.** 면수를 모르는 주차장은 분모에서도
            // 빠진다(`parkingVacancyRate`). 하나도 못 세면 캡션이 없다 —
            // 0%로 접으면 「자리가 하나도 없다」는 정반대 뜻이 된다.
            caption:
              parkingVacancyRate(cityInfo.parking) === null
                ? t('주변 주차장')
                : t('{비율}% 비어 있어요', {
                    비율: parkingVacancyRate(cityInfo.parking) ?? 0,
                  }),
            tab: 'nearby' as DetailTabId,
          },
        ]),

    ...(cityInfo === undefined || cityInfo.bikes.length === 0
      ? []
      : [
          {
            key: 'bikes',
            icon: 'bike' as IconName,
            label: t('따릉이'),
            // 시안(stitch_ui_ux/_2)의 「18대 / 대여 가능」이다. 대여소 수보다
            // 자전거 수가 답에 가깝다 — 「대여소 3곳」은 거기 자전거가 있는지를
            // 말하지 않는다. 대수를 모르는 대여소가 섞이면 그것만 빠진다.
            value:
              totalBikes(cityInfo.bikes) === null
                ? t('{개수}곳', { 개수: cityInfo.bikes.length })
                : t('{대수}대', { 대수: totalBikes(cityInfo.bikes) ?? 0 }),
            // 시안이 이 값만 파랑으로 둔다. **혼잡도 톤이 아니라 primary다** —
            // 「지금 빌릴 수 있다」는 좋고 나쁨의 눈금이 아니라 **할 수 있는
            // 일**이라, 네 톤에 얹으면 「여유」와 같은 뜻으로 읽힌다.
            //
            // 대수를 못 세어 대여소 수로 떨어지면 색을 뺀다. 그 숫자는 자전거가
            // 있는지를 말하지 않아서 강조할 것이 없다.
            valueClassName:
              totalBikes(cityInfo.bikes) === null ? undefined : 'text-primary',
            caption:
              totalBikes(cityInfo.bikes) === null ? t('대여소') : t('대여 가능'),
            tab: 'nearby' as DetailTabId,
          },
        ]),

    ...(cityInfo === undefined || cityInfo.events.length === 0
      ? []
      : [
          {
            key: 'events',
            icon: 'event' as IconName,
            label: t('문화행사'),
            value: t('{개수}건', { 개수: cityInfo.events.length }),
            caption: t('진행 중'),
            tab: 'events' as DetailTabId,
          },
        ]),
  ]

  if (cards.length === 0) {
    return null
  }

  return (
    <div className="grid grid-cols-2 gap-2 px-4">
      {cards.map((card) => (
        <SummaryCard
          key={card.key}
          icon={card.icon}
          label={card.label}
          value={card.value}
          caption={card.caption}
          valueClassName={card.valueClassName}
          dotClassName={card.dotClassName}
          tab={card.tab}
          tabLabel={t(tabLabel(card.tab))}
          onOpen={onOpenTab}
        />
      ))}
    </div>
  )
}
