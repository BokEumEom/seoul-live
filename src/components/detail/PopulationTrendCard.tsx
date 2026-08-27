import { t } from '../../i18n/t'
import {
  hasPopulationTrend,
  isReadableChange,
  type PopulationChange,
  type PopulationTrend,
} from '../../domain/populationTrend'
import { Icon } from '../common/Icon'

interface Props {
  readonly trend: PopulationTrend
}

/**
 * 「1시간 전보다 7% 많아요」. 서울 인파레이더 상세의 대비 세 칸이다.
 *
 * **이 앱이 못 하던 말이다.** 공식 API는 과거를 안 줘서(요청 인자에 날짜가 없다)
 * 지금까지 할 수 있는 말이 「지금은 보통이에요」뿐이었다. 이 셋은 SeoulRtd가
 * 이미 계산해 주는 값이고 **인증키를 안 써서 하루 1,000회에서 1원도 안 나간다**
 * (`domain/populationTrend.ts`).
 *
 * **혼잡도 톤을 쓰지 않는다.** 늘어난 것이 곧 나쁜 것이 아니다 — 여유에서
 * 여유로 7% 늘어도 여전히 여유이고, 새벽에 「300% 증가」는 아무 일도 아니다.
 * 색을 칠하면 4단계가 말하지 않은 판정을 색이 대신 말한다. 방향은 화살표가
 * 지고, 그림은 소리 채널에 안 실리므로 낱말이 함께 선다(WCAG 1.4.1).
 */
export function PopulationTrendCard({ trend }: Props) {
  if (!hasPopulationTrend(trend)) {
    return null
  }

  const cells = [
    { key: 'lastHour', label: t('1시간 전'), change: trend.lastHour },
    { key: 'lastThreeHours', label: t('3시간 전'), change: trend.lastThreeHours },
    { key: 'lastMonth', label: t('한달 전'), change: trend.lastMonth },
  ]

  return (
    <section className="mx-4 rounded-card border border-outline-variant bg-surface-container-lowest p-4">
      <h3 className="text-headline-sm text-on-surface">{t('인파 변화')}</h3>
      {/* role="list"를 명시하는 이유는 다른 목록과 같다 — preflight의
          list-style:none이 WebKit에서 목록 시맨틱을 지운다. */}
      <ul role="list" aria-label={t('인파 변화')} className="mt-3 flex gap-2">
        {/* **못 읽은 칸은 자리도 안 만든다.** 3열 격자로 두면 빈 칸이 구멍으로
            남는데, `flex-1`이라 읽은 것끼리 폭을 나눠 가진다. */}
        {cells.filter((cell) => isReadableChange(cell.change)).map((cell) => (
          <TrendCell key={cell.key} label={cell.label} change={cell.change} />
        ))}
      </ul>
    </section>
  )
}

function TrendCell({
  label,
  change,
}: {
  readonly label: string
  readonly change: PopulationChange
}) {
  const up = change.direction === 'up'

  return (
    <li className="min-w-0 flex-1 rounded-card bg-surface-container-low p-3">
      <p className="truncate text-label-sm text-on-surface-variant">{label}</p>
      <p className="mt-1 flex items-center gap-0.5 text-label-md font-bold text-on-surface">
        <Icon name={up ? 'arrowUp' : 'arrowDown'} className="size-4 text-outline" />
        {/* **`t()`로 안 감싼다.** `%`는 한국어가 아니라 두 언어에서 같고, 이
            저장소가 습도·강수확률·비율에서 쓰는 관례가 그것이다. 값은 서울이
            준 그대로다 — 「7.0%」의 꼬리 0을 우리가 붙이지 않는다. */}
        {change.percent}%
        {/* **낱말이 방향의 두 번째 채널이다.** 화살표는 `aria-hidden`이라
            (`Icon`) 이게 없으면 스크린리더에서 「1시간 전 7%」가 되어 는 건지
            준 건지 사라진다. 값 뒤에 두어 「7% 증가」로 읽힌다. */}
        <span className="sr-only">{up ? t('증가') : t('감소')}</span>
      </p>
    </li>
  )
}
