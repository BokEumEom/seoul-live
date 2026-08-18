import { describe, expect, it } from 'vitest'

/**
 * 앱 셸이 화면 끝까지 가는가.
 *
 * **`index.html`을 직접 읽는다.** 이 파일은 번들러가 만지지 않는 정적 파일이라
 * 어떤 컴포넌트 테스트도 닿지 않는데, 여기 한 줄이 빠지면 앱 전체의 안전영역
 * 처리가 **조용히 아무 일도 안 한다.**
 *
 * 파일을 `node:fs`로 직접 읽지 않는다 — `src`는 브라우저용 tsconfig라
 * (`types: ["vite/client"]`) Node 타입이 없어 `tsc`가 막는다. 실행은 되고
 * 컴파일만 깨지는 자리라 눈치채기 어렵다. `vitest.config.ts`가 주입한다.
 *
 * **러너가 떠 있는 동안 `index.html`을 고치면 이 값은 낡은 채로 남는다**
 * (`__INDEX_CSS__`와 같은 성질이다). 메타를 만졌으면 러너를 다시 띄워라.
 */
declare const __INDEX_HTML__: string
const html = __INDEX_HTML__

/** viewport 메타의 `content` 값. 없으면 빈 문자열이다. */
function viewportContent(): string {
  return html.match(/<meta\s+name="viewport"\s+content="([^"]*)"/)?.[1] ?? ''
}

describe('viewport 메타', () => {
  // **이 한 줄이 없으면 `env(safe-area-inset-*)`가 전부 0이다** — 명세와
  // WebKit 문서가 그렇게 말한다. 그러면 `pt-safe`·`pb-safe`가 붙어 있어도 값이
  // 0이라 화면은 그대로고, 브라우저는 노치를 피해 뷰포트를 좁혀 잡는다 —
  // 지도가 화면 끝까지 안 가고 위아래에 배경색 띠가 남는다. **고쳤다고
  // 생각하면서 아무것도 안 바뀐 상태**가 되는 자리라 클래스만으로는 부족하다.
  //
  // **이 게이팅은 실측으로 확인하지 못했다.** 데스크톱 크롬의
  // `Emulation.setSafeAreaInsetsOverride`는 `viewport-fit`과 **무관하게**
  // 값을 준다 — 이 줄을 빼고 헤드리스로 재 봤더니 `padding-top`이 그대로
  // 59px이었다. 즉 실측은 「값이 0이 아닐 때 배치가 옳은가」까지만 증명하고,
  // 「이 줄이 없으면 0이 된다」는 **실기기(iOS Safari)에서만 확인된다.**
  // 그래서 이 테스트가 남는다 — 실측이 못 지키는 자리를 대신 지킨다.
  it('viewport-fit=cover가 있다', () => {
    expect(viewportContent()).toContain('viewport-fit=cover')
  })

  it('기존 값도 그대로 둔다', () => {
    expect(viewportContent()).toContain('width=device-width')
    expect(viewportContent()).toContain('initial-scale=1')
  })
})
