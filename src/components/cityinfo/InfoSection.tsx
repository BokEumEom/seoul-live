import type { ReactNode } from 'react'

interface Props {
  readonly title: string
  readonly children: ReactNode
}

/** 도시정보 화면의 섹션 껍데기. 카드 테두리·여백을 한 곳에 둔다. */
export function InfoSection({ title, children }: Props) {
  return (
    <section className="mx-4 rounded-card border border-outline-variant bg-surface-container-lowest p-4">
      <h3 className="text-headline-sm text-on-surface">{title}</h3>
      <div className="mt-3">{children}</div>
    </section>
  )
}

// 섹션마다 "없음"을 다르게 그리면 같은 화면에서 빈 상태가 여러 모양으로 보인다.
export function EmptyNote({ children }: { children: ReactNode }) {
  return <p className="text-body-md text-on-surface-variant">{children}</p>
}
