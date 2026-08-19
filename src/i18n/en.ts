/**
 * 한국어 원문 → 영어. 키가 곧 화면에 적힌 한국어다(근거는 `t.ts`).
 *
 * **여기 없는 것과 못 넣는 것을 구분하라.** 아래 셋은 사전으로 풀 수 없다:
 *
 * 1. **서울 API가 주는 자유 문장** — `message`(「사람이 몰려있을 가능성이…」),
 *    도로소통 안내, 재난문자 본문. 한국어로만 오고 값의 종류도 모른다.
 * 2. **고유명사** — 주차장 이름, 따릉이 대여소 이름, 문화행사 이름, 지하철
 *    도착 문구(「9분 후 (동대입구)」). 응답에 실려 오는 그대로다.
 * 3. **명소 이름** — `areas.ts`의 카탈로그가 갖는다. 그건 API 호출 키이기도
 *    해서 사전이 아니라 카탈로그의 `nameEn` 필드가 답이다.
 *
 * 그래서 영어 화면에도 한국어가 남는다. 숨기지 않는다 — 우리가 가진 것을
 * 번역하는 것이 목표이지, 없는 것을 지어내는 것이 아니다.
 */
export const EN: Readonly<Record<string, string>> = {
  // ── 혼잡도 4단계. 서울 API가 주는 값이고 화면 전체가 이 넷으로 말한다 ──
  여유: 'Not crowded',
  보통: 'Moderate',
  '약간 붐빔': 'Busy',
  붐빔: 'Crowded',

  // 혼잡도 헤드라인. 4단계를 사람 말로 옮긴 것이라 단계와 따로 논다.
  '매우 원활': 'Very quiet',
  원활: 'Quiet',
  '다소 혼잡': 'Getting busy',
  '극심한 혼잡': 'Very crowded',

  // ── 명소 카테고리. 서울시 공식 5종이다 ──
  '고궁·문화유산': 'Palaces & heritage',
  '고궁·유적': 'Palaces & heritage',
  관광특구: 'Tourist zones',
  공원: 'Parks',
  발달상권: 'Shopping districts',
  '상권·거리': 'Shopping streets',
  '역·번화가': 'Stations & nightlife',
  인구밀집지역: 'Busy areas',

  // ── 필터 프리셋 ──
  전체: 'All',
  '내 장소': 'Saved',
  '아이와 나들이': 'With kids',
  데이트: 'Date spots',
  '지금 핫플': 'Trending now',
  카테고리: 'Category',
  필터: 'Filter',
  '필터 해제': 'Clear filter',
  정렬: 'Sort',
  거리순: 'Nearest',
  '여유한 순': 'Least crowded',
  '붐비는 순': 'Most crowded',

  // ── 지도·시트 조작 ──
  '명소 검색': 'Search places',
  '검색어 지우기': 'Clear search',
  '명소 목록': 'Place list',
  '내 주변': 'My location',
  '현재 위치': 'Current location',
  '즐겨찾기한 곳': 'Saved place',
  목록으로: 'Back to list',
  '살짝 열림': 'peek',
  절반: 'half',
  '시트 높이 조절, 현재 {단계}': 'Resize sheet, currently {단계}',

  // ── 상세: 액션 ──
  저장: 'Save',
  저장됨: 'Saved',
  공유하기: 'Share',
  // **목적지가 아니라 무슨 일이 일어나는지를 적는다.** 아이콘뿐인 버튼이라
  // 이 문장이 유일한 설명이고, 앱 밖으로 나간다는 사실이 빠지면 돌아올 수
  // 없다고 느낀다. 「사진」인 것은 우리가 여는 곳이 그 명소의 해시태그
  // 페이지이기 때문이다(`domain/socialLinks.ts`).
  '인스타그램에서 사진 보기': 'See photos on Instagram',
  카카오맵: 'KakaoMap',
  네이버: 'Naver',
  티맵: 'TMAP',
  '{명소} {동작}': '{명소} {동작}',
  '저장 해제': 'unsave',
  '{명소} 실시간 혼잡도 - 서울 라이브': '{명소} live crowd levels — Seoul Live',
  // 앱의 접근성 이름(`App.tsx`의 sr-only h1). 위 공유 문구가 이미 「Seoul
  // Live」로 나가므로 같은 이름이어야 한다.
  '서울 라이브': 'Seoul Live',
  '{시설} 지도에서 보기': 'Show {시설} on map',

  // ── 상세: 혼잡도 ──
  '지금 얼마나 붐비나': 'How crowded is it now',
  '마지막 업데이트: {시각}': 'Last updated {시각}',
  // **상세에서 가장 큰 글씨다.** 「지금 약」을 숫자와 따로 둔 이유는 굵기다 —
  // 샘플처럼 앞은 흐리고 숫자만 굵게 두려면 span이 갈려야 한다. 영어에서도
  // 앞뒤가 그대로 붙는다: 「Now about 40,000–42,000 people」.
  '지금 약': 'Now about',
  // **두 곳이 나눠 쓴다.** 위 큰 글씨(`PopulationLead`)와 혼잡예보 막대의
  // 소리 전용 줄(`ForecastChart`)이다. 같은 낱말로 같은 것을 세므로 키를
  // 가르지 않았다 — 막대 쪽은 앞에 시각과 혼잡도를 이미 읽어 준다.
  '{최소}~{최대}명': '{최소}–{최대} people',
  '{시}시엔 여유 예상 — 한산한 시간을 원하시면 조금만 기다려주세요.':
    'Expected to be quiet at {시}:00 — wait a little if you prefer fewer people.',
  '같은 요일·같은 시간대 관측 {횟수}번과 견줬어요.':
    'Compared with {횟수} observations at the same day and hour.',
  '이 수치는 실측이 아니라 대체값이에요.':
    'This is an estimate, not a live measurement.',
  '평소보다 붐벼요': 'Busier than usual',
  '평소보다 여유로워요': 'Quieter than usual',
  '평소와 비슷해요': 'About as usual',
  '아직 비교할 기록이 부족해요.': 'Not enough history to compare yet.',

  // ── 상세: 인구 구성 ──
  '지금 누가 있나': "Who's here now",
  '남 {남}% · 여 {여}%': '{남}% male · {여}% female',
  '비상주 {비율}%': '{비율}% visitors',
  '외지인이 많아요': 'Mostly visitors',
  '동네 생활권이에요': 'Mostly locals',
  '연령대 비율: {내용}': 'Age breakdown: {내용}',
  '0~9세': 'Under 10',
  '10대': '10s',
  '20대': '20s',
  '30대': '30s',
  '40대': '40s',
  '50대': '50s',
  '60대': '60s',
  '70대+': '70+',

  // ── 상세: 시간대별 인파 ──
  '시간대별 인파': 'Crowds by hour',
  '막대 = 예상 인원': 'bars = estimated people',
  지금: 'Now',
  '{시}시': '{시}:00',
  '예측 정보가 아직 없어요.': 'No forecast available yet.',
  '앞으로는 {시}시에 가장 붐빌 전망이에요 ({단계})': 'Busiest around {시}:00 ({단계})',

  // ── 상세: 요일×시간 패턴 ──
  '요일×시간 패턴': 'Weekly pattern',
  '요일과 시간대별 혼잡도. 관측하지 않은 칸은 「관측 없음」으로 읽힙니다.':
    'Crowd levels by day and hour. Cells with no data read as "No data".',
  '아직 모으는 중이에요. 이 명소를 열어볼 때마다 한 칸씩 채워져요.':
    'Still collecting. Each visit to this place fills one cell.',
  '이 기기에서 {횟수}번 본 것을 모았어요.':
    'Based on {횟수} visits from this device.',
  '관측 없음': 'No data',
  // 「월」 + 「요일」로 「월요일」이 된다. 영어는 붙일 것이 없어 자리만 남긴다.
  '{요일}요일 {시각} {단계}': '{요일} {시각} {단계}',
  월: 'Mon',
  화: 'Tue',
  수: 'Wed',
  목: 'Thu',
  금: 'Fri',
  토: 'Sat',
  일: 'Sun',

  // ── 상세: 도시 정보 ──
  도로소통: 'Traffic',
  '평균 {속도}km/h': '{속도} km/h avg',
  '기준 {시각}': 'as of {시각}',
  '{시각}까지 통제': 'closed until {시각}',
  // 한국어는 세는 것마다 단위가 다르고(곳·대·건) 영어는 같다. 키를 하나로
  // 합치면 한국어가 틀린 단위를 쓰게 되므로 값이 겹치더라도 나눠 둔다.
  '외 {개수}곳': '{개수} more',
  '외 {개수}대': '{개수} more',
  '외 {개수}건': '{개수} more',
  '최고 {높} · 최저 {낮}': 'High {높} · Low {낮}',
  // 도로소통 지수. **키에 「도로」가 붙어 있는 것이 핵심이다.**
  //
  // 예전에는 값(`원활`·`서행`·`정체`)을 그대로 키로 썼고 그래서 번역할 수
  // 없었다 — `원활`은 혼잡도 헤드라인이 이미 가진 낱말인데 **뜻이 다르다**
  // (장소가 한산하다 / 차가 잘 흐른다 → Quiet / Clear). 키가 한국어 원문이라
  // 이런 동음이의는 한 칸을 두고 다투고, 그 다툼에 져서 도로소통만 통째로
  // 빠져 있었다. 접두어를 붙여 칸을 갈랐다(`domain/cityInfoSummary.ts`).
  //
  // **명세에 값의 종류가 없어 이 셋이 전부인지는 모른다.** 모르는 값이 오면
  // `t()`가 키를 그대로 돌려주어 「도로 ○○」로 뜬다 — 영어 화면에 한국어가
  // 남지만 자리와 뜻은 유지된다.
  '도로 원활': 'Traffic clear',
  '도로 서행': 'Traffic slow',
  '도로 정체': 'Traffic jam',
  '지하철 도착': 'Subway arrivals',
  // 지하철 절의 조각들. **역 이름은 여기 없다** — 로마자 표기가 이 앱에 없는
  // 데이터라 지어내지 않는다(`i18n/subway.ts`). 그래서 영어에서도 「To 대화」·
  // 「in 9 min (동대입구)」처럼 역 이름만 한국어로 남는다.
  //
  // 도착 문구는 2026-08-13·08-18 실응답에서 **본 것만** 있다. 명세에 값 목록이
  // 없어 처음 보는 문구는 원문 그대로 나간다.
  '{번호}호선': 'Line {번호}',
  '{역}행': 'To {역}',
  '전역 출발': 'Left prev. station',
  '전역 도착': 'At prev. station',
  '{분}분 후': 'in {분} min',
  '{분}분 {초}초 후': 'in {분}m {초}s',
  '[{순번}]번째 전역': '{순번} stations away',
  주차장: 'Parking',
  따릉이: 'Ttareungi bikes',
  문화행사: 'Events',
  '{역} 도착 열차': 'Trains at {역}',
  // 세 절(지하철·주차장·따릉이)의 「이 값이 언제 기준인가」. 아래 「최대 3시간」
  // 세 줄은 **나이를 못 읽었을 때만** 쓰인다 — `CityInfoPanel`의 `freshnessNote`.
  //
  // 「받은」이 「측정된」이 아닌 것은 사실 관계다. `Age`는 우리가 서울 API에서
  // 받아온 뒤로 흐른 시간이라, 서울 쪽이 이미 묵혀서 준 몫은 안 들어간다.
  '방금 받은 값이에요': 'Just fetched',
  '{분}분 전 값이에요': 'Fetched {분} min ago',
  '{시간}시간 전 값이에요': 'Fetched {시간}h ago',
  '최대 3시간 전 기준이에요': 'As of up to 3 hours ago',
  '잔여 면수는 최대 3시간 전 기준이에요': 'Spaces free as of up to 3 hours ago',
  '거치 대수는 최대 3시간 전 기준이에요': 'Bike counts as of up to 3 hours ago',
  '주변에 주차장 정보가 없어요.': 'No parking information nearby.',
  '주변에 따릉이 대여소가 없어요.': 'No bike stations nearby.',

  // ── 주변 CCTV ──
  //
  // **「실시간」이 여기서만 글자 그대로다.** 다른 절은 최대 3시간 묵은 값을
  // 보여주지만 영상은 지금 화면이다 — 캐시되는 것은 카메라 목록이지 영상이
  // 아니다. 영어에서도 그 차이가 드러나게 「Live」를 쓴다.
  '주변 CCTV': 'Nearby cameras',
  // 「눌러야 나온다」를 알려주는 줄이다. 자동 재생을 안 하는 것이 의도라는
  // 사실을 여기서만 말할 수 있다 — 안 적으면 목록이 고장 난 것처럼 보인다.
  '누르면 지금 화면이 나와요': 'Tap to watch live',
  '영상 없음': 'No video',
  '{시설} 실시간 영상': 'Live camera at {시설}',
  '{시설} CCTV': '{시설} camera',
  '{시설} CCTV (영상 없음)': '{시설} camera (no video)',
  '영상을 불러오는 중이에요': 'Loading video…',
  // 원인을 단정하지 않는다(상류 점검·기기 네트워크·우리 프록시를 구분할 수 없다).
  '지금은 영상을 불러올 수 없어요': 'Video unavailable right now',
  '이 명소 주변에는 공개된 CCTV가 없어요.': 'No public cameras near this place.',
  '진행 중인 문화행사가 없어요.': 'No events running now.',
  '이 명소에는 지금 제공되는 도시 정보가 없어요.':
    'No city information available for this place right now.',
  '총 {면수}면': '{면수} spaces',
  '{면수}면': '{면수} free',
  만차: 'Full',
  '실시간 미제공': 'No live data',
  '정보 없음': 'No data',
  유료: 'Paid',
  무료: 'Free',
  '{대수}대': '{대수}',
  '거치대 {대수}대': '{대수} docks',
  '대여 불가': 'None available',
  미세먼지: 'PM10',
  초미세먼지: 'PM2.5',
  강수확률: 'Rain',
  // 통합대기환경등급. 서울 API가 주는 값이라 도메인에 한국어로 남는다.
  좋음: 'Good',
  나쁨: 'Bad',
  매우나쁨: 'Very bad',
  '통합대기 {등급}': 'Air quality {등급}',

  // ── 상세: 요약 칩 ──
  // 이 하나만 `summarizeCityInfo` 밖에서 만들어진다(CCTV는 다른 엔드포인트라
  // 도시정보 응답에 없다). 그래서 `i18n.test.ts`의 칩 라벨 검사가 못 잡는다 —
  // 지울 때 조심할 것.
  'CCTV {개수}': 'Cameras {개수}',
  '주차 {비율}%': '{비율}% parking free',
  '지하철 {개수}': 'Subway {개수}',
  '따릉이 {대수}대': '{대수} bikes',
  '행사 {개수}': 'Events {개수}',

  // ── 상세: 근처 ──
  '근처 쾌적한 장소': 'Quieter places nearby',
  '여기가 너무 붐비나요? 2km 안에서 한산한 곳이에요.':
    'Too crowded here? These are quieter, within 2km.',
  '· 도보 {분}분': '· {분} min walk',

  // ── 오늘의 서울 ──
  '오늘의 서울': "Seoul today",
  '지금 서울': 'Seoul now',
  '{시각} 업데이트됨': 'updated {시각}',
  '{전체}곳 중 {받음}곳만 정보가 왔어요.': 'Data for {받음} of {전체} places.',
  '재난문자 {건수}건': '{건수} emergency alerts',
  '지도에 안 보이는 전체 그림': 'The bigger picture',
  '지금 가장 붐비는 곳': 'Busiest right now',
  '지금 여유로운 곳': 'Quietest right now',
  '카테고리별 평균': 'Average by category',
  '가까우면서 여유로운 곳 추천': 'Close and quiet — recommended',
  '{개수}곳 중 붐빔 {붐빔}곳': '{붐빔} of {개수} places crowded',
  ', 오늘의 서울 열기': ', open Seoul today',
  '출처: 서울 열린데이터광장 실시간 도시데이터 · 5분마다 갱신':
    'Source: Seoul Open Data Plaza live city data · updated every 5 minutes',

  // ── 빈 상태·오류 ──
  '아직 담은 곳이 없어요. 명소를 열고 「저장」을 누르면 여기에 모여요.':
    'Nothing saved yet. Open a place and tap Save to collect it here.',
  '조건에 맞는 명소가 없어요.': 'No places match.',
  '「{조건}」에 해당하는 명소가 없어요.': 'No places match "{조건}".',
  '명소를 찾을 수 없어요.': 'Place not found.',
  '혼잡도 정보를 가져오지 못했어요.': "Couldn't load crowd levels.",
  '혼잡도 정보를 아직 받지 못했어요.': 'Crowd levels not received yet.',
  '도시 정보를 가져오지 못했어요.': "Couldn't load city information.",
  '다시 시도': 'Try again',
  '불러오는 중': 'Loading',

  // ── 위치 ──
  '위치를 허용하면 가까운 곳부터 볼 수 있어요.':
    'Allow location to see the closest places first.',
  허용하기: 'Allow',
  '위치를 확인할 수 없어 혼잡도 낮은 순으로 보여드려요.':
    "Can't get your location, so places are sorted by crowd level.",
  '위치 권한이 거부되었습니다': 'Location permission denied',
  '이 환경에는 위치 기능이 없습니다': 'Location is not available here',
  '위치를 확인하지 못했습니다: {원인}': "Couldn't get location: {원인}",

  // ── 지도를 못 쓸 때 ──
  'VITE_GOOGLE_MAPS_API_KEY가 설정되지 않아 지도를 표시할 수 없어요. 아래 목록과 검색은 그대로 쓸 수 있어요.':
    'The map needs VITE_GOOGLE_MAPS_API_KEY. The list and search below still work.',
  '지도를 불러오지 못했어요. 네트워크 상태를 확인해 주세요. 아래 목록과 검색은 그대로 쓸 수 있어요.':
    "Couldn't load the map. Check your connection. The list and search below still work.",
  '오프라인이에요. 연결되면 지도가 다시 나와요. 아래 목록과 검색은 그대로 쓸 수 있어요.':
    "You're offline. The map returns when you reconnect. The list and search below still work.",

  // ── 설정 ──
  '화면 테마': 'Appearance',
  밝게: 'Light',
  어둡게: 'Dark',
  '기기 설정': 'System',
  '어두운 화면으로 바꾸기': 'Switch to dark',
  '밝은 화면으로 바꾸기': 'Switch to light',
}
