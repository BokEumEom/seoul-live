import { useState } from 'react'

interface Props {
  readonly src: string
}

/**
 * 행사 대표 이미지. 시안(`stitch_ui_ux/_7`)이 카드마다 그리는 그림이다.
 *
 * **깨진 그림을 그리지 않으려고 컴포넌트를 따로 뒀다.** 주소는 서울 문화포털
 * (`culture.seoul.go.kr`)을 가리키는데, 행사가 끝나 파일이 내려가면 404가 온다.
 * 그때 브라우저는 카드 안에 깨진 아이콘을 그리고, 그건 「이미지가 없다」가
 * 아니라 「앱이 고장났다」로 읽힌다. 실패를 상태로 들고 있어야 해서 훅이 필요하고,
 * 훅이 필요해서 `EventList`에서 꺼냈다.
 *
 * `alt`가 빈 문자열인 것은 실수가 아니다. 바로 옆에 행사 이름이 글자로 있어서
 * 여기에 같은 이름을 넣으면 스크린리더가 두 번 읽는다. 포스터는 장식이다.
 */
export function EventThumbnail({ src }: Props) {
  const [failed, setFailed] = useState(false)

  if (src === '' || failed) {
    return null
  }

  return (
    <img
      src={src}
      alt=""
      // 목록이 열 몇 장까지 늘 수 있다. 화면 밖의 그림까지 한꺼번에 받으면
      // 셀 데이터로 여는 사용자에게 그대로 청구된다.
      loading="lazy"
      onError={() => {
        setFailed(true)
      }}
      // 비율을 고정한다. 안 그러면 그림이 도착하는 순간 카드 높이가 튀어
      // 아래 행사들이 손가락 밑에서 밀린다(레이아웃 시프트).
      className="aspect-[16/9] w-full rounded-card bg-surface-container object-cover"
    />
  )
}
