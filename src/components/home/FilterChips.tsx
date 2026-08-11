import { filterLabel, PRESETS, type FilterKey } from '../../domain/presets'

// 이름은 domain/presets의 `filterLabel`에서만 온다. 여기에 복사해두면 라벨을
// 고칠 때 칩만 옛 이름으로 남고, 빈 목록 문구가 지목하는 이름과 갈린다.
// 순서는 이 한 줄이 정본이다 — 즐겨찾기가 먼저고 그다음이 목적 프리셋이다.
const CHIPS: readonly FilterKey[] = ['fav', ...PRESETS.map((preset) => preset.key)]

interface Props {
  readonly counts: Readonly<Record<FilterKey, number>>
  readonly value: FilterKey | null
  readonly onChange: (next: FilterKey | null) => void
}

// 지도 위에 떠 있으므로 바깥 컨테이너에 pointer-events-auto가 필요하다.
// RecenterButton과 같은 제약이다.
export function FilterChips({ counts, value, onChange }: Props) {
  return (
    <div
      role="tablist"
      aria-label="필터"
      className="pointer-events-auto flex gap-2 overflow-x-auto px-4 pb-1"
    >
      {CHIPS.map((chip) => {
        const count = counts[chip]
        const selected = value === chip

        return (
          <button
            key={chip}
            type="button"
            role="tab"
            aria-selected={selected}
            // 0이면 누를 수 없다. 눌렀는데 아무 일도 안 일어나는 순간을 만들지
            // 않는다 — 프리셋은 실시간 혼잡도를 쓰므로 실제로 0이 된다.
            //
            // 지금 골라둔 칩은 예외다. 즐겨찾기를 다 지우거나 카테고리를 좁혀
            // 0이 되면 비활성으로 굳어 필터를 풀 방법이 사라진다. 이 칩을 누르는
            // 것은 "아무 일도 안 일어나는" 경우가 아니라 해제다.
            disabled={count === 0 && !selected}
            // 선택된 칩을 다시 누르면 해제된다. 「전체」 칩을 따로 두면 지도
            // 상단을 한 칸 더 먹는다.
            onClick={() => onChange(selected ? null : chip)}
            // 높이가 40px이라 이 저장소의 48px 탭 규약(SearchBar·AreaListItem의
            // min-h-12)을 벗어난다. 흡수한 PresetFilter는 min-h-12였다.
            // SortSegmented의 min-h-10과 같은 급이고 WCAG 2.5.8(24px)은 통과한다.
            //
            // **Task 9에서 40px로 확정했다.** 「검색 바 + 필터 칩 열」이 800px
            // 기준 0~88px을 차지한다는 계산이 이 값에 달려 있고, 그 88px이
            // full(92%)에서 손잡이 히트 영역(44~88px)을 통째로 덮는다는 근거가
            // 되어 「full에서는 이 열을 렌더하지 않는다」는 결정으로 이어졌다.
            // 여기서 48px로 올리면 그 예산이 틀어진다 — 올릴 거면 HomeScreen의
            // `showSearchOverlay` 근거부터 다시 계산해야 한다.
            className={`min-h-10 shrink-0 rounded-full px-4 text-label-md font-semibold shadow-floating disabled:opacity-50 ${
              selected
                ? 'bg-primary text-on-primary'
                : 'bg-surface text-on-surface-variant'
            }`}
          >
            {chip === 'fav' && (
              // ★는 장식이다. 접근성 이름에 넣으면 "블랙 스타 내 장소 3"으로
              // 읽히는데 「내 장소」가 이미 같은 말을 한다.
              <span aria-hidden="true" className="mr-1">
                ★
              </span>
            )}
            {filterLabel(chip)} {count}
          </button>
        )
      })}
    </div>
  )
}
