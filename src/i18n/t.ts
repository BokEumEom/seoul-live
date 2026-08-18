import { EN } from './en'
import { DEFAULT_LANGUAGE, type Language } from './language'

// 화면에 보이는 한국어를 영어로 바꾼다.
//
// **키가 한국어 원문 자체다.** 「`detail.parking.title`」 같은 키를 새로 짓지
// 않는 이유가 둘이다. (1) 155개 문자열에 이름을 붙이는 일 자체가 크고, 그
// 이름들이 또 하나의 어휘가 되어 화면을 읽을 때마다 사전을 오가야 한다.
// (2) 기본값이 한국어라 **감싸기만 하면 기존 테스트 990여 개가 그대로 통과한다** —
// 옮기는 도중에도 화면이 한 번도 깨지지 않는다.
//
// 대가는 안다: 한국어 문구를 고치면 사전 키도 함께 고쳐야 하고, 안 고치면
// 그 자리가 조용히 한국어로 돌아간다. 그걸 `i18n.test.ts`의 완결성 검사가
// 잡는다 — `t()`에 넘긴 문자열 중 사전에 없는 것을 찾아 죽는다.
//
// **훅이 아니라 모듈 함수인 것이 핵심이다.** 훅이면 51개 파일마다 배선을
// 손으로 넣어야 하는데, 모듈 함수면 import 한 줄 + 문자열 감싸기라 기계로
// 옮길 수 있다. 언어가 바뀔 때 화면이 따라오는 것은 앱 루트가 구독해
// 트리 전체를 다시 그리는 방식으로 해결한다(`useLanguage`).

let current: Language = DEFAULT_LANGUAGE

/**
 * 화면 코드가 부르는 것. 렌더 중에 불려도 안전하다(순수 조회).
 *
 * **값이 낀 문구는 `{이름}` 자리를 쓴다.** 「`주차 45%`」를 통째로 키로 삼으면
 * 45가 바뀔 때마다 새 키가 되어 사전이 무한히 늘어난다. 자리를 파 두면 키가
 * 하나로 고정되고, **영어에서 어순이 달라져도 자리만 옮기면 된다** —
 * 「주차 {비율}%」 → 「{비율}% parking free」처럼.
 *
 *     t('주차 {비율}%', { 비율: 45 })
 */
export function t(
  korean: string,
  params?: Readonly<Record<string, string | number>>,
): string {
  // 사전에 없으면 한국어를 그대로 돌려준다. **빈 칸이나 키 이름을 보여주는
  // 것보다 낫다** — 뜻은 통하지 않아도 자리와 길이는 유지되어 화면이 안 깨진다.
  const template = current === 'ko' ? korean : (EN[korean] ?? korean)
  if (params === undefined) {
    return template
  }
  // 채우지 못한 자리는 **그대로 남긴다.** 빈 문자열로 지우면 「분」만 남은
  // 문장이 되어 뜻이 뒤집히고, 무엇이 빠졌는지도 알 수 없다.
  //
  // **`\w`를 쓰면 안 된다.** 자리 이름이 한국어인데(`{비율}`) JS의 `\w`는
  // 유니코드 플래그 없이는 `[A-Za-z0-9_]`라 한 글자도 안 잡는다 — 치환이
  // 통째로 조용히 안 일어난다. 실제로 그렇게 짰다가 테스트에서 잡혔다.
  return template.replace(/\{([^{}]+)\}/g, (whole, name: string) =>
    name in params ? String(params[name]) : whole,
  )
}

/** 스토어만 쓴다. 화면 코드는 `setLanguage`(languageStore)를 거친다. */
export function applyLanguage(next: Language): void {
  current = next
}

export function currentLanguage(): Language {
  return current
}
