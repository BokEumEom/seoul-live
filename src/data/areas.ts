// `name`은 서울 열린데이터광장 실시간 인구 API를 호출할 때 쓰는 키(AREA_NM)와 동일해야 한다.
// 오타가 나면 해당 명소만 API 호출이 조용히 실패한다(에러 없이 빈 데이터로 보임).
// **2026-08-13 실호출로 30곳 전부 대조했다.** 이름은 30/30 일치했고, 손으로 적었던
// `code`는 25곳이 틀려서 응답의 AREA_CD로 고쳤다. code는 화면에서 React key로만
// 쓰여 버그로 드러나지 않았지만, mock.ts가 적어둔 「snapshot.code === entry.code
// 대조(2차 오타 탐지기)」가 그동안 작동할 수 없었다는 뜻이다.
// 대조법: `/api/citydata?area=<이름>` 응답의 AREA_NM·AREA_CD와 이 표를 맞춘다.
//
// **`nameEn`은 화면에 적는 이름일 뿐 `name`의 번역이 아니다.** 그래서 「관광특구」
// 같은 분류어는 뺐다 — 이름 아래 줄에 카테고리(`Tourist zones`)가 이미 있어
// 「Myeongdong Special Tourist Zone / Tourist zones」로 같은 말이 두 번 나오고,
// 그 길이 때문에 명소 상세 제목이 잘렸다(390px 실측에서 「Hongik Univ. Station (…」).
// 짧게 두는 것이 화면에도 맞고 실제로 부르는 이름에도 가깝다.
import type { AreaCatalogEntry } from '../domain/types.js'

export const AREA_CATALOG: readonly AreaCatalogEntry[] = [
  { code: 'POI014', name: '강남역', nameEn: 'Gangnam Station', lat: 37.498, lng: 127.0276, category: '인구밀집지역' },
  { code: 'POI055', name: '홍대입구역(2호선)', nameEn: 'Hongik Univ. Station', lat: 37.5571, lng: 126.9245, category: '인구밀집지역' },
  { code: 'POI003', name: '명동 관광특구', nameEn: 'Myeongdong', lat: 37.5636, lng: 126.9827, category: '관광특구' },
  { code: 'POI009', name: '광화문·덕수궁', nameEn: 'Gwanghwamun & Deoksugung', lat: 37.5709, lng: 126.9769, category: '고궁·문화유산', purposes: ['date'] },
  { code: 'POI105', name: '여의도한강공원', nameEn: 'Yeouido Hangang Park', lat: 37.5285, lng: 126.9327, category: '공원', purposes: ['kids', 'date'] },
  { code: 'POI095', name: '반포한강공원', nameEn: 'Banpo Hangang Park', lat: 37.51, lng: 126.9955, category: '공원', purposes: ['kids', 'date'] },
  { code: 'POI093', name: '뚝섬한강공원', nameEn: 'Ttukseom Hangang Park', lat: 37.53, lng: 127.07, category: '공원', purposes: ['kids', 'date'] },
  { code: 'POI068', name: '성수카페거리', nameEn: 'Seongsu Cafe Street', lat: 37.5445, lng: 127.0557, category: '발달상권', purposes: ['date'] },
  { code: 'POI066', name: '북촌한옥마을', nameEn: 'Bukchon Hanok Village', lat: 37.5826, lng: 126.983, category: '발달상권', purposes: ['date'] },
  { code: 'POI008', name: '경복궁', nameEn: 'Gyeongbokgung Palace', lat: 37.5796, lng: 126.977, category: '고궁·문화유산', purposes: ['date'] },
  { code: 'POI012', name: '창덕궁·종묘', nameEn: 'Changdeokgung & Jongmyo', lat: 37.5794, lng: 126.991, category: '고궁·문화유산', purposes: ['date'] },
  { code: 'POI083', name: 'DDP(동대문디자인플라자)', nameEn: 'DDP', lat: 37.5665, lng: 127.009, category: '발달상권' },
  { code: 'POI004', name: '이태원 관광특구', nameEn: 'Itaewon', lat: 37.5345, lng: 126.9946, category: '관광특구' },
  { code: 'POI005', name: '잠실 관광특구', nameEn: 'Jamsil', lat: 37.5133, lng: 127.1, category: '관광특구' },
  { code: 'POI101', name: '서울숲공원', nameEn: 'Seoul Forest Park', lat: 37.5444, lng: 127.0374, category: '공원', purposes: ['kids', 'date'] },
  { code: 'POI091', name: '남산공원', nameEn: 'Namsan Park', lat: 37.5512, lng: 126.9882, category: '공원', purposes: ['kids', 'date'] },
  { code: 'POI106', name: '월드컵공원', nameEn: 'World Cup Park', lat: 37.5716, lng: 126.8783, category: '공원', purposes: ['kids', 'date'] },
  { code: 'POI104', name: '어린이대공원', nameEn: "Children's Grand Park", lat: 37.5497, lng: 127.0817, category: '공원', purposes: ['kids', 'date'] },
  { code: 'POI110', name: '잠실한강공원', nameEn: 'Jamsil Hangang Park', lat: 37.518, lng: 127.082, category: '공원', purposes: ['kids', 'date'] },
  { code: 'POI111', name: '잠원한강공원', nameEn: 'Jamwon Hangang Park', lat: 37.5185, lng: 127.0107, category: '공원', purposes: ['kids', 'date'] },
  { code: 'POI059', name: '가로수길', nameEn: 'Garosu-gil', lat: 37.5203, lng: 127.023, category: '발달상권' },
  { code: 'POI073', name: '연남동', nameEn: 'Yeonnam-dong', lat: 37.5606, lng: 126.925, category: '발달상권', purposes: ['date'] },
  { code: 'POI078', name: '인사동', nameEn: 'Insa-dong', lat: 37.574, lng: 126.9856, category: '발달상권', purposes: ['date'] },
  { code: 'POI067', name: '서촌', nameEn: 'Seochon Village', lat: 37.5788, lng: 126.97, category: '발달상권', purposes: ['date'] },
  { code: 'POI071', name: '압구정로데오거리', nameEn: 'Apgujeong Rodeo Street', lat: 37.5273, lng: 127.04, category: '발달상권' },
  { code: 'POI080', name: '청담동 명품거리', nameEn: 'Cheongdam Luxury Street', lat: 37.525, lng: 127.049, category: '발달상권' },
  { code: 'POI074', name: '영등포 타임스퀘어', nameEn: 'Times Square', lat: 37.517, lng: 126.903, category: '발달상권' },
  { code: 'POI082', name: '해방촌·경리단길', nameEn: 'Haebangchon & Gyeongnidan-gil', lat: 37.54, lng: 126.988, category: '발달상권', purposes: ['date'] },
  { code: 'POI060', name: '광장(전통)시장', nameEn: 'Gwangjang Market', lat: 37.5701, lng: 126.9997, category: '발달상권' },
  { code: 'POI096', name: '북서울꿈의숲', nameEn: 'Dream Forest', lat: 37.6208, lng: 127.0417, category: '공원', purposes: ['kids', 'date'] },
]

export function findAreaByName(name: string): AreaCatalogEntry | undefined {
  return AREA_CATALOG.find((area) => area.name === name)
}

export const AREA_NAMES: readonly string[] = AREA_CATALOG.map((area) => area.name)
