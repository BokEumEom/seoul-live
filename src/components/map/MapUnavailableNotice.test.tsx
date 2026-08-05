import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MapUnavailableNotice } from './MapUnavailableNotice'

describe('MapUnavailableNotice', () => {
  it('키가 없을 때는 설정 문제임을 알린다', () => {
    render(<MapUnavailableNotice reason="no-key" />)

    expect(
      screen.getByText(/VITE_GOOGLE_MAPS_API_KEY/),
    ).toBeInTheDocument()
  })

  it('로드 실패는 키 문제와 다른 문구를 쓴다', () => {
    // 둘을 같은 문구로 묶으면 개발자는 키를 의심하고 사용자는 설정을 의심한다.
    render(<MapUnavailableNotice reason="load-failed" />)

    expect(screen.queryByText(/VITE_GOOGLE_MAPS_API_KEY/)).not.toBeInTheDocument()
    expect(screen.getByText(/불러오지 못했어요/)).toBeInTheDocument()
  })

  it('어느 쪽이든 나머지 화면은 쓸 수 있다고 안내한다', () => {
    for (const reason of ['no-key', 'load-failed'] as const) {
      const { unmount } = render(<MapUnavailableNotice reason={reason} />)

      expect(screen.getByText(/내 주변/)).toBeInTheDocument()
      unmount()
    }
  })
})
