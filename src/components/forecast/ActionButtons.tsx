import type { ReactNode } from 'react'
import { kakaoMapSearchUrl, naverMapSearchUrl } from '../../domain/mapLinks'
import type { AreaCatalogEntry } from '../../domain/types'
import { openExternalUrl, shareMessage } from '../../platform/links'
import { Icon, type IconName } from '../common/Icon'

interface Props {
  readonly entry: AreaCatalogEntry
  /** 공유와 같은 줄, 그 왼쪽에 설 버튼. 「저장」이 여기로 들어온다.
   *
   * 저장은 즐겨찾기 상태라 이 컴포넌트가 알 일이 아니지만 자리는 여기다 —
   * Google Maps의 Directions·Save·Share 한 행이고, 공유와 나란히 두면 행이
   * 하나 더 늘지 않는다. 비워 두면 공유가 예전처럼 혼자 한 줄을 쓴다. */
  readonly children?: ReactNode
}

interface MapLink {
  readonly label: string
  readonly icon: IconName
  /** 인코딩되지 않은 명소 이름을 받는다. 인코딩은 빌더가 한다. */
  readonly href: (name: string) => string
  readonly className: string
}

const MAP_LINKS: readonly MapLink[] = [
  {
    label: '카카오맵 길찾기',
    icon: 'pin',
    href: kakaoMapSearchUrl,
    className: 'bg-[#FEE500] text-[#191600]',
  },
  {
    label: '네이버 길찾기',
    icon: 'map',
    href: naverMapSearchUrl,
    className: 'bg-[#03C75A] text-white',
  },
]

export function ActionButtons({ entry, children }: Props) {
  // href를 실제로 채운 <a>로 둔다. 브리지가 없을 때 열 주소가 여기 남아 있어야
  // 폴백이 성립하고, 스크린리더도 링크로 읽는다. 실제 열기는 openExternalUrl이
  // 맡으므로 기본 동작은 막는다 — 웹뷰에서 두 번 열리는 걸 방지한다.
  return (
    <div className="flex flex-col gap-3 px-4">
      <div className="flex gap-3">
        {MAP_LINKS.map((link) => (
          <a
            key={link.label}
            href={link.href(entry.name)}
            target="_blank"
            rel="noreferrer"
            onClick={(event) => {
              event.preventDefault()
              void openExternalUrl(link.href(entry.name))
            }}
            className={`flex min-h-12 flex-1 items-center justify-center gap-1.5 rounded-action text-label-md font-semibold ${link.className}`}
          >
            <Icon name={link.icon} className="size-5" />
            {link.label}
          </a>
        ))}
      </div>
      <div className="flex gap-3">
        {children}
        <button
          type="button"
          onClick={() => {
            void shareMessage(`${entry.name} 실시간 혼잡도 - 서울 라이브`)
          }}
          className="flex min-h-12 flex-1 items-center justify-center gap-1.5 rounded-action border border-outline-variant bg-surface-container-lowest text-label-md font-semibold text-on-surface"
        >
          <Icon name="share" className="size-5" />
          친구에게 공유하기
        </button>
      </div>
    </div>
  )
}
