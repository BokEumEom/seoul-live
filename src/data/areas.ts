// `name`은 서울 열린데이터광장 실시간 인구 API를 호출할 때 쓰는 키(AREA_NM)와 동일해야 한다.
// 오타가 나면 해당 명소만 API 호출이 조용히 실패한다(에러 없이 빈 데이터로 보임).
// 인증키 발급 후 공식 장소 목록과 반드시 대조 검증할 것 — 지금은 검증할 방법이 없다.
import type { AreaCatalogEntry } from '../domain/types'

export const AREA_CATALOG: readonly AreaCatalogEntry[] = [
  { code: 'POI014', name: '강남역', lat: 37.498, lng: 127.0276, category: '기타' },
  { code: 'POI054', name: '홍대입구역(2호선)', lat: 37.5571, lng: 126.9245, category: '기타' },
  { code: 'POI003', name: '명동 관광특구', lat: 37.5636, lng: 126.9827, category: '기타' },
  { code: 'POI009', name: '광화문·덕수궁', lat: 37.5709, lng: 126.9769, category: '문화재' },
  { code: 'POI101', name: '여의도한강공원', lat: 37.5285, lng: 126.9327, category: '공원' },
  { code: 'POI096', name: '반포한강공원', lat: 37.51, lng: 126.9955, category: '공원' },
  { code: 'POI094', name: '뚝섬한강공원', lat: 37.53, lng: 127.07, category: '공원' },
  { code: 'POI066', name: '성수카페거리', lat: 37.5445, lng: 127.0557, category: '카페' },
  { code: 'POI063', name: '북촌한옥마을', lat: 37.5826, lng: 126.983, category: '문화재' },
  { code: 'POI007', name: '경복궁', lat: 37.5796, lng: 126.977, category: '문화재' },
  { code: 'POI010', name: '창덕궁·종묘', lat: 37.5794, lng: 126.991, category: '문화재' },
  { code: 'POI080', name: 'DDP(동대문디자인플라자)', lat: 37.5665, lng: 127.009, category: '기타' },
  { code: 'POI004', name: '이태원 관광특구', lat: 37.5345, lng: 126.9946, category: '기타' },
  { code: 'POI005', name: '잠실 관광특구', lat: 37.5133, lng: 127.1, category: '기타' },
  { code: 'POI090', name: '서울숲공원', lat: 37.5444, lng: 127.0374, category: '공원' },
  { code: 'POI088', name: '남산공원', lat: 37.5512, lng: 126.9882, category: '공원' },
  { code: 'POI102', name: '월드컵공원', lat: 37.5716, lng: 126.8783, category: '공원' },
  { code: 'POI100', name: '어린이대공원', lat: 37.5497, lng: 127.0817, category: '공원' },
  { code: 'POI104', name: '잠실한강공원', lat: 37.518, lng: 127.082, category: '공원' },
  { code: 'POI105', name: '잠원한강공원', lat: 37.5185, lng: 127.0107, category: '공원' },
  { code: 'POI057', name: '가로수길', lat: 37.5203, lng: 127.023, category: '쇼핑몰' },
  { code: 'POI070', name: '연남동', lat: 37.5606, lng: 126.925, category: '카페' },
  { code: 'POI075', name: '인사동', lat: 37.574, lng: 126.9856, category: '문화재' },
  { code: 'POI065', name: '서촌', lat: 37.5788, lng: 126.97, category: '문화재' },
  { code: 'POI069', name: '압구정로데오거리', lat: 37.5273, lng: 127.04, category: '쇼핑몰' },
  { code: 'POI078', name: '청담동 명품거리', lat: 37.525, lng: 127.049, category: '쇼핑몰' },
  { code: 'POI073', name: '영등포 타임스퀘어', lat: 37.517, lng: 126.903, category: '쇼핑몰' },
  { code: 'POI079', name: '해방촌·경리단길', lat: 37.54, lng: 126.988, category: '카페' },
  { code: 'POI058', name: '광장(전통)시장', lat: 37.5701, lng: 126.9997, category: '기타' },
  { code: 'POI093', name: '북서울꿈의숲', lat: 37.6208, lng: 127.0417, category: '공원' },
]

export function findAreaByName(name: string): AreaCatalogEntry | undefined {
  return AREA_CATALOG.find((area) => area.name === name)
}

export const AREA_NAMES: readonly string[] = AREA_CATALOG.map((area) => area.name)
