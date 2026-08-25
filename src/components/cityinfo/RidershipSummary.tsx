import { t } from '../../i18n/t'
import {
  hasRidershipRange,
  ridershipFlow,
  type Ridership,
  type RidershipWindow,
} from '../../domain/cityInfo'
import { TONE_TEXT_CLASS } from '../common/toneClass'

interface Props {
  readonly ridership: Ridership
}

/** 「550~600」. 한쪽만 읽히면 그 값 하나만 적는다 — 없는 폭을 지어내지 않는다. */
function range(min: number | null, max: number | null): string | null {
  if (min === null && max === null) {
    return null
  }
  if (min === null || max === null) {
    return (min ?? max ?? 0).toLocaleString()
  }
  return min === max
    ? min.toLocaleString()
    : `${min.toLocaleString()}~${max.toLocaleString()}`
}

function Counts({ window: span }: { readonly window: RidershipWindow }) {
  const boarding = range(span.boardingMin, span.boardingMax)
  const alighting = range(span.alightingMin, span.alightingMax)

  return (
    <p className="text-body-md text-on-surface">
      {boarding !== null && t('승차 {인원}명', { 인원: boarding })}
      {boarding !== null && alighting !== null && ' · '}
      {alighting !== null && t('하차 {인원}명', { 인원: alighting })}
    </p>
  )
}

/**
 * 지하철·버스 승하차 인원. `LIVE_SUB_PPLTN`·`LIVE_BUS_PPLTN`을 그린다.
 *
 * **열여섯 개 숫자를 다 늘어놓지 않는다.** 명세는 네 시간창 × 승하차 × min/max로
 * 열여섯 값을 주는데, 그걸 그대로 그리면 표 하나가 통째로 화면을 먹고도 사용자의
 * 질문에는 답하지 않는다. 여기서 답하는 것은 둘이다 — **지금 사람이 모이는가**
 * (10분 창), **오늘 얼마나 다녔나**(누적).
 *
 * **10분 창으로 방향을 읽는 이유.** 5분은 표본이 작아 흔들리고, 30분은 이미
 * 「지금」이 아니다. 실호출에서 광화문 10분 승차 550~600 대 하차 900~950이라
 * 방향이 또렷하게 갈렸다.
 *
 * **30분·5분 창은 읽되 안 그린다.** 파서는 넷 다 담는다 — 나중에 그릴 자리가
 * 생기면 도메인을 안 건드려도 되고, 지금 안 그리는 것은 화면의 결정이다.
 */
export function RidershipSummary({ ridership }: Props) {
  const recent = ridership.last10Minutes
  const flow = ridershipFlow(recent)
  const showRecent = hasRidershipRange(recent)
  const showTotal = hasRidershipRange(ridership.total)

  if (!showRecent && !showTotal && ridership.stopCount === null) {
    return null
  }

  return (
    <div className="rounded-card bg-surface-container-low p-3">
      {/* **방향이 이 절의 머리다.** 숫자보다 이 한 문장이 먼저 읽힌다.
          겹치는 구간이면 `flow`가 null이라 문장 자체가 안 나온다 — 「비슷해요」
          같은 말을 지어내지 않는다. 모르는 것은 안 적는 편이 낫다. */}
      {flow !== null && (
        <p
          className={`text-title-sm ${
            flow === 'arriving' ? TONE_TEXT_CLASS.busy : TONE_TEXT_CLASS.calm
          }`}
        >
          {flow === 'arriving' ? t('사람이 모이는 중이에요') : t('사람이 빠지는 중이에요')}
        </p>
      )}

      {showRecent && (
        <div className={flow === null ? '' : 'mt-2'}>
          <p className="text-label-sm text-on-surface-variant">{t('최근 10분')}</p>
          <Counts window={recent} />
        </div>
      )}

      {showTotal && (
        <div className="mt-2">
          <p className="text-label-sm text-on-surface-variant">{t('오늘 첫차 이후')}</p>
          <Counts window={ridership.total} />
        </div>
      )}

      {/* 역·정류장 개수는 「이 근처가 얼마나 열려 있나」를 말한다. 기준 년월일이
          함께 오지만 개수는 달 단위로나 바뀌는 값이라 날짜는 안 적는다. */}
      {ridership.stopCount !== null && (
        <p className="mt-2 text-label-sm text-outline">
          {t('이 명소 안 {개수}곳 기준', { 개수: ridership.stopCount })}
        </p>
      )}
    </div>
  )
}
