import { describe, expect, it } from 'vitest'
import { AREA_NAMES } from '../data/areas'
import { instagramTag, instagramTagUrl } from './socialLinks'

// 해시태그로 못 쓰는 글자. 하나라도 남으면 인스타그램이 태그를 못 찾는다.
const NOT_TAGGABLE = /[^0-9A-Za-z가-힣ㄱ-ㅎㅏ-ㅣ_]/

describe('instagramTag', () => {
  // 괄호를 여는 자리에서 잘라 버리면 `광장(전통)시장`이 `광장`이 된다 —
  // 광장시장과 광장은 다른 곳이다. 남는 쪽도 이름의 일부다.
  it('괄호 안만 지우고 앞뒤를 잇는다', () => {
    expect(instagramTag('광장(전통)시장')).toBe('광장시장')
    expect(instagramTag('홍대입구역(2호선)')).toBe('홍대입구역')
    expect(instagramTag('DDP(동대문디자인플라자)')).toBe('DDP')
  })

  // 가운뎃점은 두 이름을 잇는 기호다. 지우기만 하면 `광화문덕수궁`이라는
  // 아무도 안 쓰는 태그가 된다.
  it('가운뎃점 앞의 이름만 쓴다', () => {
    expect(instagramTag('광화문·덕수궁')).toBe('광화문')
    expect(instagramTag('창덕궁·종묘')).toBe('창덕궁')
    expect(instagramTag('해방촌·경리단길')).toBe('해방촌')
  })

  // 「관광특구」는 서울시의 행정 지정 명칭이지 사람들이 사진에 다는 말이
  // 아니다. 공백만 지우면 `#명동관광특구`가 되는데 `#명동`과 규모가 몇
  // 자릿수 다르다.
  it('「관광특구」 꼬리를 뗀다', () => {
    expect(instagramTag('명동 관광특구')).toBe('명동')
    expect(instagramTag('이태원 관광특구')).toBe('이태원')
    expect(instagramTag('잠실 관광특구')).toBe('잠실')
  })

  // 이름 안에 든 공백은 그냥 붙인다 — 여기서 자르면 `영등포`만 남아 다른
  // 곳이 된다.
  it('이름 사이의 공백은 붙여 쓴다', () => {
    expect(instagramTag('영등포 타임스퀘어')).toBe('영등포타임스퀘어')
    expect(instagramTag('청담동 명품거리')).toBe('청담동명품거리')
  })

  it('남는 글자가 없으면 빈 문자열이다', () => {
    expect(instagramTag('(전부 괄호)')).toBe('')
    expect(instagramTag('   ')).toBe('')
  })

  /**
   * **카탈로그 30곳 전부를 실제로 통과시킨다.** 규칙을 손으로 고칠 때 한 곳만
   * 깨지는 것이 이 함수의 유일한 고장 모양이라, 예시 몇 개로는 못 잡는다.
   */
  it('카탈로그의 모든 명소가 쓸 수 있는 태그를 낸다', () => {
    const broken = AREA_NAMES.filter((name) => {
      const tag = instagramTag(name)
      return tag === '' || NOT_TAGGABLE.test(tag)
    })

    expect(broken).toEqual([])
  })
})

describe('instagramTagUrl', () => {
  // **`/explore/search/`가 아니다.** 검색 주소는 로그인 화면으로 튕기고
  // (2026-08-19 실측: 302 → `/accounts/login/`), 태그 주소는 로그인 없이도
  // 200으로 열린다. 미니앱 밖으로 나가는 링크라 받는 쪽 상태를 우리가 못 정한다.
  it('로그인 없이 열리는 태그 주소를 만든다', () => {
    expect(instagramTagUrl('경복궁')).toBe(
      'https://www.instagram.com/explore/tags/%EA%B2%BD%EB%B3%B5%EA%B6%81/',
    )
  })

  // 부르는 쪽이 버튼을 안 그리는 신호다. 깨진 링크를 다는 것보다 낫다.
  it('태그를 못 만들면 빈 문자열이다', () => {
    expect(instagramTagUrl('(전부 괄호)')).toBe('')
  })
})
