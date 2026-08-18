import { t } from '../../i18n/t'
import type { CityAlert } from '../../domain/cityInfo'
import { Icon } from '../common/Icon'

interface Props {
  readonly alerts: readonly CityAlert[]
  /** 전체 목록이 있는 「오늘의 서울」을 연다. */
  readonly onOpen: () => void
}

/**
 * 홈 맨 위의 재난문자 배너. 서울 인파레이더가 같은 자리에 같은 것을 둔다.
 *
 * **건수가 아니라 본문을 보여준다.** 예전에는 요약 줄이 「재난문자 1건」이라는
 * 수만 말했는데, 수로는 우산을 챙길 일인지 대피할 일인지 알 수 없다. 재난문자는
 * 읽으라고 오는 것이라 첫 문장이 보여야 한다.
 *
 * **여러 건이어도 첫 건만 세운다.** 다 펼치면 배너가 화면을 덮어 정작 지도와
 * 목록을 못 본다. 나머지는 수로 말하고 누르면 전체가 있는 「오늘의 서울」이
 * 열린다 — 요약 줄이 이미 그 자리로 가는 손잡이라 목적지가 하나로 모인다.
 *
 * **경보가 없는 날이 대부분이다.** 그때는 통째로 빠져 세로 공간을 한 픽셀도
 * 안 쓴다 — 시트에서 가장 귀한 자원이 세로다.
 */
export function AlertBanner({ alerts, onOpen }: Props) {
  const [first, ...rest] = alerts
  if (first === undefined) {
    return null
  }

  return (
    // **`role="alert"`을 두지 않는다.** assertive 리전이라 보조기술이 읽던 것을
    // 끊는데, 그 값을 하는 것은 「방금 일어난 일」이다. 이 배너는 앱을 열면
    // 이미 자리에 있다 — `AlertDigest`가 같은 판단을 한 근거를 여기서도 지킨다.
    <button
      type="button"
      onClick={onOpen}
      // **여백을 스스로 갖는다**(`AlertDigest`·`RankList`와 같다). 부르는
      // 쪽이 `<div className="px-4">`로 감싸면 경보가 없는 날에도 그 빈 div가
      // 남아, 세로 묶음의 `gap-3`이 12px을 통째로 먹는다 — 화면에는 아무것도
      // 없는데 목록이 밀린다. 스스로 `null`이 되려면 바깥까지 자기 것이어야 한다.
      // `w-full`이 아니라 `mx-4`인 것은 세로 flex가 이미 늘려 주기 때문이다.
      className="mx-4 flex items-start gap-2.5 rounded-card bg-error-container p-3 text-left text-on-error-container"
    >
      {/* 색만으로 경고를 말하지 않는다(WCAG 1.4.1). 아이콘이 두 번째 통로다. */}
      <Icon name="warning" className="mt-0.5 size-5 shrink-0" />
      <span className="min-w-0 flex-1">
        {/* 본문을 두 줄까지 보여준다. 재난문자는 첫 문장에 「무엇을 하라」가
            들어 있고, 세 줄을 넘기면 배너가 목록을 밀어낸다. */}
        <span className="line-clamp-2 block text-body-md leading-6">
          {first.message}
        </span>
        {rest.length > 0 && (
          <span className="mt-0.5 block text-label-sm opacity-80">
            {t('외 {개수}건', { 개수: rest.length })}
          </span>
        )}
      </span>
      {/* 보이는 문구는 경보 본문이라 눌러서 무엇이 열리는지 말해주지 않는다.
          `aria-label`로 덮으면 보이는 글자와 이름이 어긋나 음성 제어가 보이는
          문구로 못 부른다 — `SummaryStrip`과 같은 처리다. */}
      <span className="sr-only">{t(', 오늘의 서울 열기')}</span>
      <span aria-hidden className="shrink-0 text-label-md">
        ›
      </span>
    </button>
  )
}
