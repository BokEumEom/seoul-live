import { getAppsInTossGlobals } from '@apps-in-toss/web-framework'

// 서비스워커 경계. 앱인토스 브리지(`location.ts`)·Google Maps(`googleMaps.ts`)와
// 성질이 같다 — 있는 환경과 없는 환경이 갈리고, 그 갈림을 화면이 알면 안 된다.
//
// **핵심 규칙은 「토스 웹뷰에서는 등록하지 않는다」다.** `npm run build`가
// `vite build`를 한 번 돌고 그 `dist`를 `ait build`가 그대로 포장하므로,
// `sw.js`와 매니페스트는 미니앱 번들 안에도 들어간다. 파일이 들어가는 것은
// 몇 KB라 상관없지만 등록되면 곤란하다:
//
// - 서비스워커가 옛 자산을 붙들면 `ait deploy`로 새 판을 올려도 사용자는
//   낡은 화면을 본다. 미니앱에는 「캐시 지우기」로 가는 길이 없다.
// - 미니앱은 토스가 알아서 판올림하고 껍데기도 토스가 띄운다. 오프라인 셸도
//   설치 배너도 여기서는 얻을 것이 없다.
//
// 그래서 `vite.config.ts`가 `injectRegister: null`로 자동 주입을 끄고, 등록은
// 이 파일이 환경을 보고 한다.

/**
 * 지금 앱인토스 웹뷰 안인가.
 *
 * SDK에 「환경이 무엇인가」를 묻는 함수가 따로 없어서, 호스트가 주입하는 전역을
 * 읽는 함수가 성공하는지로 판별한다. **웹뷰 밖에서 무엇이 나오는지는 탐침으로
 * 확인했다** — `getAppsInTossGlobals()`가 `TypeError`를 던진다(전역 객체 자체가
 * 없어서 그 속성을 읽다가 난다). 잡을 예외 종류를 좁히지 않는 이유는 그 메시지가
 * SDK 내부 구현이라 판올림에 바뀔 수 있어서다 — 여기서 알아야 하는 것은
 * 「성공했는가」뿐이다.
 */
export function isInsideToss(): boolean {
  try {
    return getAppsInTossGlobals() !== undefined
  } catch {
    return false
  }
}

/**
 * 서비스워커를 등록한다. 토스 웹뷰 밖에서만, 그리고 실패해도 조용히.
 *
 * **실패를 삼키는 것은 고른 것이다.** 서비스워커는 덤이라 없으면 그냥 평범한
 * 웹앱이 된다. 이 함수는 첫 화면이 뜨는 경로에서 불리므로 여기서 예외가 밖으로
 * 나가면 앱이 통째로 안 뜬다 — 오프라인 캐시를 얻자고 화면을 잃을 수는 없다.
 * (`console.error`도 남기지 않는다. 사설 브라우징·비보안 컨텍스트처럼 정상적으로
 * 막히는 경로가 있어 소음만 된다.)
 */
export async function registerServiceWorker(): Promise<void> {
  if (isInsideToss()) {
    return
  }
  try {
    // 이름과 범위는 `vite-plugin-pwa`가 만드는 것과 같아야 한다. 플러그인이
    // 기본으로 `dist/sw.js`를 내고, 범위는 앱 전체다.
    await navigator.serviceWorker.register('/sw.js', { scope: '/' })
  } catch {
    // **`navigator.serviceWorker`가 아예 없는 경우도 여기로 온다.** 구형 웹뷰와
    // 비보안 컨텍스트(http)에는 그 속성이 없어 `.register`를 읽다가 TypeError가
    // 난다. 앞에 `=== undefined` 가드를 따로 뒀었는데 지웠다 — 이 catch와
    // **구별되는 결과가 없어서** 어떤 테스트로도 그 가지를 잡을 수 없었다
    // (변이로 확인했다: 가드를 지워도 아무도 안 죽는다). 잡을 수 없는 분기는
    // 다음 사람에게 「여기에 규칙이 하나 더 있다」는 거짓말만 남긴다.
    //
    // 위 주석의 이유로 조용히 삼킨다. 서비스워커는 덤이다.
  }
}
