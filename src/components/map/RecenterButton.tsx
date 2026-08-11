import type { Detent } from '../../domain/sheet'
import { Icon } from '../common/Icon'

interface Props {
  /** 좌표가 없으면 이동할 곳이 없다. */
  readonly disabled: boolean
  /** 시트가 지금 어디까지 올라와 있는지. 이 버튼의 세로 위치를 정한다. */
  readonly detent: Detent
  readonly onClick: () => void
}

// 시트가 올라오면 함께 올라간다. 안 그러면 시트가 이 버튼을 덮는다.
// 시트와 같은 비율 단위(부모 높이 기준 %)를 쓰는 이유는 고정 px으로 두면
// 화면 높이가 달라질 때 시트 위 여백만 늘거나 버튼이 시트에 잠기기 때문이다.
//
// 세 값 모두 시트 상단보다 정확히 2%p 위다. 800px에서 버튼 아래가 시트
// 상단으로부터 16px 뜬다 — 단계가 달라져도 시트와의 간격이 같아야 눌러야 할
// 자리가 매번 바뀌지 않는다.
//
// 그 16px 때문에 버튼 아래 4px이 손잡이 히트 영역(시트 상단 위 20px)의 오른쪽
// 끝과 겹친다. **세 단계 모두 똑같이 4px이다** — full만의 문제가 아니라 이
// 배치의 성질이다. 손잡이의 보이는 띠는 가운데 36px이고 빗나간 터치도 가운데로
// 몰리므로 폭 48px짜리 오른쪽 구석은 실제로 손잡이를 가로막지 않는다고 봤지만,
// 확정은 실기기 몫이다 — STATE.md의 미해결 항목.
const BOTTOM_CLASS: Readonly<Record<Detent, string>> = {
  peek: 'bottom-[18%]',
  half: 'bottom-[48%]',
  full: 'bottom-[94%]',
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
      className={`pointer-events-auto absolute right-4 z-20 grid size-12 place-items-center rounded-full bg-surface text-primary shadow-floating disabled:text-outline-variant ${BOTTOM_CLASS[detent]}`}
    >
      <Icon name="myLocation" className="size-6" />
    </button>
  )
}
