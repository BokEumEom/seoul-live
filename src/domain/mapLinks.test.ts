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

  it('URL 예약 문자가 든 이름도 안전하게 인코딩한다', () => {
    // 카탈로그 30곳에는 이런 이름이 없다 — encodeURI로 바꿔도 30곳은 결과가
    // 같아서 안 잡힌다. 이 단언은 함수의 계약을 고정하는 쪽이다: 임의의
    // 문자열을 받으므로 121곳 확장이나 사용자 입력에서 `&`가 들어와도
    // 경로가 깨지지 않아야 한다.
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
