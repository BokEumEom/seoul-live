// `src/data/areas.ts`를 서울시가 주는 값으로 다시 만든다.
//
// **왜 손으로 안 적는가.** 30곳 시절에도 손으로 적은 `code`가 25곳 틀렸다
// (2026-08-13에 실호출로 잡았다). 121곳이면 같은 실수가 네 배로 늘고, 이번에는
// 좌표까지 손으로 찍어야 한다. 세 값(`code`·`lat`·`lng`·`category`)은 전부
// 서울시가 이미 갖고 있으므로 받아 적는 쪽이 맞다.
//
// **출처가 둘인 이유.**
//
//   - 이름·카테고리·좌표 → SeoulRtd `/api/boundary/hotspot` (인증키 없음, 1회)
//     121곳의 경계 폴리곤과 그 중심점을 준다. 우리가 손으로 찍던 좌표보다
//     낫다 — 폴리곤의 실제 중심이라 넓은 구역에서 특히 그렇다(잠실 관광특구는
//     손값과 1.4km 차이였다).
//   - `code`(AREA_CD) → 공식 OpenAPI `citydata_ppltn` (인증키, 121회)
//     SeoulRtd 쪽 응답에는 POI 코드가 없다. **이 스크립트를 돌릴 때마다 하루
//     1,000회 한도에서 121회를 쓴다** — 그래서 결과를 저장소에 넣고, 명소
//     목록이 바뀔 때만 다시 돌린다.
//
// **영어 이름과 목적 태그는 우리 것이라 여기서 안 온다.** 기존 파일에서 그대로
// 옮기고, 새로 들어오는 곳은 아래 `NEW_NAMES_EN`이 갖는다. 하나라도 비면
// 스크립트가 멈춘다 — `nameEn`이 타입상 필수라서 빈 채로 두면 영어 화면에서만
// 조용히 한국어가 남는다(`domain/types.ts`의 그 필드 주석이 이 사정을 적고 있다).
//
//   SEOUL_API_KEY=... node scripts/generate-areas.mjs
//
// `.env`가 있으면 거기서 키를 읽는다.

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const TARGET = join(ROOT, 'src/data/areas.ts')
const RTD = 'https://data.seoul.go.kr/SeoulRtd'
const OFFICIAL = 'http://openapi.seoul.go.kr:8088'
const CONCURRENCY = 6

// 새로 들어오는 91곳의 영어 이름.
//
// **규칙은 기존 30곳과 같다: 분류어를 뺀다.** 「명동 관광특구」가 `Myeongdong`인
// 것과 같은 이유다 — 이름 아래 줄에 카테고리가 이미 있어 「Myeongdong Special
// Tourist Zone / Tourist zones」로 같은 말이 두 번 나오고, 그 길이가 명소 상세
// 제목을 자른다. 「A·B」 꼴은 `Gwanghwamun & Deoksugung`처럼 `&`로 잇는다.
const NEW_NAMES_EN = {
  // 관광특구
  '강남 MICE 관광특구': 'Gangnam MICE',
  '동대문 관광특구': 'Dongdaemun',
  '종로·청계 관광특구': 'Jongno & Cheonggye',
  '홍대 관광특구': 'Hongdae',

  // 고궁·문화유산
  보신각: 'Bosingak Belfry',
  '서울 암사동 유적': 'Amsa-dong Prehistoric Site',

  // 인구밀집지역
  동대문역: 'Dongdaemun Station',
  가산디지털단지역: 'Gasan Digital Complex Station',
  건대입구역: 'Konkuk Univ. Station',
  고덕역: 'Godeok Station',
  고속터미널역: 'Express Bus Terminal Station',
  교대역: 'Gyodae Station',
  구로디지털단지역: 'Guro Digital Complex Station',
  구로역: 'Guro Station',
  군자역: 'Gunja Station',
  대림역: 'Daerim Station',
  뚝섬역: 'Ttukseom Station',
  미아사거리역: 'Miasageori Station',
  발산역: 'Balsan Station',
  사당역: 'Sadang Station',
  삼각지역: 'Samgakji Station',
  서울대입구역: "Seoul Nat'l Univ. Station",
  '서울식물원·마곡나루역': 'Seoul Botanic Park & Magongnaru',
  서울역: 'Seoul Station',
  선릉역: 'Seolleung Station',
  성신여대입구역: "Sungshin Women's Univ. Station",
  수유역: 'Suyu Station',
  '신논현역·논현역': 'Sinnonhyeon & Nonhyeon Stations',
  신도림역: 'Sindorim Station',
  신림역: 'Sillim Station',
  '신촌·이대역': 'Sinchon & Ewha Womans Univ.',
  양재역: 'Yangjae Station',
  역삼역: 'Yeoksam Station',
  연신내역: 'Yeonsinnae Station',
  '오목교역·목동운동장': 'Omokgyo Station & Mokdong Stadium',
  왕십리역: 'Wangsimni Station',
  용산역: 'Yongsan Station',
  이태원역: 'Itaewon Station',
  장지역: 'Jangji Station',
  장한평역: 'Janghanpyeong Station',
  천호역: 'Cheonho Station',
  '총신대입구(이수)역': 'Chongshin Univ. (Isu) Station',
  충정로역: 'Chungjeongno Station',
  합정역: 'Hapjeong Station',
  혜화역: 'Hyehwa Station',
  회기역: 'Hoegi Station',
  쌍문역: 'Ssangmun Station',
  신정네거리역: 'Sinjeong Negeori Station',
  잠실새내역: 'Jamsilsaenae Station',
  잠실역: 'Jamsil Station',
  '시의회 앞': 'Seoul City Council',
  숭례문: 'Sungnyemun Gate',

  // 발달상권
  가락시장: 'Garak Market',
  여의도: 'Yeouido',
  김포공항: 'Gimpo Airport',
  노량진: 'Noryangjin',
  '덕수궁길·정동길': 'Deoksugung-gil & Jeongdong-gil',
  용리단길: 'Yongridan-gil',
  '이태원 앤틱가구거리': 'Itaewon Antique Furniture St.',
  '창동 신경제 중심지': 'Changdong New Economic Hub',
  '청량리 제기동 일대 전통시장': 'Cheongnyangni & Jegi-dong Markets',
  'DMC(디지털미디어시티)': 'DMC',
  '북창동 먹자골목': 'Bukchang-dong Food Alley',
  남대문시장: 'Namdaemun Market',
  익선동: 'Ikseon-dong',
  '송리단길·호수단길': 'Songridan-gil & Hosudan-gil',
  '신촌 스타광장': 'Sinchon Star Plaza',
  '잠실롯데타워·석촌호수': 'Lotte Tower & Seokchon Lake',

  // 공원
  난지한강공원: 'Nanji Hangang Park',
  강서한강공원: 'Gangseo Hangang Park',
  고척돔: 'Gocheok Sky Dome',
  광나루한강공원: 'Gwangnaru Hangang Park',
  광화문광장: 'Gwanghwamun Square',
  '국립중앙박물관·용산가족공원': "Nat'l Museum & Yongsan Family Park",
  노들섬: 'Nodeul Island',
  망원한강공원: 'Mangwon Hangang Park',
  '서리풀공원·몽마르뜨공원': 'Seoripul & Montmartre Parks',
  서울대공원: 'Seoul Grand Park',
  아차산: 'Achasan Mountain',
  청계산: 'Cheonggyesan Mountain',
  양화한강공원: 'Yanghwa Hangang Park',
  응봉산: 'Eungbongsan Mountain',
  이촌한강공원: 'Ichon Hangang Park',
  잠실종합운동장: 'Jamsil Sports Complex',
  올림픽공원: 'Olympic Park',
  보라매공원: 'Boramae Park',
  서대문독립공원: 'Seodaemun Independence Park',
  안양천: 'Anyangcheon Stream',
  홍제폭포: 'Hongje Waterfall',
  송현녹지광장: 'Songhyeon Green Plaza',
  여의서로: 'Yeouiseo-ro',
}

function apiKey() {
  if (process.env.SEOUL_API_KEY) {
    return process.env.SEOUL_API_KEY
  }
  const found = readFileSync(join(ROOT, '.env'), 'utf8').match(
    /^SEOUL_API_KEY=(.+)$/m,
  )
  if (found === null) {
    throw new Error('SEOUL_API_KEY를 환경변수에서도 .env에서도 못 찾았다')
  }
  return found[1].trim()
}

/**
 * 지금 파일에서 값을 뽑는다 — 우리가 손으로 관리하는 둘(영어 이름·목적 태그)과
 * **이미 받아 둔 `code`**다.
 *
 * **`code`까지 읽는 것이 중요하다.** AREA_CD는 명소마다 고정이므로 한 번 받으면
 * 다시 받을 이유가 없는데, 매번 받으면 이 스크립트를 돌릴 때마다 하루 한도에서
 * 121회가 나간다. 이미 아는 것은 건너뛰고 **새 이름만** 받는다 — 명소가 몇 곳
 * 늘어난 날에는 그 몇 회로 끝난다.
 *
 * 정규식으로 읽는 것은 이 스크립트가 저장소의 빌드 파이프라인 밖에 있어서다
 * (`render-icons.mjs`와 같은 자리). 못 읽은 항목이 있으면 그만큼 값이
 * 사라지므로, 아래에서 개수를 세어 확인한다.
 */
function existingRows() {
  const source = readFileSync(TARGET, 'utf8')
  const kept = new Map()
  for (const line of source.split('\n')) {
    const name = line.match(/name: (?:'([^']+)'|"([^"]+)")/)
    if (name === null) continue
    const code = line.match(/code: '([^']+)'/)
    const nameEn = line.match(/nameEn: (?:'([^']*)'|"([^"]*)")/)
    const purposes = line.match(/purposes: (\[[^\]]*\])/)
    kept.set(name[1] ?? name[2], {
      code: code === null ? null : code[1],
      nameEn: nameEn === null ? null : (nameEn[1] ?? nameEn[2]),
      purposes: purposes === null ? null : purposes[1],
    })
  }
  return kept
}

async function fetchBoundaries() {
  // 세션 게이트가 있다. `hotspotNm`을 실은 지도 페이지를 먼저 받아야 쿠키가
  // 목록에서 통한다 — 안 그러면 302다(본문 없이 조용히). `api/_lib/seoulRtd.ts`가
  // 같은 사정을 더 자세히 적고 있다.
  const boot = await fetch(
    `${RTD}/map?hotspotNm=${encodeURIComponent('광화문·덕수궁')}`,
    { signal: AbortSignal.timeout(20_000) },
  )
  const raw =
    typeof boot.headers.getSetCookie === 'function'
      ? boot.headers.getSetCookie().join('; ')
      : (boot.headers.get('set-cookie') ?? '')
  const session = raw.match(/JSESSIONID=([^;,\s]+)/)

  const res = await fetch(`${RTD}/api/boundary/hotspot`, {
    headers: {
      Referer: `${RTD}/map`,
      'X-Requested-With': 'XMLHttpRequest',
      Accept: 'application/json',
      Cookie: session === null ? '' : `JSESSIONID=${session[1]}`,
    },
    redirect: 'manual',
    signal: AbortSignal.timeout(30_000),
  })
  if (res.status !== 200) {
    throw new Error(`boundary/hotspot이 ${res.status}를 줬다 — 세션 게이트일 것`)
  }
  return res.json()
}

/** 한 명소의 AREA_CD. 못 얻으면 null을 돌려 호출부가 세게 한다. */
async function fetchAreaCode(key, name) {
  const url = `${OFFICIAL}/${key}/json/citydata_ppltn/1/5/${encodeURIComponent(name)}`
  const res = await fetch(url, { signal: AbortSignal.timeout(25_000) })
  const body = await res.json()
  return body['SeoulRtd.citydata_ppltn']?.[0]?.AREA_CD ?? null
}

/** 상류를 한꺼번에 두드리지 않는다 — `api/_lib/concurrency.ts`와 같은 이유다. */
async function mapLimited(items, limit, run) {
  const out = new Array(items.length)
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const at = next
        next += 1
        out[at] = await run(items[at], at)
      }
    }),
  )
  return out
}

function quote(value) {
  return value.includes("'") ? JSON.stringify(value) : `'${value}'`
}

const HEADER = `// **이 파일은 \`scripts/generate-areas.mjs\`가 만든다. 손으로 고치지 마라.**
//
// 명소 121곳 전부다. \`code\`·\`lat\`·\`lng\`·\`category\`는 서울시가 준 값을 받아
// 적은 것이고(생성기 주석에 출처가 있다), \`nameEn\`과 \`purposes\`만 우리 것이다.
// 그 둘을 고치려면 생성기의 \`NEW_NAMES_EN\`이나 이 파일을 고친 뒤 다시 돌려라 —
// 생성기가 기존 파일에서 그 두 값을 그대로 옮겨 온다.
//
// \`name\`은 서울 API 호출 키(AREA_NM)와 **같아야 한다.** 틀리면 그 명소만 조용히
// 실패한다(에러 없이 빈 데이터). 2026-08-20에 121곳 전부를 서울시 응답과 대조해
// 121/121 일치를 확인했다 — 괄호 주변 공백까지 같다.
//
// **\`nameEn\`은 화면에 적는 이름일 뿐 \`name\`의 번역이 아니다.** 「관광특구」 같은
// 분류어는 뺐다 — 이름 아래 줄에 카테고리가 이미 있어 같은 말이 두 번 나오고,
// 그 길이 때문에 명소 상세 제목이 잘린다.
import type { AreaCatalogEntry } from '../domain/types.js'

export const AREA_CATALOG: readonly AreaCatalogEntry[] = [`

// 카탈로그 뒤에 붙는 것. **이 블록은 생성기가 갖고 있어야 한다** — 처음엔 잊고
// `ALERT_SOURCE_AREA`를 빠뜨렸고, 그 순간 홈의 재난문자가 통째로 죽었다.
const FOOTER = `]

/**
 * 홈 화면이 재난문자를 받으려고 도시 정보를 조회하는 **한 곳.**
 *
 * **왜 한 곳인가.** 재난문자는 \`citydata\`에만 있고 그건 명소당 1회 호출이다.
 * 카탈로그 전체를 부르면 하루 한도(1,000)를 훌쩍 넘는다. 한 곳이면 3시간
 * 캐시에서 하루 8회이고, **그 8회는 이미 예산 안에 있다** — 도시정보 몫으로
 * 잡아 둔 「최악의 경우」에 이 명소가 포함되어 있어서 최악에는 총량이 안 는다.
 * 늘어나는 것은 「아무도 이 명소의 상세를 안 연 날」의 실제 호출뿐이다.
 *
 * **광화문·덕수궁인 이유**는 서울의 한가운데이고, 이 앱이 실호출로 응답을
 * 확인해 픽스처까지 떠 둔 유일한 명소이기 때문이다(\`docs/fixtures/\`).
 *
 * **한 곳으로 서울 전체를 덮는다고 단정하지 않는다.** \`LIVE_DST_MESSAGE\`가
 * 시 전역인지 자치구 단위인지 명세에 없고, 실응답에서 비어 있는 것만 봤다.
 * 그래서 화면은 「서울의 재난문자 전부」라고 말하지 않고 **받은 문구를 그대로**
 * 보여준다 — 재난문자 본문은 언제나 스스로 지역을 밝힌다(「[서울특별시] …」).
 * 상세를 연 명소가 있으면 그쪽 캐시도 함께 모은다(\`useCityAlerts\`).
 */
export const ALERT_SOURCE_AREA = '광화문·덕수궁'

export function findAreaByName(name: string): AreaCatalogEntry | undefined {
  return AREA_CATALOG.find((area) => area.name === name)
}

export const AREA_NAMES: readonly string[] = AREA_CATALOG.map((area) => area.name)
`

const kept = existingRows()
console.log(`기존 파일에서 읽은 항목: ${kept.size}곳`)

const boundaries = await fetchBoundaries()
console.log(`SeoulRtd 경계: ${boundaries.length}곳`)

const missingEn = boundaries
  .map((b) => b.hotspotNm)
  .filter((name) => !kept.get(name)?.nameEn && !NEW_NAMES_EN[name])
if (missingEn.length > 0) {
  throw new Error(
    `영어 이름이 없는 곳 ${missingEn.length}개: ${missingEn.join(', ')}`,
  )
}

const needCode = boundaries.filter((b) => !kept.get(b.hotspotNm)?.code)
const codeOf = new Map(
  [...kept].filter(([, v]) => v.code !== null).map(([name, v]) => [name, v.code]),
)

if (needCode.length === 0) {
  console.log('AREA_CD는 전부 이미 알고 있다 — 공식 API를 안 부른다.')
} else {
  console.log(
    `공식 API로 AREA_CD를 받는다 (${needCode.length}회 — 하루 한도에서 나간다)…`,
  )
  const codes = await mapLimited(needCode, CONCURRENCY, async (b, at) => {
    const code = await fetchAreaCode(apiKey(), b.hotspotNm)
    if ((at + 1) % 20 === 0) console.log(`  …${at + 1}/${needCode.length}`)
    return code
  })

  const failed = needCode.filter((_, at) => codes[at] === null).map((b) => b.hotspotNm)
  if (failed.length > 0) {
    throw new Error(`AREA_CD를 못 받은 곳 ${failed.length}개: ${failed.join(', ')}`)
  }
  needCode.forEach((b, at) => codeOf.set(b.hotspotNm, codes[at]))
}

// 카테고리 순 → 그 안에서 이름 순. 손으로 관리하던 시절의 순서(추가한 순)는
// 되살릴 수 없고, 121곳에서는 어차피 사람이 훑을 목록이 아니다. 정렬해 두면
// 다시 생성했을 때 diff가 값 변화만 보여준다.
const CATEGORY_ORDER = ['관광특구', '고궁·문화유산', '발달상권', '공원', '인구밀집지역']
const rows = boundaries
  .map((b) => ({
    code: codeOf.get(b.hotspotNm),
    name: b.hotspotNm,
    nameEn: kept.get(b.hotspotNm)?.nameEn ?? NEW_NAMES_EN[b.hotspotNm],
    lat: Number(b.centerXcrd),
    lng: Number(b.centerYcrd),
    category: b.category,
    purposes: kept.get(b.hotspotNm)?.purposes ?? null,
  }))
  .toSorted(
    (a, b) =>
      CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category) ||
      a.name.localeCompare(b.name, 'ko'),
  )

const body = rows
  .map((r) => {
    const purposes = r.purposes === null ? '' : `, purposes: ${r.purposes}`
    return `  { code: '${r.code}', name: ${quote(r.name)}, nameEn: ${quote(r.nameEn)}, lat: ${r.lat}, lng: ${r.lng}, category: '${r.category}'${purposes} },`
  })
  .join('\n')

writeFileSync(TARGET, `${HEADER}\n${body}\n${FOOTER}`)

const tagged = rows.filter((r) => r.purposes !== null).length
console.log(`\n${TARGET} — ${rows.length}곳을 썼다.`)
console.log(`  목적 태그 있음: ${tagged}곳 / 없음: ${rows.length - tagged}곳`)
console.log('  태그 없는 곳은 「아이와 나들이」·「데이트」 프리셋에서 빠진다(의도된 동작).')
