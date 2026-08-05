import { Icon } from '../common/Icon'

interface Props {
  /** 좌표가 없으면 이동할 곳이 없다. */
  readonly disabled: boolean
  /** 바텀시트가 열려 있으면 그 위로 올린다. 안 그러면 시트가 이 버튼을 덮는다. */
  readonly raised: boolean
  readonly onClick: () => void
}

// 시안의 우하단 FAB. 지도는 초기 뷰를 서울 전역으로 고정하므로(자동으로 내
// 위치를 따라가지 않는다) 사용자가 명시적으로 이동하는 통로가 이 버튼이다.
export function RecenterButton({ disabled, raised, onClick }: Props) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label="내 위치로 이동"
      className={`pointer-events-auto absolute right-4 z-20 grid size-12 place-items-center rounded-full bg-surface text-primary shadow-floating disabled:text-outline-variant ${raised ? 'bottom-64' : 'bottom-28'}`}
    >
      <Icon name="myLocation" className="size-6" />
    </button>
  )
}
