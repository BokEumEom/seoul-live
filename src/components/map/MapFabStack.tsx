import { t } from '../../i18n/t'
import type { Detent } from '../../domain/sheet'
import { LIST_ROUTE } from '../../domain/route'
import { shareUrl } from '../../platform/appUrl'
import { shareMessage } from '../../platform/links'
import { Icon } from '../common/Icon'

/** 이 묶음이 설 수 있는 단계. `full`이 빠진 것은 실수가 아니다 — 아래 참고. */
export type RecenterDetent = Exclude<Detent, 'full'>

interface Props {
  /** 「내 장소」가 켜져 있나. 필터 한 칸을 칩 줄과 나눠 쓴다. */
  readonly favoritesOn: boolean
  /**
   * 담아 둔 곳이 지금 목록에 몇이나 있나. **`favorites.length`가 아니다** —
   * 카테고리로 좁혔거나 카탈로그에서 이름이 바뀐 곳까지 세면 배지의 수와
   * 눌렀을 때 뜨는 목록이 갈린다(`filterCounts`가 정본이다).
   */
  readonly favoritesCount: number
  readonly onToggleFavorites: () => void
  /** 좌표가 없으면 이동할 곳이 없다 — 「내 주변」만 잠긴다. */
  readonly recenterDisabled: boolean
  /**
   * 시트가 지금 어디까지 올라와 있는지. 이 묶음의 세로 위치를 정한다.
   *
   * **넓은 화면에서는 `null`이다.** 시트가 왼쪽 패널이 되어 세로를 하나도
   * 안 가리므로 「시트를 피해 올라간다」는 규칙 자체가 없어진다 — 그때는
   * 지도 우하단에 그냥 붙는다.
   */
  readonly detent: RecenterDetent | null
  readonly onRecenter: () => void
}

// 시트가 올라오면 함께 올라간다. 안 그러면 시트가 이 묶음을 덮는다.
// 시트와 같은 비율 단위(부모 높이 기준 %)를 쓰는 이유는 고정 px으로 두면
// 화면 높이가 달라질 때 시트 위 여백만 늘거나 버튼이 시트에 잠기기 때문이다.
//
// 값은 언제나 `SHEET_RATIO[detent] + 0.02`다 — 시트 상단보다 2%p 위. 단계가
// 달라져도 시트와의 간격이 같아야 눌러야 할 자리가 매번 바뀌지 않는다.
// 그 관계를 테스트가 잠근다(리터럴 표와 파생 규칙을 따로 본다).
//
// **`full`이 없는 이유 — 48px가 들어갈 자리가 없다.**
// `full`(92%)에서 시트 위에 남는 지도 조각은 `0.08H`이고, 여기에 2%p 간격을
// 주면 버튼 몫은 `0.06H`다. 버튼이 48px이므로
//
//     0.06H ≥ 48  ⟺  H ≥ 800px
//
// 즉 컨테이너가 800px 미만이면 버튼 위쪽이 음수 좌표로 나가고, 홈 루트의
// `overflow-hidden`이 그만큼 잘라낸다. 실측(리뷰): H=460이면 상단 −20.4px로
// 27.6px만 남고, H=637이면 −9.8px, H=708이면 −5.5px다. **묶음이 셋으로
// 늘어난 지금은 더 말이 안 된다** — 셋이면 160px이 필요하다.
//
// **Task 10에서 상단바·탭바가 사라져 컨테이너가 곧 뷰포트가 됐다**(`100dvh`).
// 그전에는 `100dvh − 7.5rem`이라 800px을 넘으려면 뷰포트가 920px이어야 했고
// 그래서 「실기기에서는 언제나 잘린다」였다. 이제는 뷰포트 800px이면 되므로
// 세로가 긴 기기에서는 안 잘릴 수 있다 — 그래도 `full`에서는 그리지 않는다.
// 화면 높이로 갈라 그리면 규칙이 둘로 늘고, 그 갈림은 jsdom이 잡지 못하는
// 기하라 회귀를 테스트로 막을 수도 없다. 작은 기기에서 잘리는 것은 그대로다.
// 「전체로 펼치면 지도 위 조작부가 물러난다」로 검색 바·칩 열과 규칙이 같아진다.
//
// 잘림을 피하려고 `top-1`처럼 위로 붙이는 길은 택하지 않았다. 작은 화면에서는
// 버튼이 시트 상단 모서리에 걸치고(`z-20 > z-10`이라 시트 위에 그려진다)
// 손잡이 히트 영역(시트 상단 위 20px)을 오른쪽 끝에서 통째로 덮는다 —
// 잘림을 겹침으로 바꿀 뿐이고, 그 겹침은 테스트로 잡히지도 않는다.
//
// 남은 두 단계에서는 묶음 아래 4px이 손잡이 히트 영역의 오른쪽 끝과 겹친다
// (800px 기준. 겹침은 `20px − 0.02H`라 화면이 작을수록 는다). 손잡이의 보이는
// 띠는 가운데 36px이고 빗나간 터치도 가운데로 몰리므로 폭 48px짜리 오른쪽
// 구석은 실제로 손잡이를 가로막지 않는다고 봤지만, 확정은 실기기 몫이다.
const BOTTOM_CLASS: Readonly<Record<RecenterDetent, string>> = {
  peek: 'bottom-[18%]',
  half: 'bottom-[58%]',
}

// 셋의 기하가 함께 움직인다. 48px은 이 저장소가 아이콘뿐인 버튼에 쓰는
// 크기다(`ActionButtons`·`ThemeToggle`과 같다).
const FAB =
  'grid size-12 place-items-center rounded-full bg-surface shadow-floating disabled:text-outline-variant'

/**
 * 지도 우하단에 세로로 선 FAB 셋 — **내 장소 · 앱 공유 · 내 주변.**
 *
 * 「내 주변」 하나뿐이던 자리다. 위 둘이 여기로 온 것은 **칩 줄이 혼잡도 네
 * 등급으로 차면서**(2026-08-20, 시안 stitch_ui_ux/_1 상단) 「내 장소」가 그
 * 줄에서 밀려났기 때문이다. 밀려난 칩을 없애지 않고 FAB으로 옮긴 이유는
 * 즐겨찾기 화면이 없어진 뒤로 **담아 둔 곳에 닿는 길이 이것뿐**이라서다.
 *
 * 셋 다 「지금 보는 명소」가 아니라 **앱 전체**를 가리킨다. 지도 화면에는
 * 고른 명소가 없을 수도 있고(목록 상태), 있더라도 그 명소의 저장·공유는
 * 상세 상단 바가 이미 맡고 있다(`ActionButtons`) — 같은 일을 두 자리에 두면
 * 어느 쪽이 무엇을 가리키는지 흐려진다.
 *
 * **`disabled`가 「내 주변」에만 붙는다.** 나머지 둘은 어떤 상태에서도
 * 눌린다: 「내 장소」의 0은 데이터 사정이 아니라 **아직 안 써 본 기능의 초기
 * 상태**라, 여기를 막으면 신규 사용자에게는 이 기능에 닿을 길이 앱에 하나도
 * 남지 않는다(답은 눌러야 나오는 빈 목록 문구에 있다).
 */
export function MapFabStack({
  favoritesOn,
  favoritesCount,
  onToggleFavorites,
  recenterDisabled,
  detent,
  onRecenter,
}: Props) {
  // 넓은 화면에서는 패널이 왼쪽을 가릴 뿐이라 아래가 통째로 비어 있다.
  //
  // **`bottom-6`이 아니라 `bottom-safe-6`이다.** 이 갈래만 화면 끝을 직접
  // 재는데, 가로로 든 폰은 768px을 넘어 여기로 오고 그 끝이 곧 홈 인디케이터다.
  // 위 두 단계는 시트 비율을 따라가므로 같은 문제가 없다.
  const bottom = detent === null ? 'bottom-safe-6' : BOTTOM_CLASS[detent]

  return (
    // 이름을 붙인 묶음이다. 안 붙이면 보조기술이 셋을 아무 관계 없는 버튼
    // 셋으로 읽어, 화면 어딘가에 흩어진 조작처럼 들린다.
    //
    // `pointer-events-auto`를 두지 않는다. 이 묶음은 홈 루트의 직계 자식이고
    // 루트에는 `pointer-events-none`이 없어서 되살릴 것이 없다 — 그 클래스가
    // 필요한 건 `pointer-events-none` 컨테이너 안에 있는 필터 칩 쪽이다.
    <div
      role="group"
      aria-label={t('지도 조작')}
      className={`absolute right-4 z-20 flex flex-col gap-2 ${bottom}`}
    >
      {/* 상태는 글자로도 말한다 — 이름이 「내 장소 3」↔「내 장소 3 보는 중」으로
          바뀌고 `aria-pressed`가 그 상태를 나른다. 눈으로 보는 쪽은 책갈피의
          윤곽/채움과 primary 색이 같은 일을 한다.

          **`ActionButtons`와 규칙이 다른 것은 하는 일이 달라서다.** 그쪽은
          「저장한다」는 동작이라 `aria-pressed`를 쓰면 같은 상태를 두 번 읽지만,
          이 버튼은 목록을 거르는 **토글**이라 칩 줄과 같은 계약이 맞다.

          **개수가 이름 안에 든다.** 칩 줄에 있을 때는 「내 장소 3」이라고 적혀
          있었는데, FAB은 아이콘뿐이라 그대로 옮기면 그 수가 통째로 사라진다 —
          담은 게 있는지 없는지 눌러 봐야만 아는 버튼이 된다. */}
      <button
        type="button"
        aria-pressed={favoritesOn}
        aria-label={
          favoritesOn
            ? t('내 장소 {개수} 보는 중', { 개수: favoritesCount })
            : t('내 장소 {개수}', { 개수: favoritesCount })
        }
        onClick={onToggleFavorites}
        className={`${FAB} relative ${
          favoritesOn ? 'text-primary' : 'text-on-surface-variant'
        }`}
      >
        <Icon name={favoritesOn ? 'bookmarkFilled' : 'bookmark'} className="size-6" />
        {/* **0이면 안 그린다.** 「0」짜리 배지는 눈에 띄는 값 없이 자리만
            차지하고, 아직 아무것도 안 담은 사람에게 뭔가 잘못됐다는 인상을
            준다. 소리로는 여전히 「내 장소 0」이라 개수가 사라지지는 않는다.

            `aria-hidden`인 것은 위 이름이 같은 수를 이미 말하기 때문이다 —
            안 감추면 스크린리더가 「내 장소 3, 3」이라고 읽는다. */}
        {favoritesCount > 0 && (
          <span
            aria-hidden="true"
            className="absolute -top-0.5 -right-0.5 grid min-w-5 place-items-center rounded-full bg-primary px-1 text-label-xs font-bold text-on-primary"
          >
            {favoritesCount}
          </span>
        )}
      </button>

      {/* 앱 링크를 보낸다. 명소가 안 실린 뿌리 주소(`LIST_ROUTE`)라 받은
          사람은 제 위치 기준의 목록으로 들어온다 — 보낸 사람이 어디를 보고
          있었는지와 무관하게 말이 되는 유일한 주소다. */}
      <button
        type="button"
        aria-label={t('앱 공유하기')}
        onClick={() => {
          void shareMessage(
            `${t('서울 라이브 - 서울 명소 실시간 혼잡도')}\n${shareUrl(LIST_ROUTE)}`,
          )
        }}
        className={`${FAB} text-on-surface-variant`}
      >
        <Icon name="share" className="size-6" />
      </button>

      {/* 지도는 초기 뷰를 서울 전역으로 고정하므로(자동으로 내 위치를 따라가지
          않는다) 사용자가 명시적으로 이동하는 통로가 이 버튼이다. 이름이
          「내 위치로 이동」이 아니라 「내 주변」인 것은 검색 줄에 있던 같은
          이름의 버튼을 흡수했기 때문이다 — 하는 일도 그때 함께 넘어왔다. */}
      <button
        type="button"
        disabled={recenterDisabled}
        onClick={onRecenter}
        aria-label={t('내 주변')}
        className={`${FAB} text-primary`}
      >
        <Icon name="myLocation" className="size-6" />
      </button>
    </div>
  )
}
