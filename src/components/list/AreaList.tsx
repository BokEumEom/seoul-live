import type { ReactNode } from 'react'

interface Props {
  readonly children: ReactNode
}

// 명소 행을 담는 컨테이너. 하는 일은 하나뿐이지만 그 하나가 계약이다 —
// `AreaListItem`이 자기 **아래 구분선**으로 갈리므로 컨테이너가 행 간격을 주면
// 구분선이 행에 붙지 않고 허공에 뜬다. `gap-*`뿐 아니라 `space-y-*`·`divide-*`로도
// 같은 버그가 되살아난다.
//
// 호출부마다 흩어져 있던 규칙이라 한 곳으로 모았다. 바깥 여백(`px-4`·`mt-3`)은
// 호출부에 남긴다 — 이 컴포넌트는 행 사이 간격만 소유한다.
export function AreaList({ children }: Props) {
  return <div className="flex flex-col">{children}</div>
}
