import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CategoryAverages } from './CategoryAverages'

describe('CategoryAverages', () => {
  it('행이 없으면 아무것도 그리지 않는다', () => {
    const { container } = render(<CategoryAverages rows={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('행정 용어가 아니라 화면 라벨로 보여준다', () => {
    render(
      <CategoryAverages
        rows={[
          { category: '인구밀집지역', level: '붐빔' },
          { category: '발달상권', level: '보통' },
        ]}
      />,
    )
    expect(screen.getByText('역·번화가')).toBeInTheDocument()
    expect(screen.getByText('상권·거리')).toBeInTheDocument()
    expect(screen.queryByText('인구밀집지역')).toBeNull()
  })
})
