import { t } from '../../i18n/t'
import { congestionTone } from '../../domain/congestion'
import type { CongestionLevel } from '../../domain/types'
import { TONE_CLASS } from './toneClass'

interface Props {
  readonly level: CongestionLevel | null
}

// DESIGN.md의 Chips 규격: 색점 + 텍스트, 완전한 라운드.
//
// 크기가 하나뿐인 이유: 상세 히어로가 유일한 "강조" 자리였는데 Task 8에서
// 그 자리마저 목록과 같은 배지를 쓴다. 같은 사실을 크기로 두 번 말하지 않는다.
const SIZE = 'px-2.5 py-1 text-label-sm'

export function CongestionBadge({ level }: Props) {
  if (level === null) {
    return (
      <span
        className={`inline-flex shrink-0 items-center gap-1.5 rounded-full bg-surface-container text-on-surface-variant ${SIZE}`}
      >
        {t('정보 없음')}
      </span>
    )
  }

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full ${SIZE} ${TONE_CLASS[congestionTone(level)]}`}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {t(level)}
    </span>
  )
}
