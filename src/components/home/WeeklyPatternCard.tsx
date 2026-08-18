import { t } from '../../i18n/t'
import { congestionTone } from '../../domain/congestion'
import {
  cellLevel,
  observationTotal,
  PATTERN_BUCKET_HOURS,
  PATTERN_BUCKETS,
  type WeekPattern,
} from '../../domain/pattern'
import { EMPTY_CELL_CLASS, TONE_FILL_CLASS } from '../common/toneClass'

interface Props {
  readonly pattern: WeekPattern
  /** 지금 시간대 열을 짚는 데 쓴다. 인자로 받아야 테스트가 시계를 안 건드린다. */
  readonly now: Date
}

// `Date.getDay()`는 0이 일요일인데 사람이 읽는 주는 월요일부터다. 저장은
// getDay() 축 그대로 두고 **표시 순서만** 여기서 정한다 — 축을 바꾸면 저장된
// 값과 어긋난다.
const DAY_ORDER: readonly number[] = [1, 2, 3, 4, 5, 6, 0]
// **모듈 최상위에서 `t()`를 부르면 안 된다.** import 시점에 한 번 계산되어
// 그때의 언어로 굳는다 — 언어를 바꿔도 이 표만 예전 말로 남는다. 함수로 두면
// 렌더마다 다시 불려 따라온다.
const DAY_KEYS: readonly string[] = ['일', '월', '화', '수', '목', '금', '토']
function dayLabel(day: number): string {
  return t(DAY_KEYS[day])
}

/** 시간대 머리글. 도메인의 `bucketLabel`은 한국어를 만들므로 여기서 만든다. */
function hourLabel(bucket: number): string {
  return t('{시}시', { 시: bucket * PATTERN_BUCKET_HOURS })
}

const BUCKETS: readonly number[] = Array.from({ length: PATTERN_BUCKETS }, (_, index) => index)

// 요일×시간은 2차원 표다. div 격자로 그리면 스크린리더가 어느 칸이 어느 요일·
// 시간인지 알 길이 없다. 진짜 <table>로 두면 행·열 머리글이 칸마다 자동으로
// 딸려 읽힌다 — 56칸에 각각 맥락을 손으로 붙이지 않아도 된다.
//
// **샘플(서울 인파레이더)은 7×24인데 우리는 7×8이다. 따라가지 않는다.**
// 그쪽은 서버에 과거를 쌓아 두고 「표본 265일간」을 그린다. 우리는 서울 API가
// 과거를 안 줘서(요청 인자에 날짜가 없다) 이 기기에서 상세를 열 때마다 한 칸씩
// 쌓는다 — 56칸도 다 채우려면 56번을 서로 다른 요일·시간대에 열어야 한다.
// 168칸으로 늘리면 표가 세 배로 비고, 「관측 없음」이 화면의 거의 전부가 된다.
// 칸 크기도 문제다: 390px에서 24열이면 한 칸이 12.5px다.
//
// 서버 수집이 생기면(PLAN.md 4차) 그때 24열이 맞다. 바꿀 자리는
// `PATTERN_BUCKET_HOURS` 하나이고, 표시·저장·라벨이 전부 거기서 파생된다.
export function WeeklyPatternCard({ pattern, now }: Props) {
  const total = observationTotal(pattern)
  const currentBucket = Math.floor(now.getHours() / PATTERN_BUCKET_HOURS)
  // **오늘이 어느 행인지도 짚어야 한다.** 지금 시간대 열만 짚었을 때는
  // 「지금 이 시각」이 일곱 요일에 걸쳐 강조되어, 표 안에서 제 위치를
  // 찾을 수가 없었다. 행과 열이 만나는 한 칸이 「지금 여기」다.
  const currentDay = now.getDay()

  return (
    <section className="mx-4 rounded-card border border-outline-variant bg-surface-container-lowest p-4">
      <h3 className="text-headline-sm text-on-surface">{t('요일×시간 패턴')}</h3>

      {/* 서울 API는 과거를 주지 않는다(요청 인자에 날짜가 없다). 이 표는 조회한
          것이 아니라 이 기기에서 본 것을 쌓은 것이라, 그 사실을 숨기지 않는다.
          숨기면 빈 칸이 「한산함」으로 오해된다. */}
      <p className="mt-1 text-label-sm text-on-surface-variant">
        {total === 0
          ? t('아직 모으는 중이에요. 이 명소를 열어볼 때마다 한 칸씩 채워져요.')
          : t('이 기기에서 {횟수}번 본 것을 모았어요.', { 횟수: total })}
      </p>

      <table className="mt-3 w-full table-fixed border-separate border-spacing-0.5">
        <caption className="sr-only">
          {t('요일과 시간대별 혼잡도. 관측하지 않은 칸은 「관측 없음」으로 읽힙니다.')}
        </caption>
        <thead>
          <tr>
            {/* 요일 열의 머리글. 빈 칸이지만 자리는 있어야 열이 안 밀린다. */}
            <th className="w-6" />
            {BUCKETS.map((bucket) => (
              <th
                key={bucket}
                scope="col"
                aria-current={bucket === currentBucket ? 'time' : undefined}
                className={`pb-1 text-label-sm font-normal ${
                  bucket === currentBucket ? 'text-primary' : 'text-on-surface-variant'
                }`}
              >
                {/* 8칸에 「0시」를 다 적으면 좁은 시트에서 겹친다. 눈에는 하나
                    걸러 보여주고 소리로는 전부 읽히게 둔다. */}
                <span aria-hidden={bucket % 2 === 1 ? true : undefined}>
                  {bucket % 2 === 0 ? hourLabel(bucket) : ''}
                </span>
                <span className="sr-only">{hourLabel(bucket)}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {DAY_ORDER.map((day) => (
            <tr key={day}>
              <th
                scope="row"
                aria-current={day === currentDay ? 'date' : undefined}
                className={`pr-1 text-right text-label-sm ${
                  day === currentDay
                    ? 'font-semibold text-primary'
                    : 'font-normal text-on-surface-variant'
                }`}
              >
                {dayLabel(day)}
              </th>
              {BUCKETS.map((bucket) => {
                const level = cellLevel(pattern, day, bucket)
                const isNow = day === currentDay && bucket === currentBucket
                return (
                  <td key={bucket} className="p-0">
                    <div
                      data-now={isNow ? '' : undefined}
                      className={`h-5 rounded-sm ${
                        level === null ? EMPTY_CELL_CLASS : TONE_FILL_CLASS[congestionTone(level)]
                      } ${
                        // 「지금 여기」한 칸은 굵게, 그 시각의 다른 요일은 옅게.
                        // 색을 바꾸지 않고 테두리로 짚는 이유는 채움이 이미
                        // 혼잡도를 말하고 있어서다 — `ForecastChart`의 「지금」
                        // 막대와 같은 규칙이다.
                        isNow
                          ? 'ring-2 ring-on-surface ring-inset'
                          : bucket === currentBucket
                            ? 'ring-1 ring-primary'
                            : ''
                      }`}
                    >
                      {/* 색만으로 값을 전하지 않는다. 행·열 머리글은 표가
                          붙여주지만 **값 자체는 칸 안에 있어야** 읽힌다. */}
                      <span className="sr-only">
                        {t('{요일}요일 {시각} {단계}', {
                          요일: dayLabel(day),
                          시각: hourLabel(bucket),
                          단계: level === null ? t('관측 없음') : t(level),
                        })}
                      </span>
                    </div>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-3 flex items-center gap-2">
        <span className="text-label-sm text-on-surface-variant">{t('여유')}</span>
        <div className="flex flex-1 gap-0.5">
          <div className={`h-1.5 flex-1 rounded-l-sm ${TONE_FILL_CLASS.calm}`} />
          <div className={`h-1.5 flex-1 ${TONE_FILL_CLASS.normal}`} />
          <div className={`h-1.5 flex-1 ${TONE_FILL_CLASS.busy}`} />
          <div className={`h-1.5 flex-1 rounded-r-sm ${TONE_FILL_CLASS.crowded}`} />
        </div>
        <span className="text-label-sm text-on-surface-variant">{t('붐빔')}</span>
      </div>
    </section>
  )
}
