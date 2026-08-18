import { t } from '../../i18n/t'
import { groupSubwayArrivals, type SubwayArrival } from '../../domain/cityInfo'

/** 한 묶음에 보여줄 열차 수. detail_page.png도 역·호선마다 셋이다. */
const VISIBLE_LIMIT = 3

interface Props {
  readonly arrivals: readonly SubwayArrival[]
}

/**
 * 지하철 실시간 도착. `citydata`의 SUB_STTS를 역·호선으로 묶어 그린다.
 *
 * 도착 메세지는 **원문 그대로** 적는다 — 「4분 20초 후」와 「전역 출발」이
 * 같은 필드로 오는데 값 목록이 명세에 없다(`ROAD_TRAFFIC_IDX`와 같은 규칙).
 * 「분」을 숫자로 뽑아 정렬하거나 색을 붙이면 처음 보는 문구에서 틀린다.
 */
export function SubwayArrivals({ arrivals }: Props) {
  const groups = groupSubwayArrivals(arrivals)

  if (groups.length === 0) {
    return null
  }

  return (
    <div className="flex flex-col gap-4">
      {groups.map((group) => {
        const visible = group.arrivals.slice(0, VISIBLE_LIMIT)
        const hidden = group.arrivals.length - visible.length
        const title = group.line === ''
          ? group.station
          : `${group.station} ${group.line}`

        return (
          <div key={title}>
            <p className="flex items-baseline gap-1.5">
              <span className="text-body-md font-bold text-on-surface">
                {group.station}
              </span>
              {/* 호선 셋이 다 비면 이 칸이 없다. 빈 자리를 남기느니 역명만 적는다. */}
              {group.line !== '' && (
                <span className="text-label-sm text-on-surface-variant">
                  {group.line}
                </span>
              )}
            </p>

            {/* role="list"를 명시하는 이유: preflight의 list-style:none이 WebKit에서
                목록 시맨틱을 지운다. 토스 iOS 웹뷰가 WebKit이다.
                aria-label이 있어야 묶음이 여럿일 때 어느 역의 목록인지 알 수 있다. */}
            <ul
              role="list"
              aria-label={t('{역} 도착 열차', { 역: title })}
              className="mt-1.5 flex flex-col gap-1.5"
            >
              {visible.map((entry, index) => (
                <li
                  // 같은 방향·같은 메세지가 겹칠 수 있어(성수행 셋) 순번을 함께 쓴다.
                  key={`${entry.direction}-${entry.message}-${index}`}
                  className="flex items-baseline justify-between gap-3"
                >
                  <span className="min-w-0 truncate text-label-md text-on-surface-variant">
                    {entry.direction === '' ? entry.terminal : entry.direction}
                  </span>
                  {/* 원문 그대로다. 실측값이 「9분 후 (동대입구)」처럼 괄호까지
                      포함해 오므로 우리가 덧붙일 것이 없다. */}
                  <span className="shrink-0 text-label-md text-on-surface">
                    {entry.message}
                  </span>
                </li>
              ))}
            </ul>

            {/* 조용히 자르지 않는다 — 잘렸다는 사실이 화면에 남아야 한다. */}
            {hidden > 0 && (
              <p className="mt-1.5 text-label-sm text-outline">{t('외 {개수}대', { 개수: hidden })}</p>
            )}
          </div>
        )
      })}
    </div>
  )
}
