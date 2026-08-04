import type { AreaCatalogEntry } from '../../domain/types'
import { openExternalUrl, shareMessage } from '../../platform/links'

interface Props {
  readonly entry: AreaCatalogEntry
}

interface MapLink {
  readonly label: string
  readonly href: (query: string) => string
  readonly className: string
}

const MAP_LINKS: readonly MapLink[] = [
  {
    label: '카카오맵 길찾기',
    href: (query) => `https://map.kakao.com/link/search/${query}`,
    className: 'bg-[#FEE500] text-[#191600]',
  },
  {
    label: '네이버 길찾기',
    href: (query) => `https://map.naver.com/p/search/${query}`,
    className: 'bg-[#03C75A] text-white',
  },
]

export function ActionButtons({ entry }: Props) {
  const query = encodeURIComponent(entry.name)

  // href를 실제로 채운 <a>로 둔다. 브리지가 없을 때 열 주소가 여기 남아 있어야
  // 폴백이 성립하고, 스크린리더도 링크로 읽는다. 실제 열기는 openExternalUrl이
  // 맡으므로 기본 동작은 막는다 — 웹뷰에서 두 번 열리는 걸 방지한다.
  return (
    <div className="flex flex-col gap-2 px-4">
      <div className="flex gap-2">
        {MAP_LINKS.map((link) => (
          <a
            key={link.label}
            href={link.href(query)}
            target="_blank"
            rel="noreferrer"
            onClick={(event) => {
              event.preventDefault()
              void openExternalUrl(link.href(query))
            }}
            className={`flex min-h-12 flex-1 items-center justify-center rounded-action text-sm font-semibold ${link.className}`}
          >
            {link.label}
          </a>
        ))}
      </div>
      <button
        type="button"
        onClick={() => {
          void shareMessage(`${entry.name} 실시간 혼잡도 - 서울 라이브`)
        }}
        className="min-h-12 rounded-action border border-outline-variant bg-surface-container-lowest text-sm font-semibold text-on-surface"
      >
        친구에게 공유하기
      </button>
    </div>
  )
}
