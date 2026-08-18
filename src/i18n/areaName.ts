import { findAreaByName } from '../data/areas'
import type { AreaCatalogEntry } from '../domain/types'
import { currentLanguage } from './t'

// 명소 이름은 **사전(`en.ts`)이 아니라 카탈로그**가 갖는다. 이유가 셋이다.
//
// (1) 이름·좌표·코드·분류가 한 줄에 있어야 121곳으로 늘릴 때 한 곳만 본다.
// (2) 사전 완결성 검사는 `t()`에 **리터럴로 적은** 문자열을 세는데, 명소
//     이름은 언제나 변수로 들어온다(`t(entry.name)`). 사전에 넣으면 「안 쓰는
//     항목」으로 잡혀 검사와 싸우게 된다.
// (3) 타입이 필수라(`AreaCatalogEntry.nameEn`) 빠뜨리면 컴파일이 막힌다.
//     사전은 그 보증을 못 준다.
//
// **`t()`를 쓰지 않는 것이 핵심이다.** 여기서 하는 일은 번역이 아니라 **두
// 필드 중 하나를 고르는 것**이다.

/** 화면에 적을 이름. 호출 키(`entry.name`)와 헷갈리지 마라. */
export function areaDisplayName(entry: AreaCatalogEntry): string {
  return currentLanguage() === 'en' ? entry.nameEn : entry.name
}

/**
 * 카탈로그 항목 없이 이름만 들고 있는 자리를 위한 것(마커·스냅샷).
 *
 * 모르는 이름은 **받은 그대로 돌려준다.** 서울 API가 카탈로그에 없는 이름을
 * 주는 날(121곳 확장·이름 변경) 빈 칸을 보여주느니 한국어가 낫다.
 */
export function areaDisplayNameOf(name: string): string {
  const entry = findAreaByName(name)
  return entry === undefined ? name : areaDisplayName(entry)
}
