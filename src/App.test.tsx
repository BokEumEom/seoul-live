import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

// 이 파일은 "빌드가 된다"가 아니라 "화면에 실제로 뭔가 뜬다"를 확인한다.
// 타입 검사와 번들링이 통과해도 렌더 중 예외가 나면 사용자는 흰 화면을 본다.
beforeEach(() => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
})

describe('App', () => {
  it('내 주변 화면이 뜨고 명소 목록이 채워진다', async () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: '내 주변 명소' })).toBeInTheDocument()

    await waitFor(() =>
      expect(screen.getByText('광화문·덕수궁')).toBeInTheDocument(),
    )
    expect(screen.getByText('성수카페거리')).toBeInTheDocument()
  })

  it('혼잡도 배지가 실제 값으로 그려진다', async () => {
    render(<App />)

    await waitFor(() => expect(screen.getByText('광화문·덕수궁')).toBeInTheDocument())

    // 목업은 카탈로그 전체에서 4단계가 모두 나오도록 만들어져 있다.
    for (const level of ['여유', '보통', '약간 붐빔', '붐빔']) {
      expect(screen.getAllByText(level).length).toBeGreaterThan(0)
    }
  })

  it('카테고리를 고르면 목록이 걸러진다', async () => {
    render(<App />)
    await waitFor(() => expect(screen.getByText('강남역')).toBeInTheDocument())

    await userEvent.click(screen.getByRole('tab', { name: '공원' }))

    expect(screen.queryByText('강남역')).not.toBeInTheDocument()
    expect(screen.getByText('남산공원')).toBeInTheDocument()
  })

  it('명소를 누르면 상세로 넘어가고 뒤로 돌아온다', async () => {
    render(<App />)
    await waitFor(() => expect(screen.getByText('경복궁')).toBeInTheDocument())

    await userEvent.click(screen.getByText('경복궁'))
    expect(screen.getByRole('heading', { name: '경복궁' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: '뒤로 가기' }))
    expect(screen.getByRole('heading', { name: '내 주변 명소' })).toBeInTheDocument()
  })

  it('지도·더보기 탭은 비활성이다', async () => {
    render(<App />)
    await waitFor(() => expect(screen.getByText('강남역')).toBeInTheDocument())

    expect(screen.getByRole('button', { name: /지도/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: /더보기/ })).toBeDisabled()
  })
})
