import { afterEach, describe, expect, it } from 'vitest'
import { AREA_CATALOG, findAreaByName } from '../data/areas'
import { reset, setLanguage } from '../hooks/languageStore'
import { areaDisplayName, areaDisplayNameOf } from './areaName'

describe('areaDisplayName', () => {
  afterEach(() => {
    reset()
  })

  const insadong = AREA_CATALOG.find((area) => area.name === '인사동')

  it('한국어에서는 한국어 이름을 준다', () => {
    expect(areaDisplayName(insadong!)).toBe('인사동')
  })

  it('영어에서는 영어 이름을 준다', () => {
    setLanguage('en')
    expect(areaDisplayName(insadong!)).toBe('Insa-dong')
  })

  // 호출 키·지도 앱 검색어는 한국어여야 한다. 표시용 이름이 그 자리로 새면
  // 카카오맵이 「Insa-dong」을 찾게 되고 API는 그 명소를 모른다.
  it('카탈로그의 한국어 이름은 건드리지 않는다', () => {
    setLanguage('en')
    expect(findAreaByName('인사동')?.name).toBe('인사동')
  })
})

describe('areaDisplayNameOf', () => {
  afterEach(() => {
    reset()
  })

  it('이름만 있어도 영어로 바꿔 준다', () => {
    setLanguage('en')
    expect(areaDisplayNameOf('경복궁')).toBe('Gyeongbokgung Palace')
  })

  // 서울 API가 카탈로그에 없는 이름을 주는 날이 온다(121곳 확장·이름 변경).
  // 그때 빈 칸을 보여주느니 받은 이름을 그대로 적는 편이 낫다.
  it('카탈로그에 없는 이름은 그대로 돌려준다', () => {
    setLanguage('en')
    expect(areaDisplayNameOf('부산역')).toBe('부산역')
  })
})
