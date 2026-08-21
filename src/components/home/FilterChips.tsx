import { t } from '../../i18n/t'
import {
  filterLabel,
  isLevelKey,
  PRESETS,
  type FilterKey,
} from '../../domain/presets'
import { TONE_DOT_CLASS, TONE_DOT_ON_PRIMARY_CLASS } from '../common/toneClass'

// 이름은 domain/presets의 `filterLabel`에서만 온다. 여기에 복사해두면 라벨을
// 고칠 때 칩만 옛 이름으로 남고, 빈 목록 문구가 지목하는 이름과 갈린다.
// 순서도 `PRESETS`가 정본이다 — 혼잡도 넷이 먼저고 그다음이 목적이다.
//
// **「내 장소」가 여기 없다.** 지도 우하단 FAB으로 옮겼다(2026-08-20,
// `MapFabStack`). 그 자리가 비면서 혼잡도 넷이 한 줄에 들어왔다.
const CHIPS: readonly FilterKey[] = PRESETS.map((preset) => preset.key)

interface Props {
  readonly counts: Readonly<Record<FilterKey, number>>
  /** 「전체」 칩이 적는 수. 지금 카테고리·검색어까지 거른 뒤의 전부다. */
  readonly total: number
  readonly value: FilterKey | null
  readonly onChange: (next: FilterKey | null) => void
}

// 40px이라 이 저장소의 48px 탭 규약(SearchBar·AreaListItem의 min-h-12)을
// 벗어난다. WCAG 2.5.8(24px)은 통과한다.
//
// **Task 9에서 40px로 확정했고 예산이 여기 걸려 있다.** 「검색 바 + 필터 칩
// 열」이 화면 위 0~112px을 차지한다는 계산이 이 값에서 나오고(검색 바 64px +
// 간격 4px + 이 줄 44px = 40px 칩 + 줄의 `pb-1`), 그 열이 full(92%)에서
// 손잡이 히트 영역(컨테이너 800px 기준 44~88px)을 통째로 덮는다는 근거가 되어
// 「full에서는 이 열을 렌더하지 않는다」로 이어졌다. 올릴 거면 `HomeScreen`의
// 오버레이 조건부 렌더 근거부터 다시 계산해야 한다.
//
// **칩이 일곱으로 늘어도 이 예산은 그대로다** — 줄은 하나고 넘치는 만큼
// 가로로 스크롤한다(시안 stitch_ui_ux/_1의 상단도 `overflow-x-auto`다).
const CHIP = 'min-h-10 shrink-0 rounded-full px-4 text-label-md font-semibold shadow-floating disabled:opacity-50'

// 지도 위에 떠 있으므로 바깥 컨테이너에 pointer-events-auto가 필요하다.
// HomeScreen의 오버레이 컨테이너가 `pointer-events-none`이라(칩 줄과 검색 바
// 사이의 빈 곳에서 지도를 끌 수 있어야 한다) 여기서 되살리지 않으면 칩이
// 아예 안 눌린다.
export function FilterChips({ counts, total, value, onChange }: Props) {
  return (
    // **탭이 아니라 토글 버튼 묶음이다.** `role="tab"`은 `tabpanel`과 짝을
    // 이루고 `aria-controls`·화살표 이동·roving tabindex가 따라오는 패턴인데
    // 이 줄에는 넷 다 없었다 — 보조기술이 「탭 목록, 탭 1/7」이라 알리고
    // 사용자는 오지 않는 화살표 동작을 기대하게 된다.
    //
    // 하는 일은 목록을 거르는 토글이라 `aria-pressed`가 동작과 맞고, 버튼이
    // 저마다 탭 순서에 드는 것이 정상이라 못 지킬 계약이 생기지 않는다.
    // **「전체」 칩이 생겨 「반드시 하나」가 성립하는 지금도 `radiogroup`은
    // 아니다** — 그쪽은 화살표 이동을 요구하는데 이 줄에는 여전히 없고,
    // 고른 칩을 다시 눌러 「전체」로 되돌리는 길도 남아 있다.
    <div
      role="group"
      aria-label={t('필터')}
      className="pointer-events-auto flex gap-2 overflow-x-auto scrollbar-none px-4 pb-1"
    >
      {/* **「전체」가 맨 앞이다**(시안 stitch_ui_ux/_1 상단). 예전에는 이 칩을
          두지 않고 「고른 칩을 다시 눌러 해제」만으로 처리했다 — 지도 상단을
          한 칸 아낀다는 이유였다. 칩이 둘일 때는 그것으로 됐지만 일곱이 되니
          **아무것도 안 고른 상태가 화면에 안 보인다**: 가로로 스크롤해 일곱을
          다 확인해야 「지금 아무 필터도 없다」를 알 수 있다.

          「내 장소」가 켜져 있을 때는 이 칩도 눌리지 않은 상태다. 그때 눌린
          것은 지도의 FAB이고, 여기서 「전체」를 누르면 그 필터가 풀린다. */}
      <button
        type="button"
        aria-pressed={value === null}
        onClick={() => onChange(null)}
        className={`${CHIP} ${
          value === null
            ? 'bg-primary text-on-primary'
            : 'bg-surface text-on-surface-variant'
        }`}
      >
        {t('전체')} {total}
      </button>

      {CHIPS.map((chip) => {
        const count = counts[chip]
        const selected = value === chip

        return (
          <button
            key={chip}
            type="button"
            aria-pressed={selected}
            // 0이면 누를 수 없다. 눌렀는데 아무 일도 안 일어나는 순간을 만들지
            // 않는다 — 혼잡도 칩은 실시간 등급을 쓰므로 실제로 0이 된다
            // (한밤중에는 「붐빔」이 없다).
            //
            // 예외는 **지금 골라둔 칩** 하나다. 카테고리를 좁히거나 시간이
            // 흘러 0이 되면 비활성으로 굳어 필터를 풀 방법이 사라진다. 이
            // 칩을 누르는 것은 「아무 일도 안 일어나는」 경우가 아니라 해제다.
            //
            // (예전에는 「내 장소」도 예외였다. 프리셋의 0은 데이터 사정이지만
            // 그쪽의 0은 아직 안 써 본 기능의 초기 상태라서다. 그 칩이 FAB으로
            // 옮겨 가면서 예외도 함께 갔다 — `MapFabStack`은 아예 비활성이
            // 되지 않는다.)
            disabled={count === 0 && !selected}
            // 고른 칩을 다시 누르면 「전체」로 돌아간다. 왼쪽 끝까지 스크롤해
            // 「전체」를 찾아 누르는 것보다 짧은 길이 하나 더 있는 셈이다.
            onClick={() => onChange(selected ? null : chip)}
            className={`${CHIP} ${
              selected
                ? 'bg-primary text-on-primary'
                : 'bg-surface text-on-surface-variant'
            }`}
          >
            {/* 혼잡도 칩에만 톤 점이 붙는다. 목적 칩(아이와 나들이·데이트)은
                혼잡도가 아니라 태그를 보므로 찍을 색이 없다.

                **장식이다.** 바로 옆에 등급 이름이 글자로 있어 색이 정보를
                혼자 나르지 않는다(WCAG 1.4.1). 고르면 칩이 primary로 차므로
                점도 그 위에서 보이는 값으로 바뀐다 — 근거는 `toneClass.ts`. */}
            {isLevelKey(chip) && (
              <span
                aria-hidden="true"
                className={`mr-1.5 inline-block size-2 rounded-full align-[1px] ${
                  selected ? TONE_DOT_ON_PRIMARY_CLASS[chip] : TONE_DOT_CLASS[chip]
                }`}
              />
            )}
            {t(filterLabel(chip))} {count}
          </button>
        )
      })}
    </div>
  )
}
