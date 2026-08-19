import type { CctvCamera } from '../domain/cctv'
import { findAreaByName } from './areas'
import { hashAreaName, mixSeed } from './mock'

// CCTV 목업. **실데이터의 가장 중요한 성질을 흉내 내는 것이 목적이다** —
// 실측(2026-08-19)으로 30곳 중 **10곳은 CCTV가 아예 없었다.** 모든 명소에
// 카메라를 채워 주면 「없음」 화면을 목업만으로는 한 번도 볼 수 없다
// (mockCityInfo.ts가 주차장·문화행사에서 겪은 것과 같은 함정이다).
//
// 목업에는 실제로 재생할 수 있는 스트림이 없다. 그래서 화면의 「지금은 영상을
// 불러올 수 없어요」 경로가 목업 모드에서 늘 보이는데, **그게 맞는 동작이다** —
// 그 자리도 화면의 일부이고 목업으로 만져볼 수 있어야 한다.

const CCTV_SALT = 9

// 실응답의 이름을 본떴다(광화문·강남역·명동입구·63빌딩 등이 실제 CCTVNAME이다).
const CAMERA_NAMES = ['사거리', '역 앞', '광장', '진입로'] as const

function cameraCount(seed: number): number {
  // 0~3대. 0이 나오는 것이 이 함수의 존재 이유다 — 실데이터의 3분의 1이 0이다.
  return mixSeed(seed, CCTV_SALT * 10) % 4
}

export function buildMockCctv(areaName: string): readonly CctvCamera[] {
  const entry = findAreaByName(areaName)
  if (entry === undefined) {
    return []
  }

  const seed = hashAreaName(areaName)

  return Array.from({ length: cameraCount(seed) }, (_, index): CctvCamera => {
    const mixed = mixSeed(seed, CCTV_SALT * 10 + index + 1)
    // 명소 중심에서 조금씩 흩뿌린다. 지도에서 핀이 겹치지 않아야 「지도에서
    // 보기」가 무엇을 하는지 눈으로 확인된다.
    const offset = ((mixed % 200) - 100) / 20_000
    return {
      name: `${entry.name} ${CAMERA_NAMES[index % CAMERA_NAMES.length]}`,
      coords: { lat: entry.lat + offset, lng: entry.lng - offset },
      // 목업 전용 표식. 실제로 재생되지 않으며 https라 파서를 통과한다.
      streamUrl: `https://mock.invalid/cctv/${encodeURIComponent(areaName)}/${index}.m3u8`,
    }
  })
}
