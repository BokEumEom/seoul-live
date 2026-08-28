// **이 파일은 `scripts/generate-areas.mjs`가 만든다. 손으로 고치지 마라.**
//
// 명소 121곳 전부다. `code`·`lat`·`lng`·`category`는 서울시가 준 값을 받아
// 적은 것이고(생성기 주석에 출처가 있다), `nameEn`과 `purposes`만 우리 것이다.
// 그 둘을 고치려면 생성기의 `NEW_NAMES_EN`이나 이 파일을 고친 뒤 다시 돌려라 —
// 생성기가 기존 파일에서 그 두 값을 그대로 옮겨 온다.
//
// `name`은 서울 API 호출 키(AREA_NM)와 **같아야 한다.** 틀리면 그 명소만 조용히
// 실패한다(에러 없이 빈 데이터). 2026-08-20에 121곳 전부를 서울시 응답과 대조해
// 121/121 일치를 확인했다 — 괄호 주변 공백까지 같다.
//
// **`nameEn`은 화면에 적는 이름일 뿐 `name`의 번역이 아니다.** 「관광특구」 같은
// 분류어는 뺐다 — 이름 아래 줄에 카테고리가 이미 있어 같은 말이 두 번 나오고,
// 그 길이 때문에 명소 상세 제목이 잘린다.
import type { AreaCatalogEntry } from '../domain/types.js'

export const AREA_CATALOG: readonly AreaCatalogEntry[] = [
  { code: 'POI001', name: '강남 MICE 관광특구', nameEn: 'Gangnam MICE', lat: 37.511, lng: 127.06007, category: '관광특구' },
  { code: 'POI002', name: '동대문 관광특구', nameEn: 'Dongdaemun', lat: 37.56731, lng: 127.011024, category: '관광특구' },
  { code: 'POI003', name: '명동 관광특구', nameEn: 'Myeongdong', lat: 37.564148, lng: 126.98185, category: '관광특구' },
  { code: 'POI004', name: '이태원 관광특구', nameEn: 'Itaewon', lat: 37.53444, lng: 126.99437, category: '관광특구' },
  { code: 'POI005', name: '잠실 관광특구', nameEn: 'Jamsil', lat: 37.51648, lng: 127.11527, category: '관광특구' },
  { code: 'POI006', name: '종로·청계 관광특구', nameEn: 'Jongno & Cheonggye', lat: 37.57, lng: 126.99737, category: '관광특구' },
  { code: 'POI007', name: '홍대 관광특구', nameEn: 'Hongdae', lat: 37.553917, lng: 126.92127, category: '관광특구' },
  { code: 'POI008', name: '경복궁', nameEn: 'Gyeongbokgung Palace', lat: 37.579876, lng: 126.97677, category: '고궁·문화유산', purposes: ['date'] },
  { code: 'POI009', name: '광화문·덕수궁', nameEn: 'Gwanghwamun & Deoksugung', lat: 37.57093, lng: 126.97719, category: '고궁·문화유산', purposes: ['date'] },
  { code: 'POI010', name: '보신각', nameEn: 'Bosingak Belfry', lat: 37.570583, lng: 126.98341, category: '고궁·문화유산' },
  { code: 'POI011', name: '서울 암사동 유적', nameEn: 'Amsa-dong Prehistoric Site', lat: 37.56063, lng: 127.13076, category: '고궁·문화유산' },
  { code: 'POI012', name: '창덕궁·종묘', nameEn: 'Changdeokgung & Jongmyo', lat: 37.578697, lng: 126.993355, category: '고궁·문화유산', purposes: ['date'] },
  { code: 'POI058', name: '가락시장', nameEn: 'Garak Market', lat: 37.49347, lng: 127.11189, category: '발달상권' },
  { code: 'POI059', name: '가로수길', nameEn: 'Garosu-gil', lat: 37.52139, lng: 127.023575, category: '발달상권' },
  { code: 'POI060', name: '광장(전통)시장', nameEn: 'Gwangjang Market', lat: 37.570004, lng: 126.9999, category: '발달상권' },
  { code: 'POI061', name: '김포공항', nameEn: 'Gimpo Airport', lat: 37.56227, lng: 126.8026, category: '발달상권' },
  { code: 'POI115', name: '남대문시장', nameEn: 'Namdaemun Market', lat: 37.559914, lng: 126.97852, category: '발달상권' },
  { code: 'POI063', name: '노량진', nameEn: 'Noryangjin', lat: 37.513893, lng: 126.94405, category: '발달상권' },
  { code: 'POI064', name: '덕수궁길·정동길', nameEn: 'Deoksugung-gil & Jeongdong-gil', lat: 37.56635, lng: 126.97179, category: '발달상권' },
  { code: 'POI114', name: '북창동 먹자골목', nameEn: 'Bukchang-dong Food Alley', lat: 37.562263, lng: 126.9785, category: '발달상권' },
  { code: 'POI066', name: '북촌한옥마을', nameEn: 'Bukchon Hanok Village', lat: 37.582237, lng: 126.984, category: '발달상권', purposes: ['date'] },
  { code: 'POI067', name: '서촌', nameEn: 'Seochon Village', lat: 37.580368, lng: 126.969574, category: '발달상권', purposes: ['date'] },
  { code: 'POI068', name: '성수카페거리', nameEn: 'Seongsu Cafe Street', lat: 37.542965, lng: 127.056595, category: '발달상권', purposes: ['date'] },
  { code: 'POI121', name: '송리단길·호수단길', nameEn: 'Songridan-gil & Hosudan-gil', lat: 37.50805, lng: 127.106316, category: '발달상권' },
  { code: 'POI122', name: '신촌 스타광장', nameEn: 'Sinchon Star Plaza', lat: 37.55651, lng: 126.93693, category: '발달상권' },
  { code: 'POI071', name: '압구정로데오거리', nameEn: 'Apgujeong Rodeo Street', lat: 37.525494, lng: 127.038734, category: '발달상권' },
  { code: 'POI072', name: '여의도', nameEn: 'Yeouido', lat: 37.52502, lng: 126.92553, category: '발달상권' },
  { code: 'POI073', name: '연남동', nameEn: 'Yeonnam-dong', lat: 37.56162, lng: 126.92234, category: '발달상권', purposes: ['date'] },
  { code: 'POI074', name: '영등포 타임스퀘어', nameEn: 'Times Square', lat: 37.516865, lng: 126.90615, category: '발달상권' },
  { code: 'POI076', name: '용리단길', nameEn: 'Yongridan-gil', lat: 37.531185, lng: 126.97129, category: '발달상권' },
  { code: 'POI077', name: '이태원 앤틱가구거리', nameEn: 'Itaewon Antique Furniture St.', lat: 37.53223, lng: 126.99392, category: '발달상권' },
  { code: 'POI116', name: '익선동', nameEn: 'Ikseon-dong', lat: 37.572662, lng: 126.98963, category: '발달상권' },
  { code: 'POI078', name: '인사동', nameEn: 'Insa-dong', lat: 37.573864, lng: 126.98606, category: '발달상권', purposes: ['date'] },
  { code: 'POI120', name: '잠실롯데타워·석촌호수', nameEn: 'Lotte Tower & Seokchon Lake', lat: 37.51156, lng: 127.10331, category: '발달상권' },
  { code: 'POI079', name: '창동 신경제 중심지', nameEn: 'Changdong New Economic Hub', lat: 37.656147, lng: 127.0547, category: '발달상권' },
  { code: 'POI080', name: '청담동 명품거리', nameEn: 'Cheongdam Luxury Street', lat: 37.525833, lng: 127.04376, category: '발달상권' },
  { code: 'POI081', name: '청량리 제기동 일대 전통시장', nameEn: 'Cheongnyangni & Jegi-dong Markets', lat: 37.58083, lng: 127.03998, category: '발달상권' },
  { code: 'POI082', name: '해방촌·경리단길', nameEn: 'Haebangchon & Gyeongnidan-gil', lat: 37.54237, lng: 126.98718, category: '발달상권', purposes: ['date'] },
  { code: 'POI083', name: 'DDP(동대문디자인플라자)', nameEn: 'DDP', lat: 37.56699, lng: 127.01029, category: '발달상권' },
  { code: 'POI084', name: 'DMC(디지털미디어시티)', nameEn: 'DMC', lat: 37.579277, lng: 126.89179, category: '발달상권' },
  { code: 'POI085', name: '강서한강공원', nameEn: 'Gangseo Hangang Park', lat: 37.586514, lng: 126.81855, category: '공원' },
  { code: 'POI086', name: '고척돔', nameEn: 'Gocheok Sky Dome', lat: 37.497673, lng: 126.86702, category: '공원' },
  { code: 'POI087', name: '광나루한강공원', nameEn: 'Gwangnaru Hangang Park', lat: 37.55399, lng: 127.12982, category: '공원' },
  { code: 'POI088', name: '광화문광장', nameEn: 'Gwanghwamun Square', lat: 37.57341, lng: 126.97692, category: '공원' },
  { code: 'POI089', name: '국립중앙박물관·용산가족공원', nameEn: "Nat'l Museum & Yongsan Family Park", lat: 37.522766, lng: 126.98143, category: '공원' },
  { code: 'POI090', name: '난지한강공원', nameEn: 'Nanji Hangang Park', lat: 37.5665, lng: 126.87733, category: '공원' },
  { code: 'POI091', name: '남산공원', nameEn: 'Namsan Park', lat: 37.55158, lng: 126.99376, category: '공원', purposes: ['kids', 'date'] },
  { code: 'POI092', name: '노들섬', nameEn: 'Nodeul Island', lat: 37.51756, lng: 126.958664, category: '공원' },
  { code: 'POI093', name: '뚝섬한강공원', nameEn: 'Ttukseom Hangang Park', lat: 37.529186, lng: 127.07152, category: '공원', purposes: ['kids', 'date'] },
  { code: 'POI094', name: '망원한강공원', nameEn: 'Mangwon Hangang Park', lat: 37.55328, lng: 126.89927, category: '공원' },
  { code: 'POI095', name: '반포한강공원', nameEn: 'Banpo Hangang Park', lat: 37.509827, lng: 126.994675, category: '공원', purposes: ['kids', 'date'] },
  { code: 'POI123', name: '보라매공원', nameEn: 'Boramae Park', lat: 37.49296, lng: 126.92006, category: '공원' },
  { code: 'POI096', name: '북서울꿈의숲', nameEn: 'Dream Forest', lat: 37.621853, lng: 127.041115, category: '공원', purposes: ['kids', 'date'] },
  { code: 'POI124', name: '서대문독립공원', nameEn: 'Seodaemun Independence Park', lat: 37.574093, lng: 126.956604, category: '공원' },
  { code: 'POI098', name: '서리풀공원·몽마르뜨공원', nameEn: 'Seoripul & Montmartre Parks', lat: 37.491585, lng: 127.002686, category: '공원' },
  { code: 'POI100', name: '서울대공원', nameEn: 'Seoul Grand Park', lat: 37.42901, lng: 127.01716, category: '공원' },
  { code: 'POI101', name: '서울숲공원', nameEn: 'Seoul Forest Park', lat: 37.542965, lng: 127.03765, category: '공원', purposes: ['kids', 'date'] },
  { code: 'POI129', name: '송현녹지광장', nameEn: 'Songhyeon Green Plaza', lat: 37.577858, lng: 126.98371, category: '공원' },
  { code: 'POI102', name: '아차산', nameEn: 'Achasan Mountain', lat: 37.56684, lng: 127.10281, category: '공원' },
  { code: 'POI125', name: '안양천', nameEn: 'Anyangcheon Stream', lat: 37.51867, lng: 126.8797, category: '공원' },
  { code: 'POI103', name: '양화한강공원', nameEn: 'Yanghwa Hangang Park', lat: 37.541306, lng: 126.898186, category: '공원' },
  { code: 'POI104', name: '어린이대공원', nameEn: "Children's Grand Park", lat: 37.54906, lng: 127.08136, category: '공원', purposes: ['kids', 'date'] },
  { code: 'POI105', name: '여의도한강공원', nameEn: 'Yeouido Hangang Park', lat: 37.528988, lng: 126.92822, category: '공원', purposes: ['kids', 'date'] },
  { code: 'POI126', name: '여의서로', nameEn: 'Yeouiseo-ro', lat: 37.5327, lng: 126.91458, category: '공원' },
  { code: 'POI127', name: '올림픽공원', nameEn: 'Olympic Park', lat: 37.51941, lng: 127.12241, category: '공원' },
  { code: 'POI106', name: '월드컵공원', nameEn: 'World Cup Park', lat: 37.570187, lng: 126.8842, category: '공원', purposes: ['kids', 'date'] },
  { code: 'POI107', name: '응봉산', nameEn: 'Eungbongsan Mountain', lat: 37.548214, lng: 127.030464, category: '공원' },
  { code: 'POI108', name: '이촌한강공원', nameEn: 'Ichon Hangang Park', lat: 37.5194, lng: 126.96665, category: '공원' },
  { code: 'POI109', name: '잠실종합운동장', nameEn: 'Jamsil Sports Complex', lat: 37.514523, lng: 127.07365, category: '공원' },
  { code: 'POI110', name: '잠실한강공원', nameEn: 'Jamsil Hangang Park', lat: 37.519234, lng: 127.0843, category: '공원', purposes: ['kids', 'date'] },
  { code: 'POI111', name: '잠원한강공원', nameEn: 'Jamwon Hangang Park', lat: 37.52381, lng: 127.014725, category: '공원', purposes: ['kids', 'date'] },
  { code: 'POI112', name: '청계산', nameEn: 'Cheonggyesan Mountain', lat: 37.44074, lng: 127.05002, category: '공원' },
  { code: 'POI128', name: '홍제폭포', nameEn: 'Hongje Waterfall', lat: 37.580788, lng: 126.93698, category: '공원' },
  { code: 'POI013', name: '가산디지털단지역', nameEn: 'Gasan Digital Complex Station', lat: 37.48089, lng: 126.880104, category: '인구밀집지역' },
  { code: 'POI014', name: '강남역', nameEn: 'Gangnam Station', lat: 37.498856, lng: 127.02814, category: '인구밀집지역' },
  { code: 'POI015', name: '건대입구역', nameEn: 'Konkuk Univ. Station', lat: 37.539967, lng: 127.0682, category: '인구밀집지역' },
  { code: 'POI016', name: '고덕역', nameEn: 'Godeok Station', lat: 37.553455, lng: 127.15487, category: '인구밀집지역' },
  { code: 'POI017', name: '고속터미널역', nameEn: 'Express Bus Terminal Station', lat: 37.504814, lng: 127.00585, category: '인구밀집지역' },
  { code: 'POI018', name: '교대역', nameEn: 'Gyodae Station', lat: 37.492203, lng: 127.01396, category: '인구밀집지역' },
  { code: 'POI019', name: '구로디지털단지역', nameEn: 'Guro Digital Complex Station', lat: 37.48388, lng: 126.89618, category: '인구밀집지역' },
  { code: 'POI020', name: '구로역', nameEn: 'Guro Station', lat: 37.50235, lng: 126.88212, category: '인구밀집지역' },
  { code: 'POI021', name: '군자역', nameEn: 'Gunja Station', lat: 37.556316, lng: 127.08019, category: '인구밀집지역' },
  { code: 'POI023', name: '대림역', nameEn: 'Daerim Station', lat: 37.49267, lng: 126.895546, category: '인구밀집지역' },
  { code: 'POI024', name: '동대문역', nameEn: 'Dongdaemun Station', lat: 37.57148, lng: 127.00965, category: '인구밀집지역' },
  { code: 'POI025', name: '뚝섬역', nameEn: 'Ttukseom Station', lat: 37.54829, lng: 127.046135, category: '인구밀집지역' },
  { code: 'POI026', name: '미아사거리역', nameEn: 'Miasageori Station', lat: 37.612194, lng: 127.03074, category: '인구밀집지역' },
  { code: 'POI027', name: '발산역', nameEn: 'Balsan Station', lat: 37.55915, lng: 126.83917, category: '인구밀집지역' },
  { code: 'POI029', name: '사당역', nameEn: 'Sadang Station', lat: 37.477932, lng: 126.98126, category: '인구밀집지역' },
  { code: 'POI030', name: '삼각지역', nameEn: 'Samgakji Station', lat: 37.53534, lng: 126.973885, category: '인구밀집지역' },
  { code: 'POI031', name: '서울대입구역', nameEn: "Seoul Nat'l Univ. Station", lat: 37.480614, lng: 126.953064, category: '인구밀집지역' },
  { code: 'POI032', name: '서울식물원·마곡나루역', nameEn: 'Seoul Botanic Park & Magongnaru', lat: 37.567596, lng: 126.83106, category: '인구밀집지역' },
  { code: 'POI033', name: '서울역', nameEn: 'Seoul Station', lat: 37.556595, lng: 126.97303, category: '인구밀집지역' },
  { code: 'POI034', name: '선릉역', nameEn: 'Seolleung Station', lat: 37.506054, lng: 127.049805, category: '인구밀집지역' },
  { code: 'POI035', name: '성신여대입구역', nameEn: "Sungshin Women's Univ. Station", lat: 37.592392, lng: 127.01687, category: '인구밀집지역' },
  { code: 'POI036', name: '수유역', nameEn: 'Suyu Station', lat: 37.64106, lng: 127.02572, category: '인구밀집지역' },
  { code: 'POI131', name: '숭례문', nameEn: 'Sungnyemun Gate', lat: 37.560486, lng: 126.97573, category: '인구밀집지역' },
  { code: 'POI130', name: '시의회 앞', nameEn: 'Seoul City Council', lat: 37.56707, lng: 126.97694, category: '인구밀집지역' },
  { code: 'POI037', name: '신논현역·논현역', nameEn: 'Sinnonhyeon & Nonhyeon Stations', lat: 37.50808, lng: 127.02341, category: '인구밀집지역' },
  { code: 'POI038', name: '신도림역', nameEn: 'Sindorim Station', lat: 37.509098, lng: 126.890205, category: '인구밀집지역' },
  { code: 'POI039', name: '신림역', nameEn: 'Sillim Station', lat: 37.484676, lng: 126.92934, category: '인구밀집지역' },
  { code: 'POI117', name: '신정네거리역', nameEn: 'Sinjeong Negeori Station', lat: 37.521305, lng: 126.85528, category: '인구밀집지역' },
  { code: 'POI040', name: '신촌·이대역', nameEn: 'Sinchon & Ewha Womans Univ.', lat: 37.557037, lng: 126.93897, category: '인구밀집지역' },
  { code: 'POI070', name: '쌍문역', nameEn: 'Ssangmun Station', lat: 37.647762, lng: 127.03309, category: '인구밀집지역' },
  { code: 'POI041', name: '양재역', nameEn: 'Yangjae Station', lat: 37.48534, lng: 127.03397, category: '인구밀집지역' },
  { code: 'POI042', name: '역삼역', nameEn: 'Yeoksam Station', lat: 37.500393, lng: 127.038185, category: '인구밀집지역' },
  { code: 'POI043', name: '연신내역', nameEn: 'Yeonsinnae Station', lat: 37.61866, lng: 126.92072, category: '인구밀집지역' },
  { code: 'POI044', name: '오목교역·목동운동장', nameEn: 'Omokgyo Station & Mokdong Stadium', lat: 37.528812, lng: 126.87664, category: '인구밀집지역' },
  { code: 'POI045', name: '왕십리역', nameEn: 'Wangsimni Station', lat: 37.562218, lng: 127.0389, category: '인구밀집지역' },
  { code: 'POI046', name: '용산역', nameEn: 'Yongsan Station', lat: 37.530254, lng: 126.96082, category: '인구밀집지역' },
  { code: 'POI047', name: '이태원역', nameEn: 'Itaewon Station', lat: 37.534187, lng: 126.99305, category: '인구밀집지역' },
  { code: 'POI118', name: '잠실새내역', nameEn: 'Jamsilsaenae Station', lat: 37.510414, lng: 127.08266, category: '인구밀집지역' },
  { code: 'POI119', name: '잠실역', nameEn: 'Jamsil Station', lat: 37.511997, lng: 127.100365, category: '인구밀집지역' },
  { code: 'POI048', name: '장지역', nameEn: 'Jangji Station', lat: 37.478752, lng: 127.123276, category: '인구밀집지역' },
  { code: 'POI049', name: '장한평역', nameEn: 'Janghanpyeong Station', lat: 37.561806, lng: 127.06479, category: '인구밀집지역' },
  { code: 'POI050', name: '천호역', nameEn: 'Cheonho Station', lat: 37.539238, lng: 127.125015, category: '인구밀집지역' },
  { code: 'POI051', name: '총신대입구(이수)역', nameEn: 'Chongshin Univ. (Isu) Station', lat: 37.486004, lng: 126.98104, category: '인구밀집지역' },
  { code: 'POI052', name: '충정로역', nameEn: 'Chungjeongno Station', lat: 37.559696, lng: 126.96369, category: '인구밀집지역' },
  { code: 'POI053', name: '합정역', nameEn: 'Hapjeong Station', lat: 37.549377, lng: 126.911736, category: '인구밀집지역' },
  { code: 'POI054', name: '혜화역', nameEn: 'Hyehwa Station', lat: 37.58248, lng: 127.00176, category: '인구밀집지역' },
  { code: 'POI055', name: '홍대입구역(2호선)', nameEn: 'Hongik Univ. Station', lat: 37.556763, lng: 126.923004, category: '인구밀집지역' },
  { code: 'POI056', name: '회기역', nameEn: 'Hoegi Station', lat: 37.59054, lng: 127.05616, category: '인구밀집지역' },
]

/**
 * 홈 화면이 재난문자를 받으려고 도시 정보를 조회하는 **한 곳.**
 *
 * **왜 한 곳인가.** 재난문자는 `citydata`에만 있고 그건 명소당 1회 호출이다.
 * 카탈로그 전체를 부르면 하루 한도(1,000)를 훌쩍 넘는다. 한 곳이면 1시간
 * 캐시에서 하루 24회이고, **그 24회는 이미 예산 안에 있다** — 도시정보 몫으로
 * 잡아 둔 「최악의 경우」에 이 명소가 포함되어 있어서 최악에는 총량이 안 는다.
 * 늘어나는 것은 「아무도 이 명소의 상세를 안 연 날」의 실제 호출뿐이다.
 *
 * **광화문·덕수궁인 이유**는 서울의 한가운데이고, 이 앱이 실호출로 응답을
 * 확인해 픽스처까지 떠 둔 유일한 명소이기 때문이다(`docs/fixtures/`).
 *
 * **한 곳으로 서울 전체를 덮는다고 단정하지 않는다.** `LIVE_DST_MESSAGE`가
 * 시 전역인지 자치구 단위인지 명세에 없고, 실응답에서 비어 있는 것만 봤다.
 * 그래서 화면은 「서울의 재난문자 전부」라고 말하지 않고 **받은 문구를 그대로**
 * 보여준다 — 재난문자 본문은 언제나 스스로 지역을 밝힌다(「[서울특별시] …」).
 * 상세를 연 명소가 있으면 그쪽 캐시도 함께 모은다(`useCityAlerts`).
 */
export const ALERT_SOURCE_AREA = '광화문·덕수궁'

export function findAreaByName(name: string): AreaCatalogEntry | undefined {
  return AREA_CATALOG.find((area) => area.name === name)
}

export const AREA_NAMES: readonly string[] = AREA_CATALOG.map((area) => area.name)
