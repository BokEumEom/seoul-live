import {
  subwayArrivalText,
  subwayDirectionText,
  subwayLineText,
} from '../../i18n/subway'
import { t } from '../../i18n/t'
import { groupSubwayArrivals, type SubwayArrival } from '../../domain/cityInfo'
import { subwayLineBadge } from '../../domain/subwayLine'
import type { SubwayStationFacilities } from '../../domain/subwayFacility'
import { ElevatorMark, FacilityRepairs } from './SubwayFacilities'
import { SubwayLineBadge } from './SubwayLineBadge'

/** 한 묶음에 보여줄 열차 수. detail_page.png도 역·호선마다 셋이다. */
const VISIBLE_LIMIT = 3

interface Props {
  readonly arrivals: readonly SubwayArrival[]
  /** 역별 승강기. 도착 묶음과 역·호선으로 이어진다 */
  readonly facilities: readonly SubwayStationFacilities[]
}

/**
 * 지하철 실시간 도착. `citydata`의 SUB_STTS를 역·호선으로 묶어 그린다.
 *
 * 도착 메세지는 **원문 그대로** 적는다 — 「4분 20초 후」와 「전역 출발」이
 * 같은 필드로 오는데 값 목록이 명세에 없다(`ROAD_TRAFFIC_IDX`와 같은 규칙).
 * 「분」을 숫자로 뽑아 정렬하거나 색을 붙이면 처음 보는 문구에서 틀린다.
 */
export function SubwayArrivals({ arrivals, facilities }: Props) {
  const groups = groupSubwayArrivals(arrivals, facilities)

  if (groups.length === 0) {
    return null
  }

  return (
    <div className="flex flex-col gap-4">
      {groups.map((group) => {
        const visible = group.arrivals.slice(0, VISIBLE_LIMIT)
        const hidden = group.arrivals.length - visible.length
        // 역 이름은 옮기지 않는다(로마자 표기가 이 앱에 없다). 호선처럼
        // 모양이 정해진 조각만 `i18n/subway.ts`가 옮긴다.
        const line = subwayLineText(group.line)
        const title = line === '' ? group.station : `${group.station} ${line}`

        return (
          <div key={title}>
            {/* 시안 `_4`의 「⑤ 광화문역」이다. 배지가 앞이고 역 이름이 뒤다 —
                노선색이 먼저 눈에 들어와야 어느 줄을 읽을지가 정해진다. */}
            <p className="flex items-center gap-2">
              <SubwayLineBadge line={group.line} />
              <span className="text-body-md font-bold text-on-surface">
                {group.station}
              </span>
              {/* **배지가 없을 때만 글자로 적는다.** 표에 없는 노선이면
                  `subwayLineBadge`가 `null`이라 배지가 안 그려지는데, 그때까지
                  호선을 잃으면 「강남」만 남는다. 호선 셋이 다 비면 이 칸도
                  없다 — 빈 자리를 남기느니 역명만 적는다. */}
              {subwayLineBadge(group.line) === null && line !== '' && (
                <span className="text-label-sm text-on-surface-variant">
                  {line}
                </span>
              )}
              {/* 시안 `_4`가 이 줄 끝(`ml-auto`)에 교통약자 표시를 놓는다.
                  「있다」만 말하는 이유는 `ElevatorMark`에 적었다. */}
              <ElevatorMark facilities={group.facilities} />
            </p>

            {/* role="list"를 명시하는 이유: preflight의 list-style:none이 WebKit에서
                목록 시맨틱을 지운다. 토스 iOS 웹뷰가 WebKit이다.
                aria-label이 있어야 묶음이 여럿일 때 어느 역의 목록인지 알 수 있다. */}
            <ul
              role="list"
              aria-label={t('{역} 도착 열차', { 역: title })}
              className="mt-2 flex flex-col gap-1.5"
            >
              {visible.map((entry, index) => (
                <li
                  // 같은 방향·같은 메세지가 겹칠 수 있어(성수행 셋) 순번을 함께 쓴다.
                  key={`${entry.direction}-${entry.message}-${index}`}
                  // **줄마다 상자다**(시안 `_4`). 배경이 없으면 방면과 도착
                  // 시각이 양 끝에 떨어져 있어 세 줄이 여섯 조각으로 흩어진다.
                  className="flex items-baseline justify-between gap-3 rounded-card bg-surface-container-low px-2.5 py-1.5"
                >
                  <span className="min-w-0 truncate text-label-md text-on-surface-variant">
                    {subwayDirectionText(
                      entry.direction === '' ? entry.terminal : entry.direction,
                    )}
                  </span>
                  {/* 한국어에서는 원문 그대로다 — 실측값이 「9분 후 (동대입구)」처럼
                      괄호까지 포함해 오므로 우리가 덧붙일 것이 없다. 영어에서는
                      **아는 모양이 통째로 맞을 때만** 옮기고 아니면 원문이
                      나간다(`i18n/subway.ts`). 절 머리만 영어이고 안쪽이 전부
                      한국어면 번역하지 않은 화면으로 읽힌다. */}
                  {/* 시안 `_4`가 도착 시각만 primary로 띄운다. 이 줄에서
                      사용자가 찾는 값은 「몇 분」이고 방면은 그 값을 고르는
                      기준이다 — 색이 그 차례를 말한다. */}
                  <span className="shrink-0 text-label-md font-bold text-primary">
                    {subwayArrivalText(entry.message)}
                  </span>
                </li>
              ))}
            </ul>

            {/* 조용히 자르지 않는다 — 잘렸다는 사실이 화면에 남아야 한다. */}
            {hidden > 0 && (
              <p className="mt-1.5 text-label-sm text-outline">{t('외 {개수}대', { 개수: hidden })}</p>
            )}

            {/* **도착 아래다.** 이 절을 여는 질문은 「열차가 언제 오나」이고
                승강기는 그 다음이다 — 실호출에서 한 역이 승강기 스물여덟 건까지
                오므로 위에 두면 도착 시각이 그 아래로 밀린다. */}
            <FacilityRepairs facilities={group.facilities} title={title} />
          </div>
        )
      })}
    </div>
  )
}
