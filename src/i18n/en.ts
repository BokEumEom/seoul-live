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

  // 상세 히어로의 한 문장. 4단계를 **말 거는 어조로** 옮긴 것이라 단계 배지와
  // 따로 논다. 예전에는 교통정보 어조였는데(매우 원활/원활/다소 혼잡/극심한
  // 혼잡) 같은 화면의 도로소통 값과 낱말이 겹쳤다 — 근거는 `congestion.ts`.
  '지금은 여유로워요': "It's quiet right now",
  '지금은 보통이에요': "It's about average right now",
  '지금은 약간 붐벼요': "It's a little busy right now",
  '지금은 붐벼요': "It's crowded right now",

  // 도로소통 값의 **접두어 없는** 키. 요약 카드가 쓴다 — 카드에는 「도로」라는
  // 이름표가 이미 있어 접두어를 붙이면 「도로 / 도로 원활」이 된다.
  원활: 'Clear',
  서행: 'Slow',
  정체: 'Jammed',

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
  //
  // 혼잡도 칩 넷의 이름은 위 「혼잡도 4단계」를 그대로 쓴다 — 칩·배지·마커가
  // 한 낱말이어야 사용자가 둘을 다른 것으로 읽지 않는다.
  //
  // (「한적」이 여기 있었다. 여유+보통을 묶어 부르던 이름인데, 칩이 네 등급으로
  // 갈리면서 부를 것이 없어졌다. 「정렬·거리순·여유한 순·붐비는 순」도 함께
  // 없어졌다 — 정렬 줄이 통째로 빠졌고 근거는 `useNearbyAreas`에 있다.)
  전체: 'All',
  '내 장소': 'Saved',
  '내 장소 {개수}': 'Saved {개수}',
  '내 장소 {개수} 보는 중': 'Showing saved {개수}',
  '아이와 나들이': 'With kids',
  데이트: 'Date spots',
  카테고리: 'Category',
  필터: 'Filter',
  '필터 해제': 'Clear filter',

  // ── 지도·시트 조작 ──
  '명소 검색': 'Search places',
  '검색어 지우기': 'Clear search',
  '명소 목록': 'Place list',
  '내 주변': 'My location',
  '현재 위치': 'Current location',
  '즐겨찾기한 곳': 'Saved place',
  뒤로: 'Back',
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

  // ── 지도 FAB ──
  //
  // 「내 주변」은 아래 「지도·시트 조작」 절에 있다.
  '지도 조작': 'Map controls',
  '앱 공유하기': 'Share this app',
  '서울 라이브 - 서울 명소 실시간 혼잡도':
    'Seoul Live — live crowd levels for places around Seoul',


  // ── 상세: 혼잡도 ──
  '지금 얼마나 붐비나': 'How crowded is it now',
  '{시각} 기준': 'As of {시각}',
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
  // 시안 `_3`의 세 카드 제목. 「거주 비율」은 시안에 없는 넷째 값이지만
  // (`RESNT_PPLTN_RATE`) 같은 막대로 그리므로 같은 어투로 적는다.
  '성별 비율': 'By gender',
  '연령대별 비율': 'By age',
  '거주 비율': 'Residents vs visitors',
  // `남성`·`여성`은 상권 카드 쪽에 이미 있다 — 사전 키가 한국어 원문이라 한
  // 항목이 두 자리를 함께 맡는다(`병원`과 같은 처리).
  상주: 'Residents',
  비상주: 'Visitors',
  '외지인이 많아요': 'Mostly visitors',
  '동네 생활권이에요': 'Mostly locals',
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
  // 위와 다른 상태다 — 저쪽은 기다리면 오고 이쪽은 안 온다(`FCST_YN`).
  '이 명소는 인구 예측을 제공하지 않아요.': 'No crowd forecast is offered for this place.',
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
  // 구간별 속도. 위의 「평균」과 다른 자리다 — 저쪽은 명소 주변 전체이고
  // 이쪽은 한 구간이다. 같은 키로 묶으면 「평균」이 구간마다 붙는다.
  '{속도}km/h': '{속도} km/h',
  // 시안 `_4`의 절 제목. 「주요」는 우리가 고른다는 뜻이 아니라 서울이 준
  // 구간 중 막히는 것부터 보여준다는 뜻이다(`sortRoadSegments`).
  '주요 도로 상황': 'Roads nearby',
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
  // 지하철 방향(`SUB_DIR`). **역 이름이 아니라 갈래 이름이라 옮긴다** — 로마자
  // 표기를 지어내는 일과 다르다.
  //
  // **화면에는 거의 안 나온다.** 파서가 `SUB_DIR`을 안 읽고 `SUB_TERMINAL`로
  // 「대화행」을 만들기 때문이다. 이 둘은 종착역도 노선명도 비어 올 때를 위한
  // 방어이고, 근거는 `i18n/subway.ts`의 `NOT_A_DESTINATION`에 있다.
  상행: 'Upbound',
  하행: 'Downbound',
  '전역 출발': 'Left prev. station',
  '전역 도착': 'At prev. station',
  '{분}분 후': 'in {분} min',
  '{분}분 {초}초 후': 'in {분}m {초}s',
  '[{순번}]번째 전역': '{순번} stations away',
  주차장: 'Parking',
  따릉이: 'Ttareungi bikes',
  문화행사: 'Events',
  '{역} 도착 열차': 'Trains at {역}',
  // ── 승하차 인원·버스정류소(2026-08-25) ──
  // `LIVE_SUB_PPLTN`·`LIVE_BUS_PPLTN`·`BUS_STN_STTS`. 같은 `citydata` 응답
  // 안이라 추가 호출이 0이다.
  '버스 정류소': 'Bus stops',
  // **정류소 번호는 기둥에 붙어 있는 그 번호다.** 영어에서도 숫자가 본체라
  // 「Stop 1009」로 앞에 이름표를 붙인다 — 「1009번」의 「번」이 사라지면
  // 그냥 떠 있는 숫자가 된다.
  '{번호}번': 'Stop {번호}',
  '승차 {인원}명': '{인원} boarding',
  '하차 {인원}명': '{인원} alighting',
  '최근 10분': 'Last 10 min',
  '오늘 첫차 이후': 'Since first train',
  '이 명소 안 {개수}곳 기준': 'across {개수} stops here',
  '사람이 모이는 중이에요': 'People are arriving',
  '사람이 빠지는 중이에요': 'People are leaving',

  // ── 상세: 전기차 충전(2026-08-25) ──
  // `CHARGER_STTS`. 시안에 화면이 없어 「주변」 탭의 셋째 절로 넣었다.
  '전기차 충전': 'EV charging',
  '충전기 상태는 최대 3시간 전 기준이에요': 'Charger status can be up to 3 hours old',
  '{대수}대 가능': '{대수} free',
  // 「0대」가 아니라 「사용 불가」다 — 0은 「충전기가 없다」로도 읽힌다.
  '사용 불가': 'None free',
  '이용 제한 있음': 'Restricted access',
  급속: 'Fast',
  완속: 'Slow',
  '{종류} {출력}kW': '{종류} {출력}kW',
  // 충전 방식. **복합값(`DC차데모+AC3상+DC콤보`)은 조각으로 갈라 감싼다** —
  // 통째로 옮기면 조합마다 사전 항목이 필요하다.
  AC완속: 'AC slow',
  DC콤보: 'DC combo',
  DC차데모: 'CHAdeMO',
  AC3상: 'AC 3-phase',
  단독: 'Single',
  동시: 'Simultaneous',
  // 충전기 상태 여섯. 실호출 1,725대 표본에서 이 여섯만 봤다.
  사용가능: 'Available',
  충전중: 'In use',
  상태미확인: 'Unknown',
  통신이상: 'Offline',
  점검중: 'Under repair',
  운영중지: 'Out of service',
  // 시설 종류 스물여섯. 같은 표본에서 나온 것이 전부다 — 명세에 목록이 없어
  // 단언할 수 없고, 없는 값은 `t()`가 키를 그대로 돌려준다.
  '사업장(사옥)': 'Office building',
  아파트: 'Apartment',
  기타: 'Other',
  오피스텔: 'Officetel',
  백화점: 'Department store',
  일반주차장: 'Parking lot',
  '마트(쇼핑몰)': 'Mart / mall',
  공공기관: 'Public agency',
  공영주차장: 'Public parking',
  관광지: 'Tourist site',
  금융기관: 'Bank',
  숙박시설: 'Hotel',
  종교시설: 'Religious site',
  관공서: 'Government office',
  빌라: 'Low-rise flat',
  주유소: 'Gas station',
  박물관: 'Museum',
  카페: 'Café',
  영화관: 'Cinema',
  공연장: 'Concert hall',
  음식점: 'Restaurant',
  학교: 'School',
  주민센터: 'Community centre',
  지자체시설: 'Municipal facility',

  // ── 상세: 상권 탭(2026-08-25) ──
  // `LIVE_CMRCL_STTS`. 시안 `_8`이 배정한 여덟째 탭이고, 같은 `citydata`
  // 응답 안이라 추가 호출이 0이다.
  '이 명소에는 상권 정보가 없어요.': 'No commerce data for this place.',
  '지금 이 동네 상권은 {정도}편이에요': 'Commerce here is {정도} right now',
  '결제 {건수}건': '{건수} payments',
  // 금액 단위. 도메인이 숫자와 눈금만 주고 글자는 화면이 짓는다.
  //
  // **억·만을 영어로 옮기지 않는다.** 「4.5억」을 「450 million」으로 적으면
  // 자릿수가 달라져 옆의 한국어 화면과 대조가 안 되고, 「0.45B」는 원화
  // 감각이 없는 사람에게도 없는 사람에게도 안 읽힌다. 원 기호로 크기를 준다.
  '{금액}억': '₩{금액}00M',
  '{금액}만': '₩{금액}0K',
  '{금액}원': '₩{금액}',
  업종별: 'By category',
  '가맹점 {개수}곳': '{개수} stores',
  '외 {개수}종': '{개수} more',
  '누가 쓰고 있나': 'Who is spending',
  '연령대별 소비 비율': 'Spending by age',
  '성별 소비 비율': 'Spending by gender',
  '개인·법인 소비 비율': 'Personal vs corporate spending',
  남성: 'Male',
  여성: 'Female',
  개인: 'Personal',
  법인: 'Corporate',
  // 소비 연령 여섯 칸. **인구 구성의 여덟 칸과 다르다** — 양끝이 묶여 있다.
  '10대 이하': 'Under 20',
  '60대 이상': '60+',
  // 상권 지표 네 단계. 실호출 7곳에서 이 넷만 봤다(2026-08-25).
  // `보통`은 대기등급 쪽 키를 함께 쓴다.
  한산한: 'Quiet',
  분주한: 'Bustling',
  바쁜: 'Busy',
  // 업종 대분류 5종·중분류 11종. 명소 8곳 69줄 표본에서 본 것이 전부다 —
  // 명세에 목록이 없어 **이것이 전부라고 단언할 수 없다.** 없는 값은 `t()`가
  // 키를 그대로 돌려주어 한국어로 남고, 죽지는 않는다.
  '음식·음료': 'Food & drink',
  유통: 'Retail',
  '패션·뷰티': 'Fashion & beauty',
  의료: 'Healthcare',
  '여가·오락': 'Leisure',
  한식: 'Korean',
  '제과/커피/패스트푸드': 'Cafés & bakeries',
  '일식/중식/양식': 'Japanese/Chinese/Western',
  기타요식: 'Other dining',
  편의점: 'Convenience stores',
  '할인점/슈퍼마켓': 'Supermarkets',
  '의복/의류': 'Clothing',
  '패션/잡화': 'Accessories',
  // **`공원`·`병원`은 다른 절과 키를 나눠 쓴다.** 사전 키가 한국어 원문이라
  // 같은 낱말은 한 칸을 두고 다투는데, 이 둘은 뜻이 같아서 가를 이유가 없다 —
  // 상권 중분류(결제가 일어나는 병원)와 충전소 시설 종류(건물로서의 병원),
  // 명소 카테고리의 `공원`과 충전소의 `공원`이 그렇다.
  병원: 'Hospital',
  약국: 'Pharmacies',
  '스포츠/문화/레저': 'Sports & culture',
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
  // (지도 CCTV 마커의 이름표 둘이 여기 있었다. 상세가 전체 화면이 되면서 그
  // 층은 그려지는 동안 언제나 덮여 있어 지웠다 — 근거는 `HomeScreen`의 주석.)
  '영상을 불러오는 중이에요': 'Loading video…',
  // 원인을 단정하지 않는다(상류 점검·기기 네트워크·우리 프록시를 구분할 수 없다).
  '지금은 영상을 불러올 수 없어요': 'Video unavailable right now',
  '이 명소 주변에는 공개된 CCTV가 없어요.': 'No public cameras near this place.',
  '진행 중인 문화행사가 없어요.': 'No events running now.',
  // 상세가 탭으로 갈리면서 「없어요」도 탭마다 갈렸다. 예전에는 도시 정보
  // 전체를 한 문장으로 덮었는데, 탭을 눌러 들어온 사용자에게는 **그 탭에**
  // 무엇이 없는지가 답이다.
  '이 명소에는 지금 제공되는 교통 정보가 없어요.':
    'No traffic information for this place right now.',
  '이 명소에는 지금 제공되는 날씨 정보가 없어요.':
    'No weather information for this place right now.',
  '주변 주차장·따릉이 정보가 없어요.': 'No parking or bike docks nearby.',
  '지금 이 근처에 전해진 사고·재난 소식이 없어요.':
    'No incidents or alerts reported nearby.',
  '사고·통제': 'Incidents & closures',
  // 재난문자의 재해구분명(`DST_SE_NM`)·긴급단계명(`EMRG_STEP_NM`)과 사고통제의
  // 사고발생유형(`ACDNT_TYPE`)·세부유형(`ACDNT_DTYPE`).
  //
  // **자유 문장이 아니라 갈래 이름이라 옮긴다.** 같은 상자의 `MSG_CN`·
  // `ACDNT_INFO`는 사람이 쓴 문장이라 못 옮기는데, 한 상자에 있다는 이유로
  // 이쪽까지 한국어로 남아 있었다(2026-08-21 사용자 지적).
  //
  // **명세에 값 목록이 없다** — `docs/citydata-spec-raw.tsv`의 134·135·242·243행이
  // 이름만 주고 값의 종류는 비어 있다. 도로소통 지수와 같은 자리다: 여기 없는
  // 값이 오면 `t()`가 키를 그대로 돌려주어 한국어로 남고, **죽지는 않는다.**
  // 새 값을 보거든 여기와 `i18n.test.ts`의 목록에 함께 더하라.
  //
  // 근거: `공사`·`도로보수`는 실호출 응답(`docs/fixtures/citydata-광화문덕수궁.json`),
  // `호우`·`주의보`·`교통사고`·`차대차`는 `src/data/mockCityInfo.ts`가 그리는 값이다.
  // `경보`는 `주의보`의 짝이라 함께 넣는다 — 특보가 올라갈 때 그 자리만 한국어로
  // 남으면 하필 가장 급한 순간에 안 읽힌다.
  호우: 'Heavy rain',
  주의보: 'Advisory',
  경보: 'Warning',
  교통사고: 'Traffic accident',
  차대차: 'Vehicle collision',
  공사: 'Roadworks',
  도로보수: 'Road repair',
  // 2026-08-25 실호출에서 새로 본 짝. `ACDNT_ENG_TYPE`이 각각 `Rally/Event`·
  // `Event`로 왔지만 **API 번역을 그대로 쓰지 않는다** — 근거는 `domain/accident.ts`.
  집회및행사: 'Rally or event',
  // **`행사`는 여기 없다 — 탭 이름(「행사」)과 키가 겹친다.** 사전 키가 한국어
  // 원문이라 한 항목이 두 자리를 함께 맡는다. 그래서 탭 쪽을 `Events`에서
  // `Event`로 낮췄다: 사고통제의 「공사 · 행사」가 `Roadworks · Events`로
  // 읽히는 것이 어색했고, 나머지 탭이 전부 단수라(Summary·Commerce·People)
  // 탭 쪽에도 그편이 맞았다. `병원`이 충전소와 주변 시설에서 한 항목을
  // 나눠 쓰는 것과 같은 처리다.
  '총 {면수}면': '{면수} spaces',
  '{면수}면': '{면수} free',
  만차: 'Full',
  '실시간 미제공': 'No live data',
  // 주차요금(2026-08-25). 시안 `_5`의 「10분당 800원」 자리다.
  //
  // **「{분}분 무료」가 따로 있는 이유.** 유료 주차장인데 기본요금이 0원인 곳이
  // 실호출에 셋 있었다 — 「기본 시간 동안 무료, 그 뒤부터 과금」이다. 「30분
  // 0원」으로 적으면 공짜 주차장으로 읽힌다.
  '{분}분 {요금}원': '₩{요금} / {분}min',
  '{분}분 무료': 'First {분}min free',
  '이후 {분}분당 {요금}원': 'then ₩{요금} / {분}min',
  '정보 없음': 'No data',
  유료: 'Paid',
  무료: 'Free',
  '{대수}대': '{대수}',
  '거치대 {대수}대': '{대수} docks',
  // **거치율이 100%를 넘는 대여소가 실호출 227곳 중 61곳이었다**(최대 450%).
  // 자전거를 가지고 온 사람에게는 「7대 가능」이 반대 신호다.
  '반납 자리 없음': 'No docks free',
  '대여 불가': 'None available',
  미세먼지: 'PM10',
  초미세먼지: 'PM2.5',
  강수확률: 'Rain',
  // **확률과 다른 값이다** — 「70%」는 올지 말지이고 이건 오면 얼마나 오는지다.
  // 예보 840칸 중 75칸에 값이 있었다(현재 날씨 쪽은 35곳 전부 `-`였다).
  강수량: 'Rainfall',
  '{양}mm': '{양}mm',
  // ── 날씨 확장(2026-08-25) ──
  // 시안 `_6`의 2×2 격자와 통합대기지수 줄. 전부 `WEATHER_STTS`의 같은 행에
  // 있어 추가 호출이 0이다.
  습도: 'Humidity',
  // 「풍속」이 아니라 「바람」이다 — 방향을 함께 적으므로 속도만 가리키는
  // 이름은 틀린 말이 된다.
  바람: 'Wind',
  '{속도}m/s': '{속도} m/s',
  자외선지수: 'UV index',
  '일출 · 일몰': 'Sunrise · Sunset',
  '통합대기지수 {값}': 'Air quality index {값}',
  // 기상특보 배너. 발효 시각은 서울 API 원문 그대로 들어간다.
  '{시각} 발효': 'in effect since {시각}',
  // 자외선지수 단계. 기상청 5단계이고 실응답에서 `낮음`을 봤다(2026-08-25).
  // 나머지 넷은 공표된 닫힌 목록이라 함께 적는다 — 도로 지표처럼 목록 자체가
  // 없는 자리와 다르다.
  낮음: 'Low',
  높음: 'High',
  매우높음: 'Very high',
  위험: 'Extreme',
  // 기상특보 종류(`WARN_VAL`). 실응답에서 `폭염`을 봤다. `호우`는 재난문자
  // 쪽에서 이미 쓰던 키를 함께 쓴다 — 같은 낱말이고 뜻도 같다.
  폭염: 'Heat wave',
  대설: 'Heavy snow',
  강풍: 'Strong wind',
  // 16방위. `domain/cityInfo.ts`의 `WIND_DIRECTION_NAMES`가 정본이고 여기는
  // 그 이름들의 영어다. 모르는 약자는 원문(`SSE`)이 그대로 나가므로 이 표에
  // 없는 값이 화면을 깨뜨리지 않는다.
  북: 'N',
  북북동: 'NNE',
  북동: 'NE',
  동북동: 'ENE',
  동: 'E',
  동남동: 'ESE',
  남동: 'SE',
  남남동: 'SSE',
  남: 'S',
  남남서: 'SSW',
  남서: 'SW',
  서남서: 'WSW',
  서: 'W',
  서북서: 'WNW',
  북서: 'NW',
  북북서: 'NNW',
  // 통합대기환경등급. 서울 API가 주는 값이라 도메인에 한국어로 남는다.
  좋음: 'Good',
  나쁨: 'Bad',
  매우나쁨: 'Very bad',
  '통합대기 {등급}': 'Air quality {등급}',

  // ── 상세: 탭과 요약 카드 ──
  // **예전에는 요약 칩 줄이었다.** 상세가 전체 화면 + 탭이 되면서 그 자리를
  // 2열 카드 격자가 대신한다 — 카드는 같은 값을 보여주면서 **다른 화면**으로
  // 데려간다(`SummaryGrid`).
  요약: 'Summary',
  상권: 'Commerce',
  인구: 'People',
  교통: 'Transit',
  주변: 'Nearby',
  행사: 'Event',
  안전: 'Safety',
  '명소 정보 분류': 'Place information categories',
  // 앞의 쉼표는 보이는 글자 뒤에 이어 붙는 sr-only 조각이라 그대로 둔다.
  ', {분류} 자세히 보기': ', see {분류} details',
  혼잡도: 'Crowding',
  날씨: 'Weather',
  대기질: 'Air quality',
  통합대기: 'Air index',
  도로: 'Roads',
  지하철: 'Subway',
  주차: 'Parking',
  '가까운 역': 'Nearby stations',
  '주변 주차장': 'Nearby lots',
  '{비율}% 비어 있어요': '{비율}% free',
  대여소: 'Docks',
  '대여 가능': 'Available now',
  '진행 중': 'Running now',
  '{개수}곳': '{개수}',
  '{개수}건': '{개수}',

  // ── 상세: 근처 ──
  '근처 쾌적한 장소': 'Quieter places nearby',
  '여기가 너무 붐비나요? 2km 안에서 한산한 곳이에요.':
    'Too crowded here? These are quieter, within 2km.',
  '· 도보 {분}분': '· {분} min walk',

  // ── 오늘의 서울 ──
  '오늘의 서울': "Seoul today",
  '지금 서울': 'Seoul now',
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
