import type { ReactNode } from 'react'
import { Icon, type IconName } from '../common/Icon'

interface Props {
  readonly title: string
  /**
   * 요약 칩이 뛰어올 자리. 있으면 이 절이 이름을 가진 리전이 되고
   * (`aria-labelledby`) 포커스를 받을 수 있게 된다 — 칩을 눌러 화면만 옮기고
   * 포커스를 두고 오면 키보드·스크린리더 사용자는 제자리에 남는다.
   */
  readonly id?: string
  /** 제목 옆 글리프. 절이 예닐곱 개로 늘면서 글자만으로는 훑기가 힘들어졌다. */
  readonly icon?: IconName
  /** 「주차장 12」처럼 제목 옆에 붙는 개수. 0도 적는다 — 없다는 것도 정보다. */
  readonly count?: number
  /**
   * 이 절의 값이 언제 기준인지. **비워 두면 「지금」이라고 주장하는 것과 같다.**
   * 도시정보는 하루 1,000회 한도 때문에 1시간 캐시로 받는데, 그러면 「4분 후
   * 도착」이나 「잔여 568면」이 최대 1시간 묵은 값일 수 있다. 숫자만 크게 적고
   * 기준을 안 적으면 앱이 거짓말을 한다.
   */
  readonly note?: string
  readonly children: ReactNode
}

/** 도시정보 화면의 섹션 껍데기. 카드 테두리·여백을 한 곳에 둔다. */
export function InfoSection({ title, id, icon, count, note, children }: Props) {
  const headingId = id === undefined ? undefined : `${id}-title`

  return (
    <section
      id={id}
      // `tabIndex`가 있어야 칩을 눌렀을 때 포커스를 여기로 옮길 수 있다.
      // `-1`이라 탭 순서에는 안 들어간다 — 절 자체는 탭으로 훑을 것이 아니다.
      tabIndex={id === undefined ? undefined : -1}
      // 이름이 없는 `section`은 암묵 role이 `generic`이라, 포커스가 와도
      // 스크린리더가 「무엇에 왔는지」를 말할 수 없다. 제목을 가리키면
      // `region`이 되어 「주차장, 리전」으로 읽힌다.
      aria-labelledby={headingId}
      className="mx-4 rounded-card border border-outline-variant bg-surface-container-lowest p-4"
    >
      {/* 제목·아이콘·개수가 한 줄이다. 개수를 제목 문자열에 이어 붙이지 않는
          이유는 접근성 이름 때문이다 — `heading` 이름이 「주차장 12」가 되면
          목차를 훑는 사용자에게 숫자가 제목의 일부처럼 읽힌다. 따로 두면
          「주차장」으로 읽히고 개수는 뒤따르는 글로 들린다. */}
      <div className="flex items-center gap-2">
        {icon !== undefined && <Icon name={icon} className="size-5 text-on-surface-variant" />}
        <h3 id={headingId} className="text-headline-sm text-on-surface">
          {title}
        </h3>
        {count !== undefined && (
          <span className="rounded-full bg-surface-container px-2 py-0.5 text-label-sm text-on-surface-variant">
            {count}
          </span>
        )}
      </div>
      {note !== undefined && (
        <p className="mt-1 text-label-sm font-normal text-outline">{note}</p>
      )}
      <div className="mt-3">{children}</div>
    </section>
  )
}

// 섹션마다 "없음"을 다르게 그리면 같은 화면에서 빈 상태가 여러 모양으로 보인다.
export function EmptyNote({ children }: { children: ReactNode }) {
  return <p className="text-body-md text-on-surface-variant">{children}</p>
}
