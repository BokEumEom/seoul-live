import { congestionTone } from '../../domain/congestion'
import {
  bucketLabel,
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
const DAY_LABEL: readonly string[] = ['일', '월', '화', '수', '목', '금', '토']

const BUCKETS: readonly number[] = Array.from({ length: PATTERN_BUCKETS }, (_, index) => index)

// 요일×시간은 2차원 표다. div 격자로 그리면 스크린리더가 어느 칸이 어느 요일·
// 시간인지 알 길이 없다. 진짜 <table>로 두면 행·열 머리글이 칸마다 자동으로
// 딸려 읽힌다 — 56칸에 각각 맥락을 손으로 붙이지 않아도 된다.
export function WeeklyPatternCard({ pattern, now }: Props) {
  const total = observationTotal(pattern)
  const currentBucket = Math.floor(now.getHours() / PATTERN_BUCKET_HOURS)

  return (
    <section className="mx-4 rounded-card border border-outline-variant bg-surface-container-lowest p-4">
      <h3 className="text-headline-sm text-on-surface">요일×시간 패턴</h3>

      {/* 서울 API는 과거를 주지 않는다(요청 인자에 날짜가 없다). 이 표는 조회한
          것이 아니라 이 기기에서 본 것을 쌓은 것이라, 그 사실을 숨기지 않는다.
          숨기면 빈 칸이 「한산함」으로 오해된다. */}
      <p className="mt-1 text-label-sm text-on-surface-variant">
        {total === 0
          ? '아직 모으는 중이에요. 이 명소를 열어볼 때마다 한 칸씩 채워져요.'
          : `이 기기에서 ${String(total)}번 본 것을 모았어요.`}
      </p>

      <table className="mt-3 w-full table-fixed border-separate border-spacing-0.5">
        <caption className="sr-only">
          요일과 시간대별 혼잡도. 관측하지 않은 칸은 「관측 없음」으로 읽힙니다.
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
                  {bucket % 2 === 0 ? bucketLabel(bucket) : ''}
                </span>
                <span className="sr-only">{bucketLabel(bucket)}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {DAY_ORDER.map((day) => (
            <tr key={day}>
              <th
                scope="row"
                className="pr-1 text-right text-label-sm font-normal text-on-surface-variant"
              >
                {DAY_LABEL[day]}
              </th>
              {BUCKETS.map((bucket) => {
                const level = cellLevel(pattern, day, bucket)
                return (
                  <td key={bucket} className="p-0">
                    <div
                      className={`h-5 rounded-sm ${
                        level === null ? EMPTY_CELL_CLASS : TONE_FILL_CLASS[congestionTone(level)]
                      } ${bucket === currentBucket ? 'ring-1 ring-primary' : ''}`}
                    >
                      {/* 색만으로 값을 전하지 않는다. 행·열 머리글은 표가
                          붙여주지만 **값 자체는 칸 안에 있어야** 읽힌다. */}
                      <span className="sr-only">
                        {DAY_LABEL[day]}요일 {bucketLabel(bucket)} {level ?? '관측 없음'}
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
        <span className="text-label-sm text-on-surface-variant">여유</span>
        <div className="flex flex-1 gap-0.5">
          <div className={`h-1.5 flex-1 rounded-l-sm ${TONE_FILL_CLASS.calm}`} />
          <div className={`h-1.5 flex-1 ${TONE_FILL_CLASS.normal}`} />
          <div className={`h-1.5 flex-1 ${TONE_FILL_CLASS.busy}`} />
          <div className={`h-1.5 flex-1 rounded-r-sm ${TONE_FILL_CLASS.crowded}`} />
        </div>
        <span className="text-label-sm text-on-surface-variant">붐빔</span>
      </div>
    </section>
  )
}
