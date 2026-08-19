import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CctvPlayer } from './CctvPlayer'

// jsdom의 <video>는 canPlayType이 언제나 ''이고 `MediaSource`도 없다.
// 아이폰 사파리(네이티브 HLS + MSE 없음)를 흉내 내려면 canPlayType만 켜면 된다.
function stubNativeHls(supported: boolean) {
  vi.spyOn(HTMLMediaElement.prototype, 'canPlayType').mockImplementation((type) =>
    supported && type === 'application/vnd.apple.mpegurl' ? 'maybe' : '',
  )
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('CctvPlayer', () => {
  // **앱인토스는 iframe을 금지한다**(AGENTS.md). 서울시 웹은 자기 플레이어를
  // iframe으로 감싸는데, 그걸 따라 하면 내부 보안 심사에서 반려된다.
  // 「CCTV는 iframe이라 범위 밖」이라는 잘못된 결론이 나왔던 자리라 못박는다.
  it('iframe을 쓰지 않는다', () => {
    stubNativeHls(true)
    const { container } = render(<CctvPlayer name="광화문" streamUrl="https://a/1.m3u8" />)

    expect(container.querySelector('iframe')).toBeNull()
    expect(container.querySelector('video')).not.toBeNull()
  })

  // 아이폰 사파리(WKWebView)는 <video>가 HLS를 직접 재생하고 MSE가 없다.
  // hls.js를 받아 봐야 쓸 수 없으므로 아예 안 받는다.
  it('MSE가 없고 네이티브 HLS가 되면 src를 그대로 건다', () => {
    stubNativeHls(true)
    const { container } = render(<CctvPlayer name="광화문" streamUrl="https://a/1.m3u8" />)

    expect(container.querySelector('video')?.getAttribute('src')).toBe('https://a/1.m3u8')
  })

  // **실제 크롬에서 잡은 결함이다.** 크롬은 HLS를 재생하지 못하면서도
  // `application/vnd.apple.mpegurl`에 `"maybe"`를 돌려준다. 그 말을 믿고
  // src를 걸면 `readyState 0`인 채로 검은 화면이 남는다 — **hls.js가 필요한
  // 바로 그 환경(안드로이드 웹뷰)에서만 깨지고 아이폰에서는 멀쩡해서**
  // 눈치채기 어렵다. 갈림길은 `canPlayType`이 아니라 MSE의 유무다.
  it('MSE가 있으면 canPlayType이 된다고 해도 src를 직접 걸지 않는다', () => {
    stubNativeHls(true)
    // jsdom에는 MediaSource가 없다. 크롬처럼 「MSE가 있는」 환경을 만든다.
    vi.stubGlobal('MediaSource', class {})

    const { container } = render(<CctvPlayer name="광화문" streamUrl="https://a/1.m3u8" />)

    expect(container.querySelector('video')?.getAttribute('src')).toBeNull()

    vi.unstubAllGlobals()
  })

  // 자동재생·음소거·인라인은 셋이 한 묶음이다. iOS는 muted와 playsInline이
  // 없으면 자동재생을 거부하고 영상을 전체화면으로 띄운다 — 시트 안에서
  // 화면이 통째로 가려진다.
  it('음소거·인라인 자동재생으로 연다', () => {
    stubNativeHls(true)
    const { container } = render(<CctvPlayer name="광화문" streamUrl="https://a/1.m3u8" />)
    const video = container.querySelector('video')

    expect(video).toHaveAttribute('autoplay')
    expect(video?.muted).toBe(true)
    expect(video).toHaveAttribute('playsinline')
  })

  // 아이콘도 글자도 없는 요소라 이름이 없으면 스크린리더가 「비디오」로만 읽는다.
  it('어느 카메라인지 이름을 붙인다', () => {
    stubNativeHls(true)
    render(<CctvPlayer name="광화문" streamUrl="https://a/1.m3u8" />)

    expect(screen.getByLabelText('광화문 실시간 영상')).toBeInTheDocument()
  })

  // 첫 프레임이 오기 전에는 검은 사각형만 있다. 아무 말도 없으면 고장으로 읽힌다.
  it('아직 안 나오면 불러오는 중이라고 적는다', () => {
    stubNativeHls(true)
    render(<CctvPlayer name="광화문" streamUrl="https://a/1.m3u8" />)

    expect(screen.getByText('영상을 불러오는 중이에요')).toBeInTheDocument()
  })

  // **원인을 단정하지 않는다.** 상류 점검·기기 네트워크·우리 프록시를 구분할
  // 방법이 없다 — 모르면 모른다고 하는 규칙(`freshness`)과 같다.
  it('재생이 실패하면 원인을 단정하지 않고 알린다', () => {
    stubNativeHls(true)
    const { container } = render(<CctvPlayer name="광화문" streamUrl="https://a/1.m3u8" />)

    const video = container.querySelector('video')
    if (video !== null) {
      // `dispatchEvent`가 아니라 `fireEvent`다. 미디어 이벤트는 버블링하지
      // 않아 React가 요소에 직접 듣는데, act() 밖에서 쏘면 상태 갱신이
      // 화면에 반영되기 전에 단언이 돈다.
      fireEvent.error(video)
    }

    expect(screen.getByText('지금은 영상을 불러올 수 없어요')).toBeInTheDocument()
    expect(screen.queryByText(/점검/)).not.toBeInTheDocument()
  })

  // 재생이 시작되면 덮개가 걷혀야 한다. 안 걷히면 영상 위에 글자가 남는다.
  it('재생이 시작되면 안내를 걷는다', () => {
    stubNativeHls(true)
    const { container } = render(<CctvPlayer name="광화문" streamUrl="https://a/1.m3u8" />)

    const video = container.querySelector('video')
    if (video !== null) {
      fireEvent.playing(video)
    }

    expect(screen.queryByText('영상을 불러오는 중이에요')).not.toBeInTheDocument()
    expect(screen.queryByText('지금은 영상을 불러올 수 없어요')).not.toBeInTheDocument()
  })

  // 교통 CCTV에는 소리가 없다. 컨트롤을 띄우면 눌러도 아무 일이 없는 음량
  // 버튼이 생긴다.
  it('컨트롤을 띄우지 않는다', () => {
    stubNativeHls(true)
    const { container } = render(<CctvPlayer name="광화문" streamUrl="https://a/1.m3u8" />)

    expect(container.querySelector('video')).not.toHaveAttribute('controls')
  })
})
