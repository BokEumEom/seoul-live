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
    for (const reason of ['no-key', 'load-failed', 'offline'] as const) {
      const { unmount } = render(<MapUnavailableNotice reason={reason} />)

      expect(screen.getByText(/목록과 검색은 그대로 쓸 수 있어요/)).toBeInTheDocument()
      expect(screen.queryByText(/혼잡예보/)).not.toBeInTheDocument()
      unmount()
    }
  })

  it('오프라인은 앞의 둘과 또 다른 문구를 쓴다', () => {
    // **서비스워커가 생기면서 필요해진 세 번째 상태다.** 예전에는 끊기면 화면
    // 자체가 안 떠서 표현할 일이 없었지만, 지금은 셸이 캐시에서 뜨고 목록도
    // 마지막 기억으로 서므로 지도만 회색 빈칸으로 남는다.
    //
    // 「불러오지 못했어요」로 묶지 않는 이유: 그 문구는 「네트워크를 확인해
    // 주세요」로 이어지는데, 오프라인인 걸 아는 사용자에게 확인하라고 하는 건
    // 할 일을 되돌려주는 것이다. 끊긴 동안에도 목록은 마지막 기억으로 선다는
    // 사실이 여기서 해야 할 말이다.
    render(<MapUnavailableNotice reason="offline" />)

    expect(screen.getByText(/오프라인/)).toBeInTheDocument()
    expect(screen.queryByText(/네트워크 상태를 확인/)).not.toBeInTheDocument()
    expect(screen.queryByText(/VITE_GOOGLE_MAPS_API_KEY/)).not.toBeInTheDocument()
  })
})
