import { Device, Share } from '@apps-in-toss/web-framework'

// 토스 웹뷰 밖(개발 서버, 테스트)에는 네이티브 브리지가 없다. 브리지를 먼저
// 시도하고 실패하면 웹 표준으로 떨어뜨린다. 어느 쪽도 버튼을 죽이지 않는다.
//
// 반대로 <a target="_blank">만 쓰면 웹뷰에서 아무 일도 일어나지 않을 수 있고,
// 브리지만 쓰면 브라우저에서 화면을 확인할 수 없다.

/** 지도 앱·외부 브라우저로 URL을 연다. 실패해도 호출부로 예외를 올리지 않는다. */
export async function openExternalUrl(url: string): Promise<void> {
  try {
    await Device.openURL(url)
    return
  } catch {
    // 브리지가 없다. 웹 표준으로 넘어간다.
  }

  try {
    window.open(url, '_blank', 'noopener,noreferrer')
  } catch (error) {
    console.error('외부 링크를 열지 못했습니다:', error)
  }
}

/** 네이티브 공유 시트를 연다. 없으면 클립보드 복사로 대체한다. */
export async function shareMessage(message: string): Promise<void> {
  try {
    await Share.sendMessage({ message })
    return
  } catch {
    // 브리지가 없다. 클립보드로 넘어간다.
  }

  try {
    await navigator.clipboard?.writeText(message)
  } catch (error) {
    console.error('공유하지 못했습니다:', error)
  }
}
