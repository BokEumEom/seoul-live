import { t } from '../../i18n/t'
import type { CulturalEvent } from '../../domain/cityInfo'

interface Props {
  readonly events: readonly CulturalEvent[]
}

export function EventList({ events }: Props) {
  return (
    <ul className="flex flex-col gap-4">
      {events.map((event, index) => (
        // 행사에는 고유 ID가 없다. 같은 이름의 행사가 장소만 달리해 여러 건 올 수
        // 있어 이름만으로는 부족하다.
        <li key={`${event.name}-${index}`}>
          {event.url === '' ? (
            <p className="text-body-md text-on-surface">{event.name}</p>
          ) : (
            // 웹뷰 밖으로 나가는 링크다. opener를 남기면 열린 페이지가 이쪽
            // window를 조작할 수 있다.
            <a
              href={event.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-body-md text-primary underline"
            >
              {event.name}
            </a>
          )}
          <p className="mt-1 text-label-md text-on-surface-variant">
            {[event.period, event.place].filter((part) => part !== '').join(' · ')}
          </p>
          {event.free !== null && (
            <p className="mt-0.5 text-label-sm text-outline">
              {event.free ? t('무료') : t('유료')}
            </p>
          )}
        </li>
      ))}
    </ul>
  )
}
