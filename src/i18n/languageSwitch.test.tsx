import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { ActionButtons } from '../components/home/ActionButtons'
import { AreaHero } from '../components/home/AreaHero'
import { PopulationCard } from '../components/home/PopulationCard'
import { AreaListItem } from '../components/list/AreaListItem'
import { LocationNotice } from '../components/list/LocationNotice'
import { SortSegmented } from '../components/list/SortSegmented'
import { ThemeSetting } from '../components/today/ThemeSetting'
import { AREA_CATALOG } from '../data/areas'
import { reset, setLanguage } from '../hooks/languageStore'

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

  it('정렬 줄이 영어로 바뀐다', () => {
    setLanguage('en')
    render(
      <SortSegmented value="calm" canSortByDistance onChange={() => undefined} />,
    )

    expect(screen.getByRole('button', { name: 'Nearest' })).toBeInTheDocument()
  })

  it('화면 테마 줄이 영어로 바뀐다', () => {
    setLanguage('en')
    render(<ThemeSetting />)

    expect(screen.getByRole('button', { name: 'Light' })).toBeInTheDocument()
  })

  it('지도 앱 버튼이 영어로 바뀐다', () => {
    setLanguage('en')
    render(
      <ActionButtons
        entry={AREA_CATALOG[0]}
        saved={false}
        onSave={() => undefined}
      />,
    )

    expect(screen.getByRole('link', { name: /KakaoMap/ })).toBeInTheDocument()
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

  // **저장·공유 문구는 이름을 값으로 끼워 넣는다.** 바깥은 영어인데 끼워
  // 넣은 이름만 한국어면 한 문장이 두 언어로 갈린다.
  it('공유·저장 안내에 끼워 넣는 이름도 영어다', async () => {
    setLanguage('en')
    const entry = AREA_CATALOG.find((area) => area.name === '인사동')!
    render(
      <ActionButtons entry={entry} saved={false} onSave={() => undefined} />,
    )

    await userEvent.click(screen.getByRole('button', { name: /Save/ }))

    expect(screen.getByRole('status')).toHaveTextContent('Insa-dong Saved')
  })
})
