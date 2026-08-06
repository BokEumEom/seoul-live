import { PRESETS, type PresetKey } from '../../domain/presets'

interface Props {
  readonly counts: Readonly<Record<PresetKey, number>>
  readonly value: PresetKey | null
  readonly onChange: (next: PresetKey | null) => void
}

// 지도 위에 떠 있으므로 바깥 컨테이너에 pointer-events-auto가 필요하다.
// RecenterButton과 같은 제약이다.
export function PresetFilter({ counts, value, onChange }: Props) {
  return (
    <div
      role="tablist"
      aria-label="목적별 필터"
      className="pointer-events-auto absolute inset-x-0 top-4 z-20 flex gap-2 overflow-x-auto px-4"
    >
      {PRESETS.map((preset) => {
        const count = counts[preset.key]
        const selected = value === preset.key

        return (
          <button
            key={preset.key}
            type="button"
            role="tab"
            aria-selected={selected}
            // 0이면 누를 수 없다. 눌렀는데 아무 일도 안 일어나는 순간을 만들지
            // 않는다 — 프리셋은 실시간 혼잡도를 쓰므로 실제로 0이 된다.
            disabled={count === 0}
            // 선택된 칩을 다시 누르면 해제된다. 「전체」 칩을 따로 두면 지도
            // 상단을 한 칸 더 먹는다.
            onClick={() => onChange(selected ? null : preset.key)}
            className={`min-h-12 shrink-0 rounded-full px-4 text-label-md font-semibold shadow-floating disabled:opacity-50 ${
              selected
                ? 'bg-primary text-on-primary'
                : 'bg-surface text-on-surface-variant'
            }`}
          >
            {preset.label} {count}
          </button>
        )
      })}
    </div>
  )
}
