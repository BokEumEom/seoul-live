import { describe, expect, it } from 'vitest'
import { kakaoMapSearchUrl, naverMapSearchUrl } from './mapLinks'

describe('kakaoMapSearchUrl', () => {
  it('명소 이름을 URL 인코딩해 붙인다', () => {
    expect(kakaoMapSearchUrl('강남역')).toBe(
      `https://map.kakao.com/link/search/${encodeURIComponent('강남역')}`,
    )
  })

  it('괄호와 가운뎃점이 든 이름도 인코딩한다', () => {
    // 카탈로그에 `광장(전통)시장`, `광화문·덕수궁`처럼 URL에서 의미를 갖는
    // 문자가 든 이름이 있다. 인코딩을 빠뜨리면 그 명소만 조용히 엉뚱한 곳을 연다.
    expect(kakaoMapSearchUrl('광장(전통)시장')).toBe(
      `https://map.kakao.com/link/search/${encodeURIComponent('광장(전통)시장')}`,
    )
    expect(kakaoMapSearchUrl('광화문·덕수궁')).toContain('%C2%B7')
  })
})

describe('naverMapSearchUrl', () => {
  it('명소 이름을 URL 인코딩해 붙인다', () => {
    expect(naverMapSearchUrl('경복궁')).toBe(
      `https://map.naver.com/p/search/${encodeURIComponent('경복궁')}`,
    )
  })
})
