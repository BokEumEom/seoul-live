import { t } from '../../i18n/t'
import {
  elevators,
  SUBWAY_FACILITY_KINDS,
  underRepair,
  type SubwayFacility,
} from '../../domain/subwayFacility'
import { Icon } from '../common/Icon'

/**
 * 역 이름 오른쪽의 교통약자 표시. 시안 `stitch_ui_ux/_4`가 「⑤ 광화문역」 줄
 * 끝에 `accessible_forward`를 놓은 자리다.
 *
 * **「있다」만 말한다.** 서울이 이 배열을 안 주는 역이 실호출 44역 중 31곳이고
 * 거기에 강남역·서울역이 들어 있다 — 둘 다 실제로는 엘리베이터가 있다. 없다는
 * 말을 할 수 있는 데이터가 아니라서 표시가 없는 것은 「모른다」다.
 *
 * **보수중이어도 표시는 남는다.** 신길역은 엘리베이터 6대 중 1대가 보수중이었다
 * (2026-08-27). 한 대 때문에 표시를 떼면 나머지 다섯이 화면에서 사라진다 —
 * 어느 것이 멈췄는지는 아래 `FacilityRepairs`가 적는다.
 */
export function ElevatorMark({
  facilities,
}: {
  readonly facilities: readonly SubwayFacility[]
}) {
  if (elevators(facilities).length === 0) {
    return null
  }

  // **휠체어 그림이다.** 「엘리베이터」·「에스컬레이터」 글리프는 둘 다 속을
  // 채운 사각형이라 16px에서 검은 덩어리로 뭉갠다(2026-08-27, 크롬으로 실제
  // 렌더해서 봤다). 이 그림만 열린 형태라 그 크기에서 읽힌다 — 시안이 고른
  // `accessible_forward`와 같은 뜻이기도 하다.
  //
  // `Icon`은 언제나 `aria-hidden`이라 이름은 감싼 상자가 진다.
  return (
    <span
      role="img"
      aria-label={t('엘리베이터 있음')}
      className="ml-auto shrink-0 text-on-surface-variant"
    >
      <Icon name="accessible" className="size-4" />
    </span>
  )
}

function kindLabel(facility: SubwayFacility): string {
  // 갈래를 몰라도 「무언가 보수중」은 참이다. 통째로 버리면 그 사실을 잃는다.
  return facility.kind === null
    ? t('승강기')
    : t(SUBWAY_FACILITY_KINDS[facility.kind])
}

/**
 * 「에스컬레이터 B2-B3」. **둘이 붙어야 한 사실이다** — 「B2-B3」만으로는 무엇이
 * 멈췄는지 모르고, 갈래만으로는 어디 것인지 모른다.
 *
 * **빈 조각을 걸러 잇는다**(`AccidentList`의 `typeLabel`과 같은 꼴). 다만 저쪽은
 * 구분점이 「·」이라 안 거르면 「교통사고 ·」가 눈에 보이는데, 여기 구분자는
 * 공백이라 **안 걸러도 화면이 똑같다** — 꼬리 공백은 HTML에서 접힌다. 그래서
 * 이 갈래에는 테스트가 없다. 무엇을 해도 통과하는 테스트를 두느니 없는 게 낫다.
 */
function repairLine(facility: SubwayFacility): string {
  return [kindLabel(facility), facility.section]
    .filter((part) => part !== '')
    .join(' ')
}

/**
 * 보수중인 승강기. **이 절에서 유일하게 실시간인 값이다** — 어느 역에 엘리베이터가
 * 몇 대 있는지는 지도 앱에도 있지만, 그중 하나가 지금 멈춰 있다는 것은 여기에만
 * 있다. 실호출 160건 중 11건(6.9%)이 보수중이었고, 승강기를 주는 13역 중 8역에
 * 적어도 한 건이 있었다.
 *
 * **사용가능한 것은 안 적는다.** 고속터미널 7호선이 28건인데 전부 적으면 도착
 * 열차 세 줄 아래로 스물여덟 줄이 붙는다. 사용자가 행동을 바꾸는 것은 멈춘
 * 쪽뿐이다.
 *
 * **주황이고 빨강이 아니다.** 빨강은 재난문자·기상특보의 것이고, 차량 통제에서
 * 정한 규칙과 같다 — 에스컬레이터 한 대가 재난문자와 같은 무게일 수 없다.
 * 상자를 깔지 않고 글자만 물들이는 것은 이 목록이 이미 흰 카드 안 회색 줄
 * 아래에 들어가기 때문이다(세 겹이 된다). `text-on-busy-container`는 흰
 * 표면에서 9.38:1이다 — 선명한 `text-busy` 쪽은 여기서 못 쓴다.
 */
export function FacilityRepairs({
  facilities,
  title,
}: {
  readonly facilities: readonly SubwayFacility[]
  /** 어느 역·호선인지. 목록의 접근성 이름에만 쓴다 */
  readonly title: string
}) {
  const broken = underRepair(facilities)

  if (broken.length === 0) {
    return null
  }

  return (
    <div className="mt-2">
      {/* **「보수중」을 글자로 적는다.** 주황만으로 말하면 색을 못 보는 사람에게
          그냥 목록이다(WCAG 1.4.1). 삼각형도 같은 이유로 함께 선다. */}
      <p className="flex items-center gap-1.5 text-label-md text-on-busy-container">
        <Icon name="warning" className="size-4" />
        {t('보수중')}
      </p>
      {/* role="list"를 명시하는 이유는 위 도착 목록과 같다 — preflight의
          list-style:none이 WebKit에서 목록 시맨틱을 지운다. */}
      <ul
        role="list"
        aria-label={t('{역} 보수중 시설', { 역: title })}
        className="mt-1 flex flex-col gap-2"
      >
        {broken.map((facility, index) => (
          // 승강기에는 고유 ID가 없다. 같은 갈래·같은 구간이 두 대 있을 수 있어
          // (광화문의 B2-B3와 B3-B2처럼 방향만 다르다) 순번을 함께 쓴다.
          <li key={`${facility.kind}-${facility.section}-${index}`}>
            <p className="text-label-md text-on-surface">{repairLine(facility)}</p>
            {/* 설치위치는 자유 문장이라 옮기지 않는다 — 「환승통로(2호선 방면)」·
                「서대문 방면1-1」처럼 역 이름과 출구 번호가 섞여 있다. 줄을
                가르는 이유는 실측값이 「서대문 방면1-1, 종로3가 방면8-4」처럼
                길어서다. 앞 줄에 이어 붙이면 390px에서 세 줄로 흐른다.

                **빈 값을 걸러도 눈에는 아무 차이가 없다** — 빈 `<p>`는 높이가
                0이다. 그래도 거르는 것은 이 줄에 나중에 아이콘이나 앞말이 붙는
                날을 위해서다. 시안 `_7`에서 값 없는 기간에 시계 아이콘만 남아
                떠 있던 자리가 정확히 그 경우였다. */}
            {facility.position !== '' && (
              <p className="text-label-sm text-on-surface-variant">
                {facility.position}
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
