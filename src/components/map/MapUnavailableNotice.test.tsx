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

  it('어느 쪽이든 아직 쓸 수 있는 것을 함께 알린다', () => {
    // 지도의 실패가 앱 전체의 실패로 읽히면 안 된다. 가리키는 대상은 지도가
    // 죽어도 시트 안에 그대로 서는 것이어야 한다 — 예전 문구의 「내 주변」은
    // 지도 위 FAB이고 「혼잡예보」는 아예 없는 화면이라 둘 다 틀린 안내였다.
    for (const reason of ['no-key', 'load-failed'] as const) {
      const { unmount } = render(<MapUnavailableNotice reason={reason} />)

      expect(screen.getByText(/목록과 검색은 그대로 쓸 수 있어요/)).toBeInTheDocument()
      expect(screen.queryByText(/혼잡예보/)).not.toBeInTheDocument()
      unmount()
    }
  })
})
