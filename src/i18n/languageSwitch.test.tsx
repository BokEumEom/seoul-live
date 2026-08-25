import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AccidentList } from '../components/cityinfo/AccidentList'
import { AlertBanner } from '../components/cityinfo/AlertBanner'
import { SubwayArrivals } from '../components/cityinfo/SubwayArrivals'
import { ActionButtons } from '../components/home/ActionButtons'
import { MapLinkButtons } from '../components/home/MapLinkButtons'
import { AreaHero } from '../components/home/AreaHero'
import { PopulationCard } from '../components/home/PopulationCard'
import { AreaListItem } from '../components/list/AreaListItem'
import { LocationNotice } from '../components/list/LocationNotice'
import { FilterChips } from '../components/home/FilterChips'
import { ThemeSetting } from '../components/today/ThemeSetting'
import { AREA_CATALOG } from '../data/areas'
import { reset, setLanguage } from '../hooks/languageStore'

// **즐겨찾기 스토어를 고정한다.** `ActionButtons`가 직접 구독하는데(별을 누를
// 때 상세를 통째로 다시 그리지 않으려고 구독을 그 자리로 내렸다), 이 파일이
// 보는 것은 **언어**다. 실제 스토어를 쓰면 앞 테스트가 담은 곳이 뒤 테스트의
// 라벨을 「Saved」로 바꿔 놓는다.
vi.mock('../hooks/useFavorites', () => ({
  useFavorites: () => ({
    favorites: [],
    isFavorite: () => false,
    toggle: () => undefined,
  }),
}))

/**
 * **언어를 바꾸면 화면이 실제로 따라오는가.**
 *
 * `i18n.test.ts`의 완결성 검사는 사전에 항목이 **있는가**만 본다. 항목이 있어도
 * 화면이 그 항목을 **언제** 읽는지가 틀리면 영어 모드에서 한국어가 남는다 —
 * 모듈 최상위에서 `t()`를 부르면 import 시점의 언어(한국어)로 굳어 버린다.
 * 사전은 완전한데 화면만 안 바뀌므로 기존 검사 다섯 개가 전부 통과한다.
 *
 * 여기서는 실제로 언어를 바꾸고 렌더해서 확인한다.
 */
describe('언어를 바꾸면 화면이 따라온다', () => {
  afterEach(() => {
    reset()
  })

  // 정렬 줄이 있던 자리다. 그 줄이 없어지면서 같은 함정(모듈 최상위 `t()`가
  // import 시점의 언어로 굳는다)을 가진 칩 줄로 갈아 끼웠다 — 이 검사가 잡는
  // 것은 자리가 아니라 함정이라 단언의 뜻은 그대로다.
  it('필터 칩 줄이 영어로 바뀐다', () => {
    setLanguage('en')
    render(
      <FilterChips
        counts={{ fav: 0, calm: 1, normal: 2, busy: 3, crowded: 4, kids: 5, date: 6 }}
        total={7}
        value={null}
        onChange={() => undefined}
      />,
    )

    expect(screen.getByRole('button', { name: 'All 7' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'With kids 5' })).toBeInTheDocument()
  })

  it('화면 테마 줄이 영어로 바뀐다', () => {
    setLanguage('en')
    render(<ThemeSetting />)

    expect(screen.getByRole('button', { name: 'Light' })).toBeInTheDocument()
  })

  // 길찾기 셋은 상세 맨 아래의 `MapLinkButtons`로 옮겨갔다(샘플의 배치).
  // 이 검사가 잡는 것은 자리가 아니라 **모듈 최상위 `t()`가 언어를 굳히는
  // 함정**이라, 컴포넌트만 갈아 끼우고 단언은 그대로 둔다.
  it('지도 앱 버튼이 영어로 바뀐다', () => {
    setLanguage('en')
    render(<MapLinkButtons entry={AREA_CATALOG[0]} />)

    expect(screen.getByRole('link', { name: /KakaoMap/ })).toBeInTheDocument()
  })

  // **공유 링크의 명소 이름만은 안 바뀐다.** 사람이 읽는 문장은 영어여야
  // 하지만 주소는 **앱이 되읽는 키**다 — 영어 화면에서 보낸 링크를 한국어
  // 화면에서 열어도 같은 명소여야 하고, `routeFromSearch`는 카탈로그의
  // `name`(한국어)만 안다. `areaDisplayName`을 실으면 영어 사용자가 보낸
  // 링크가 전부 목록으로 떨어진다.
  it('공유 링크는 영어 화면에서도 한국어 이름을 싣는다', async () => {
    setLanguage('en')
    const links = await import('../platform/links')
    const share = vi
      .spyOn(links, 'shareMessage')
      .mockResolvedValue(undefined)
    render(
      <ActionButtons entry={AREA_CATALOG[0]} />,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Share' }))

    const message = share.mock.calls[0]?.[0] ?? ''
    // **인코딩 방식을 못 박지 않는다.** 예전에는 `encodeURIComponent(name)`을
    // 그대로 찾았는데, 그건 첫 명소가 「강남역」이라 공백이 없어서 통했을 뿐이다.
    // 카탈로그가 121곳이 되면서 첫 자리가 「강남 MICE 관광특구」가 됐고, 공백을
    // `%20`으로 쓰느냐 `+`로 쓰느냐는 둘 다 옳은 URL이라 그 차이로 테스트가
    // 깨졌다. 정작 확인하려던 것은 **주소에 실린 이름이 한국어인가**이므로,
    // 다시 읽어서 값으로 비교한다.
    const shared = new URL(/https?:\/\/\S+/.exec(message)?.[0] ?? '')
    expect([...shared.searchParams.values()]).toContain(AREA_CATALOG[0].name)
    // 사람이 읽는 줄은 영어다. 둘이 한 문자열에 함께 산다.
    expect(message).toContain(AREA_CATALOG[0].nameEn)
  })

  it('위치 안내가 영어로 바뀐다', () => {
    setLanguage('en')
    render(<LocationNotice status="denied" onRetry={() => undefined} />)

    expect(screen.getByRole('button', { name: 'Allow' })).toBeInTheDocument()
  })

  // **도메인이 주는 한국어 값을 화면이 감쌌는가.** 사전에는 항목이 있는데
  // 아무도 요청하지 않으면 그 자리만 한국어로 남는다 — 완결성 검사는
  // `dynamicKeys()`가 「쓴다」고 선언한 것을 믿을 뿐이라 이 상태를 못 잡는다.
  // 1280px 실측에서 「20대 17%」와 「동네 생활권이에요」가 영어 화면에 있었다.
  it('연령대·거주 알약이 영어로 바뀐다', () => {
    setLanguage('en')
    render(
      <PopulationCard
        composition={{
          maleRate: 52,
          femaleRate: 48,
          nonResidentRate: 58,
          ageRates: [0, 5, 17, 20, 21, 18, 12, 7],
        }}
      />,
    )

    expect(screen.getByText('30s')).toBeInTheDocument()
    // 58%는 임계값 60을 안 넘으므로 「동네 생활권」이다 — 1280px 실측에서 본
    // 화면과 같은 조합이다(「58% visitors」 옆에 「동네 생활권이에요」).
    expect(screen.getByText('Mostly locals')).toBeInTheDocument()
    expect(screen.queryByText('30대')).not.toBeInTheDocument()
    // **막대의 접근성 이름은 따로 짓는다**(`chartLabel`). 눈에 보이는 줄만
    // 감싸면 이 자리가 조용히 한국어로 남는데 화면을 봐서는 알 수 없다 —
    // 실제로 한 번 그렇게 만들었고 위 두 단언은 통과했다.
    expect(
      screen.getByRole('img', { name: /Age mix|20s|30s/ }),
    ).toHaveAccessibleName(expect.stringContaining('30s'))
  })

  // 사용자가 지목한 자리다 — 「인사동」이 영어 화면에 그대로 남아 있었다.
  // 목록 한 줄이 통째로 못 읽는 글자면 나머지를 다 옮겨도 소용이 없다.
  it('목록의 명소 이름이 영어로 바뀐다', () => {
    setLanguage('en')
    const entry = AREA_CATALOG.find((area) => area.name === '인사동')!
    render(
      <AreaListItem
        area={{ entry, snapshot: null, distanceMeters: null }}
        onSelect={() => undefined}
      />,
    )

    expect(screen.getByText('Insa-dong')).toBeInTheDocument()
    expect(screen.queryByText('인사동')).not.toBeInTheDocument()
  })

  it('상세 제목도 영어로 바뀐다', () => {
    setLanguage('en')
    const entry = AREA_CATALOG.find((area) => area.name === '인사동')!
    render(<AreaHero entry={entry} coords={null} level="여유" />)

    expect(
      screen.getByRole('heading', { name: 'Insa-dong' }),
    ).toBeInTheDocument()
  })

  // **사용자가 지목한 자리다**(2026-08-21, 「상세 페이지 영어 지원이 완벽하게
  // 전환되지 않는다」). 영어로 렌더해 DOM에 남은 한글을 훑어 찾았다 — 정적
  // 검사 셋이 전부 초록이었다. 키가 **런타임 값**이라 `translatedKeys()`가 못
  // 세고, `dynamicKeys()`는 「쓴다」고 선언만 하는 자리다.
  //
  // 재해구분명·긴급단계명은 **자유 문장이 아니라 갈래 이름**이다. 바로 아랫줄
  // `message`(재난문자 본문)는 사람이 쓴 문장이라 못 옮기는데, 그 둘이 한
  // 상자에 있어 안 옮기는 쪽에 끌려가 있었다.
  it('재난문자의 재해구분·긴급단계가 영어로 바뀐다', () => {
    setLanguage('en')
    render(
      <AlertBanner
        alerts={[
          {
            category: '호우',
            step: '주의보',
            message: '[서울시] 호우주의보 발효.',
            createdAt: '2026-08-21 13:00',
          },
        ]}
      />,
    )

    expect(screen.getByText('Heavy rain Advisory')).toBeInTheDocument()
    expect(screen.queryByText('호우 주의보')).not.toBeInTheDocument()
    // **본문은 한국어로 남는 것이 옳다.** 재난문자는 서울 API의 자유 문장이라
    // 옮길 수 없다 — 여기까지 영어를 기대하면 다음 사람이 지어내게 된다.
    expect(screen.getByText('[서울시] 호우주의보 발효.')).toBeInTheDocument()
  })

  it('사고통제의 유형·세부유형이 영어로 바뀐다', () => {
    setLanguage('en')
    render(
      <AccidentList
        accidents={[
          {
            info: '세종대로 차량 2대 추돌',
            type: '교통사고',
            detailType: '차대차',
            occurredAt: '2026-08-21 14:30',
            expectedClearAt: '2026-08-21 16:00',
          },
        ]}
      />,
    )

    expect(screen.getByText('Traffic accident · Vehicle collision')).toBeInTheDocument()
    expect(screen.queryByText('교통사고 · 차대차')).not.toBeInTheDocument()
  })

  // 실호출 응답(`docs/fixtures/citydata-광화문덕수궁.json`)의 `SUB_DIR`가 이
  // 둘이다. 역 이름은 여전히 한국어로 남는다 — 그건 결함이 아니라 규칙이다.
  it('지하철 방향어가 영어로 바뀐다', () => {
    setLanguage('en')
    render(
      <SubwayArrivals
        arrivals={[
          {
            station: '광화문',
            line: '5호선',
            direction: '상행',
            terminal: '방화',
            message: '전역 출발',
          },
        ]}
      />,
    )

    expect(screen.getByText('Upbound')).toBeInTheDocument()
    expect(screen.queryByText('상행')).not.toBeInTheDocument()
    expect(screen.getByText('광화문')).toBeInTheDocument()
  })

  // **저장·공유 문구는 이름을 값으로 끼워 넣는다.** 바깥은 영어인데 끼워
  // 넣은 이름만 한국어면 한 문장이 두 언어로 갈린다.
  it('공유·저장 안내에 끼워 넣는 이름도 영어다', async () => {
    setLanguage('en')
    const entry = AREA_CATALOG.find((area) => area.name === '인사동')!
    render(
      <ActionButtons entry={entry} />,
    )

    await userEvent.click(screen.getByRole('button', { name: /Save/ }))

    expect(screen.getByRole('status')).toHaveTextContent('Insa-dong Saved')
  })
})
