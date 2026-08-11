import type { Detent } from '../../domain/sheet'
import { Icon } from '../common/Icon'

/** 이 버튼이 설 수 있는 단계. `full`이 빠진 것은 실수가 아니다 — 아래 참고. */
export type RecenterDetent = Exclude<Detent, 'full'>

interface Props {
  /** 좌표가 없으면 이동할 곳이 없다. */
  readonly disabled: boolean
  /** 시트가 지금 어디까지 올라와 있는지. 이 버튼의 세로 위치를 정한다. */
  readonly detent: RecenterDetent
  readonly onClick: () => void
}

// 시트가 올라오면 함께 올라간다. 안 그러면 시트가 이 버튼을 덮는다.
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
// 27.6px만 남고, H=637이면 −9.8px, H=708이면 −5.5px다.
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
// 남은 두 단계에서는 버튼 아래 4px이 손잡이 히트 영역의 오른쪽 끝과 겹친다
// (800px 기준. 겹침은 `20px − 0.02H`라 화면이 작을수록 는다). 손잡이의 보이는
// 띠는 가운데 36px이고 빗나간 터치도 가운데로 몰리므로 폭 48px짜리 오른쪽
// 구석은 실제로 손잡이를 가로막지 않는다고 봤지만, 확정은 실기기 몫이다.
const BOTTOM_CLASS: Readonly<Record<RecenterDetent, string>> = {
  peek: 'bottom-[18%]',
  half: 'bottom-[48%]',
}

// 시안의 우하단 FAB. 지도는 초기 뷰를 서울 전역으로 고정하므로(자동으로 내
// 위치를 따라가지 않는다) 사용자가 명시적으로 이동하는 통로가 이 버튼이다.
// 이름이 「내 위치로 이동」이 아니라 「내 주변」인 것은 검색 줄에 있던 같은
// 이름의 버튼을 흡수했기 때문이다 — 하는 일도 그때 함께 넘어왔다.
export function RecenterButton({ disabled, detent, onClick }: Props) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label="내 주변"
      // `pointer-events-auto`를 두지 않는다. 이 버튼은 홈 루트의 직계 자식이고
      // 루트에는 `pointer-events-none`이 없어서 되살릴 것이 없다 — 그 클래스가
      // 필요한 건 `pointer-events-none` 컨테이너 안에 있는 필터 칩 쪽이다.
      className={`absolute right-4 z-20 grid size-12 place-items-center rounded-full bg-surface text-primary shadow-floating disabled:text-outline-variant ${BOTTOM_CLASS[detent]}`}
    >
      <Icon name="myLocation" className="size-6" />
    </button>
  )
}
