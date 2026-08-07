import { AREA_CATALOG } from '../../data/areas'
import { Icon } from '../common/Icon'

interface Props {
  readonly value: string
  readonly onChange: (name: string) => void
}

// `citydata`는 장소 단위 API라 도시정보 화면도 명소 하나를 기준으로만 성립한다.
// 네이티브 `<select>`를 쓴다 — 30개짜리 목록을 자체 시트로 구현하면 웹뷰에서
// 스크롤·포커스·닫기를 전부 우리가 책임져야 하고, 앱인토스 심사 항목인
// "진입 시 자동으로 열리는 바텀시트"와도 헷갈릴 여지가 생긴다.
export function AreaPicker({ value, onChange }: Props) {
  return (
    <div className="px-4">
      <label htmlFor="more-area-picker" className="text-label-md text-on-surface-variant">
        명소 선택
      </label>
      <div className="relative mt-1.5">
        <select
          id="more-area-picker"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="min-h-12 w-full appearance-none rounded-action border border-outline-variant bg-surface-container-lowest px-4 pr-10 text-body-md text-on-surface"
        >
          {AREA_CATALOG.map((entry) => (
            <option key={entry.code} value={entry.name}>
              {entry.name}
            </option>
          ))}
        </select>
        <Icon
          name="chevronDown"
          className="pointer-events-none absolute top-1/2 right-3 size-5 -translate-y-1/2 text-on-surface-variant"
        />
      </div>
    </div>
  )
}
