import { describe, expect, it } from 'vitest'
import { kakaoMapSearchUrl, naverMapSearchUrl } from './mapLinks'

describe('kakaoMapSearchUrl', () => {
  it('명소 이름을 URL 인코딩해 붙인다', () => {
    // 기댓값에 encodeURIComponent를 다시 부르면 구현과 같은 함수를 쓰는 셈이라
    // 무엇으로 바꿔도 통과한다. 리터럴로 박아 구현과 독립시킨다.
    expect(kakaoMapSearchUrl('강남역')).toBe(
      'https://map.kakao.com/link/search/%EA%B0%95%EB%82%A8%EC%97%AD',
    )
  })

  it('URL에서 의미를 갖는 문자를 인코딩한다', () => {
    // 기댓값에 encodeURIComponent를 다시 부르면 구현과 같은 함수를 쓰는 셈이라
    // 무엇으로 바꿔도 통과한다. 리터럴로 박아 구현과 독립시킨다.
    // 참고: encodeURIComponent는 괄호를 인코딩하지 않는다 — 그대로 남는 게 정상이다.
    expect(kakaoMapSearchUrl('광화문·덕수궁')).toBe(
      'https://map.kakao.com/link/search/%EA%B4%91%ED%99%94%EB%AC%B8%C2%B7%EB%8D%95%EC%88%98%EA%B6%81',
    )
    expect(kakaoMapSearchUrl('광장(전통)시장')).toBe(
      'https://map.kakao.com/link/search/%EA%B4%91%EC%9E%A5(%EC%A0%84%ED%86%B5)%EC%8B%9C%EC%9E%A5',
    )
  })

  it('encodeURI가 아니라 encodeURIComponent로 인코딩한다', () => {
    // 위 두 테스트의 문자열(한글, 가운뎃점, 괄호)은 encodeURI와
    // encodeURIComponent가 우연히 같은 결과를 낸다 — 두 함수는 `; , / ? : @ & = + $ #`
    // 에서만 갈린다. 그래서 그 문자들만으로는 구현이 encodeURI로 바뀌어도
    // 못 잡는다. 갈리는 문자를 직접 넣어 실제로 구분되는 함수를 검증한다.
    expect(kakaoMapSearchUrl('a&b')).toBe(
      'https://map.kakao.com/link/search/a%26b',
    )
  })
})

describe('naverMapSearchUrl', () => {
  it('명소 이름을 URL 인코딩해 붙인다', () => {
    expect(naverMapSearchUrl('경복궁')).toBe(
      `https://map.naver.com/p/search/${encodeURIComponent('경복궁')}`,
    )
  })
})
