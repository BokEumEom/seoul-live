import type { CongestionTone } from '../../domain/congestion'
import { NEUTRAL_TONE_CLASS, TONE_CLASS } from './toneClass'

interface Props {
  /** `null`이면 값을 모른다는 뜻이다. 회색으로 떨어뜨린다. */
  readonly tone: CongestionTone | null
  readonly label: string
}

/** 혼잡도가 아닌 값(대기 등급, 주차 여유)을 같은 색 체계로 보여주는 배지. */
export function ToneBadge({ tone, label }: Props) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-label-sm ${
        tone === null ? NEUTRAL_TONE_CLASS : TONE_CLASS[tone]
      }`}
    >
      {label}
    </span>
  )
}
