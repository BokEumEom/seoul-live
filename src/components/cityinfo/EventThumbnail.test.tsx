import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { EventThumbnail } from './EventThumbnail'

const SRC = 'https://culture.seoul.go.kr/cmmn/file/getImage.do?atchFileId=abc&thumb=Y'

describe('EventThumbnail', () => {
  it('주소가 있으면 그림을 건다', () => {
    const { container } = render(<EventThumbnail src={SRC} />)
    expect(container.querySelector('img')).toHaveAttribute('src', SRC)
  })

  // 주소가 없는 행사가 온다(목업이 셋 중 하나를 그렇게 낸다). 빈 `src`로
  // `<img>`를 걸면 브라우저가 현재 페이지를 다시 받아 온다 — 그리지 않는 편이 맞다.
  it('주소가 없으면 그림을 걸지 않는다', () => {
    const { container } = render(<EventThumbnail src="" />)
    expect(container.querySelector('img')).toBeNull()
  })

  // **끝난 행사의 파일이 내려가면 404가 온다.** 그때 브라우저는 카드 안에
  // 깨진 아이콘을 그리고, 그건 「이미지가 없다」가 아니라 「앱이 고장났다」로
  // 읽힌다. 이 상태를 들고 있으려고 컴포넌트를 따로 뒀다.
  it('불러오기에 실패하면 자리를 통째로 뺀다', () => {
    const { container } = render(<EventThumbnail src={SRC} />)
    const image = container.querySelector('img')
    expect(image).not.toBeNull()

    fireEvent.error(image as HTMLImageElement)

    expect(container.querySelector('img')).toBeNull()
  })

  // 바로 옆에 행사 이름이 글자로 있다. 여기 같은 이름을 넣으면 스크린리더가
  // 두 번 읽는다 — 포스터는 장식이라 이름이 없는 것이 맞다.
  it('대체 텍스트가 비어 있어 이름을 두 번 읽지 않는다', () => {
    render(<EventThumbnail src={SRC} />)
    expect(screen.queryByRole('img')).toBeNull()
  })

  // 목록이 열 몇 장까지 늘 수 있다. 화면 밖의 그림까지 한꺼번에 받으면
  // 셀 데이터로 여는 사용자에게 그대로 청구된다.
  it('화면 밖 그림을 미리 받지 않는다', () => {
    const { container } = render(<EventThumbnail src={SRC} />)
    expect(container.querySelector('img')).toHaveAttribute('loading', 'lazy')
  })
})
