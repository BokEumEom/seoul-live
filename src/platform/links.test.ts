import { beforeEach, describe, expect, it, vi } from 'vitest'
import { openExternalUrl, shareMessage } from './links'

vi.mock('@apps-in-toss/web-framework', () => ({
  Device: { openURL: vi.fn() },
  Share: { sendMessage: vi.fn() },
}))

const framework = await import('@apps-in-toss/web-framework')
const openURL = vi.mocked(framework.Device.openURL)
const sendMessage = vi.mocked(framework.Share.sendMessage)

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('open', vi.fn())
})

describe('openExternalUrl', () => {
  it('토스 안에서는 네이티브로 연다', async () => {
    openURL.mockResolvedValue()

    await openExternalUrl('https://map.kakao.com/link/search/%EA%B0%95%EB%82%A8%EC%97%AD')

    expect(openURL).toHaveBeenCalledWith(
      'https://map.kakao.com/link/search/%EA%B0%95%EB%82%A8%EC%97%AD',
    )
    expect(window.open).not.toHaveBeenCalled()
  })

  it('브리지가 없으면 브라우저 새 탭으로 넘어간다', async () => {
    // 개발 서버(일반 브라우저)에는 토스 네이티브 브리지가 없다. 여기서 버튼이
    // 죽으면 화면을 확인할 방법이 없어진다.
    openURL.mockRejectedValue(new Error('bridge unavailable'))

    await openExternalUrl('https://map.naver.com/p/search/%EA%B2%BD%EB%B3%B5%EA%B6%81')

    expect(window.open).toHaveBeenCalledWith(
      'https://map.naver.com/p/search/%EA%B2%BD%EB%B3%B5%EA%B6%81',
      '_blank',
      'noopener,noreferrer',
    )
  })

  it('둘 다 실패해도 예외를 밖으로 던지지 않는다', async () => {
    openURL.mockRejectedValue(new Error('bridge unavailable'))
    vi.stubGlobal(
      'open',
      vi.fn(() => {
        throw new Error('blocked')
      }),
    )

    await expect(openExternalUrl('https://example.com')).resolves.toBeUndefined()
  })
})

describe('shareMessage', () => {
  it('토스 안에서는 네이티브 공유 시트를 연다', async () => {
    sendMessage.mockResolvedValue()

    await shareMessage('강남역 실시간 혼잡도 - 서울 라이브')

    expect(sendMessage).toHaveBeenCalledWith({
      message: '강남역 실시간 혼잡도 - 서울 라이브',
    })
  })

  it('브리지가 없으면 클립보드로 대체한다', async () => {
    sendMessage.mockRejectedValue(new Error('bridge unavailable'))
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })

    await shareMessage('경복궁 실시간 혼잡도')

    expect(writeText).toHaveBeenCalledWith('경복궁 실시간 혼잡도')
  })

  it('클립보드도 없으면 조용히 끝난다', async () => {
    sendMessage.mockRejectedValue(new Error('bridge unavailable'))
    vi.stubGlobal('navigator', {})

    await expect(shareMessage('아무거나')).resolves.toBeUndefined()
  })
})
