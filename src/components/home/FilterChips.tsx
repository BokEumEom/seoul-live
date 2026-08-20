import { t } from '../../i18n/t'
import { Icon } from '../common/Icon'
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
// HomeScreen의 오버레이 컨테이너가 `pointer-events-none`이라(칩 줄과 검색 바
// 사이의 빈 곳에서 지도를 끌 수 있어야 한다) 여기서 되살리지 않으면 칩이
// 아예 안 눌린다.
export function FilterChips({ counts, value, onChange }: Props) {
  return (
    // **탭이 아니라 토글 버튼 묶음이다.** `role="tab"`은 `tabpanel`과 짝을
    // 이루고 `aria-controls`·화살표 이동·roving tabindex가 따라오는 패턴인데
    // 이 줄에는 넷 다 없었다 — 보조기술이 「탭 목록, 탭 1/4」이라 알리고
    // 사용자는 오지 않는 화살표 동작을 기대하게 된다. 한 화면에 tablist가
    // 셋이나 있기도 했다(이 줄·정렬·카테고리).
    //
    // 하는 일은 목록을 거르는 토글이라 `aria-pressed`가 동작과 맞고, 버튼이
    // 저마다 탭 순서에 드는 것이 정상이라 못 지킬 계약이 생기지 않는다.
    // `radiogroup`도 화살표 이동을 요구하는 데다, 고른 칩을 다시 눌러 해제할
    // 수 있는 이 줄은 라디오의 「반드시 하나」와도 어긋난다.
    <div
      role="group"
      aria-label={t("필터")}
      className="pointer-events-auto flex gap-2 overflow-x-auto scrollbar-none px-4 pb-1"
    >
      {CHIPS.map((chip) => {
        const count = counts[chip]
        const selected = value === chip

        return (
          <button
            key={chip}
            type="button"
            aria-pressed={selected}
            // 0이면 누를 수 없다. 눌렀는데 아무 일도 안 일어나는 순간을 만들지
            // 않는다 — 프리셋은 실시간 혼잡도를 쓰므로 실제로 0이 된다.
            //
            // 예외가 둘이다.
            //
            // (1) 지금 골라둔 칩. 즐겨찾기를 다 지우거나 카테고리를 좁혀 0이
            // 되면 비활성으로 굳어 필터를 풀 방법이 사라진다. 이 칩을 누르는
            // 것은 "아무 일도 안 일어나는" 경우가 아니라 해제다.
            //
            // (2) 「내 장소」. 프리셋의 0은 「지금 그런 곳이 없다」는 데이터
            // 사정이라 눌러도 나올 말이 없지만, 이쪽의 0은 **아직 안 써 본
            // 기능의 초기 상태**다. Task 10에서 즐겨찾기 화면이 사라지면서
            // 「어떻게 담는가」를 말하던 자리가 없어졌고, 그 답은 이 칩을 눌러야
            // 나오는 HomeScreen의 빈 목록 문구로 옮겨갔다 — 여기를 막으면
            // 신규 사용자에게는 이 기능에 닿을 길이 앱에 하나도 남지 않는다.
            // 그래서 이건 "아무 일도 안 일어나는" 경우가 아니다.
            disabled={count === 0 && !selected && chip !== 'fav'}
            // 선택된 칩을 다시 누르면 해제된다. 「전체」 칩을 따로 두면 지도
            // 상단을 한 칸 더 먹는다.
            onClick={() => onChange(selected ? null : chip)}
            // 높이가 40px이라 이 저장소의 48px 탭 규약(SearchBar·AreaListItem의
            // min-h-12)을 벗어난다. 흡수한 PresetFilter는 min-h-12였다.
            // SortSegmented의 min-h-10과 같은 급이고 WCAG 2.5.8(24px)은 통과한다.
            //
            // **Task 9에서 40px로 확정했다.** 「검색 바 + 필터 칩 열」이 화면
            // 위 0~112px을 차지한다는 계산이 이 값에 달려 있고(검색 바 64px +
            // 간격 4px + 이 줄 44px = 40px 칩 + 줄의 `pb-1`), 그 열이 full(92%)
            // 에서 손잡이 히트 영역(컨테이너 800px 기준 44~88px)을 통째로 덮는
            // 다는 근거가 되어 「full에서는 이 열을 렌더하지 않는다」는 결정으로
            // 이어졌다. 여기서 48px로 올리면 그 예산이 틀어진다 — 올릴 거면
            // HomeScreen의 오버레이 조건부 렌더 근거부터 다시 계산해야 한다.
            //
            // 112px은 Task 10에서 헤드리스 크롬으로 실측한 값이다. Task 9는
            // 88px로 적었는데 검색 바의 세로 패딩을 빠뜨린 오답이었다.
            className={`min-h-10 shrink-0 rounded-full px-4 text-label-md font-semibold shadow-floating disabled:opacity-50 ${
              selected
                ? 'bg-primary text-on-primary'
                : 'bg-surface text-on-surface-variant'
            }`}
          >
            {chip === 'fav' && (
              // 글리프는 장식이다. `Icon`이 `aria-hidden`이라 접근성 이름에는
              // 안 들어간다 — 「내 장소」가 이미 같은 말을 한다.
              //
              // **문자(★)가 아니라 아이콘이다.** 문자는 기기 폰트를 타서
              // 안드로이드와 iOS에서 굵기·크기가 갈렸고, 저장 버튼이 별에서
              // 책갈피로 바뀌면서(2026-08-20) 같은 뜻을 두 모양으로 말하게 됐다.
              <Icon name="bookmarkFilled" className="mr-1 inline size-4 align-[-2px]" />
            )}
            {t(filterLabel(chip))} {count}
          </button>
        )
      })}
    </div>
  )
}
