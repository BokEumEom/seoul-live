import { Storage } from '@apps-in-toss/web-framework'

// 즐겨찾기는 기기에 남는다. PLAN.md가 "무료고 로그인도 없다"고 정해둔 이상
// 서버 저장은 익명 기기 ID 발급·보관을 부르고, api/는 상태를 갖지 않는 순수
// 중계기다. 기기를 바꾸면 즐겨찾기가 사라지는 것은 이 선택의 알려진 대가다.
//
// links.ts와 같은 폴백이다 — 토스 Storage 브리지를 먼저 쓰고, 브리지가 없는
// 환경(개발 서버·브라우저·테스트)에서만 localStorage로 떨어진다. 브리지 쪽은
// 앱이 종료돼도 값이 유지되지만 웹뷰의 localStorage는 그 보장이 없다.
//
// 저장 실패로 화면을 막지 않는다. 즐겨찾기는 부가 기능이고, 별이 안 눌리는
// 것보다 저장이 안 되는 편이 낫다.
export const STORAGE_KEY = 'seoul-live:favorites'

async function readRaw(): Promise<string | null> {
  try {
    // 브리지가 null을 주면 그게 답이다 — "저장된 것 없음"과 "브리지 없음"을
    // 뭉개면 앱에서 즐겨찾기를 비운 사용자가 옛 목록을 다시 보게 된다.
    return await Storage.getItem(STORAGE_KEY)
  } catch {
    // 브리지가 없다. 웹 표준으로 넘어간다.
  }
  return localStorage.getItem(STORAGE_KEY)
}

async function writeRaw(value: string): Promise<void> {
  try {
    await Storage.setItem(STORAGE_KEY, value)
    return
  } catch {
    // 브리지가 없다. 웹 표준으로 넘어간다.
  }
  localStorage.setItem(STORAGE_KEY, value)
}

function parse(raw: string | null): readonly string[] {
  if (raw === null) {
    return []
  }
  const parsed: unknown = JSON.parse(raw)
  if (!Array.isArray(parsed)) {
    return []
  }
  return parsed.filter((item): item is string => typeof item === 'string')
}

export async function loadFavorites(): Promise<readonly string[]> {
  try {
    return parse(await readRaw())
  } catch (error) {
    // "저장된 게 없음"과 "읽지 못함"은 다르다. 전자는 정상이고 후자는 남긴다.
    console.error('즐겨찾기를 읽지 못했습니다:', error)
    return []
  }
}

export async function saveFavorites(names: readonly string[]): Promise<void> {
  try {
    await writeRaw(JSON.stringify(names))
  } catch (error) {
    console.error('즐겨찾기를 저장하지 못했습니다:', error)
  }
}
