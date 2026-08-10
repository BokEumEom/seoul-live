import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AreaList } from './AreaList'

function renderList() {
  return render(
    <AreaList>
      <button type="button">강남역</button>
      <button type="button">경복궁</button>
    </AreaList>,
  )
}

describe('AreaList', () => {
  it('넘겨준 행을 그대로 그린다', () => {
    renderList()
    expect(screen.getByRole('button', { name: '강남역' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '경복궁' })).toBeInTheDocument()
  })

  it('행을 세로로 쌓는다', () => {
    const { container } = renderList()
    expect(container.firstElementChild).toHaveClass('flex', 'flex-col')
  })

  // 이 컴포넌트가 존재하는 이유다. 행이 자기 아래 구분선으로 갈리므로
  // 컨테이너가 간격을 주면 구분선이 허공에 뜬다. jsdom은 높이를 재지 못하니
  // "간격을 만드는 유틸리티가 없다"로 잠근다 — `gap-*`뿐 아니라 `space-y-*`,
  // `divide-*`, `[&>*]:mt-*`로도 같은 버그가 되살아난다.
  it('행 사이에 간격을 만드는 유틸리티를 쓰지 않는다', () => {
    const { container } = renderList()
    expect(container.firstElementChild?.className).not.toMatch(
      /gap-|space-|divide-|:mt-|:pt-/,
    )
  })
})
