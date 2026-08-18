import '@testing-library/jest-dom/vitest'
import { beforeEach } from 'vitest'

// **주소를 매 테스트마다 되돌린다.** 화면 상태가 주소에 실리면서
// (`domain/route.ts`) 명소를 여는 테스트가 `?area=강남역`을 남기는데, jsdom의
// `location`은 파일 하나 안에서 이어져 **그다음 테스트들이 전부 그 상세로
// 시작한다.** 실제로 이 줄을 넣기 전에 18개가 무더기로 깨졌고, 증상이
// 「엉뚱한 테스트가 엉뚱한 화면을 본다」라 원인을 찾기 어려웠다.
//
// 개별 파일이 아니라 여기 두는 이유는 새는 쪽이 **주소를 안 만지는 파일**이기
// 때문이다. 오염을 만든 파일이 아니라 당한 파일이 깨지므로, 규칙을 각자에게
// 맡기면 새 테스트를 쓸 때마다 같은 함정을 다시 밟는다.
beforeEach(() => {
  window.history.replaceState(null, '', '/')
})

// jsdom이 구현하지 않은 브라우저 API를 채운다.
//
// **컴포넌트 쪽에 `?.`를 다는 대신 여기서 채우는 것은 고른 것이다.** 실제
// 브라우저에는 이 둘이 전부 있으므로, 없는 경우를 대비한 분기를 제품 코드에
// 두면 그 분기는 어떤 테스트로도 죽일 수 없는 죽은 코드가 된다. 없는 것은
// 브라우저가 아니라 테스트 환경이니 테스트 환경에서 채운다.

// `prefers-reduced-motion`을 읽는 자리가 있다(`CityInfoChips`의 스크롤).
// 기본은 「줄여 달라고 하지 않았다」 — 실제 기기의 기본값과 같다. 반대 경우를
// 보려면 각 테스트에서 이 함수를 갈아 끼운다.
if (typeof window !== 'undefined' && window.matchMedia === undefined) {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }) as MediaQueryList
}

// jsdom에는 레이아웃이 없어 스크롤이라는 개념 자체가 없다. 호출됐다는 사실만
// 남기면 되므로 아무것도 하지 않는 함수로 둔다 — **어디로 스크롤됐는지는
// 여기서 검증할 수 없다.** 그건 헤드리스 크롬 실측의 몫이다.
if (typeof Element !== 'undefined' && Element.prototype.scrollIntoView === undefined) {
  Element.prototype.scrollIntoView = () => undefined
}
