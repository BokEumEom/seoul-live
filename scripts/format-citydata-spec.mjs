// seoul_realdata.md(탭 구분 원문)를 마크다운으로 옮긴다. 한 번 쓰고 버리는 것이
// 아니라 **원문이 갱신되면 다시 돌릴 수 있게** 두었다 — 명세는 최종수정일이 있다.
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const RAW = process.argv[2] ?? '/tmp/seoul_realdata.raw.md'
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'seoul_realdata.md')

function sources(dir) {
  const out = []
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) { out.push(...sources(p)); continue }
    if (!/\.(ts|tsx)$/.test(e)) continue
    if (/\.test\./.test(e) || /^mock/i.test(e)) continue
    out.push(p)
  }
  return out
}
const CODE = [...sources(join(ROOT, 'src')), ...sources(join(ROOT, 'api'))]
  .map((f) => readFileSync(f, 'utf8'))
  .join('\n')

const lines = readFileSync(RAW, 'utf8').split('\n')
const fields = []
for (const l of lines) {
  const m = l.match(/^(\d+)\t([A-Z0-9_]+)\t(.*?)\t*$/)
  if (m) fields.push({ no: +m[1], name: m[2], desc: m[3].trim() })
}

const used = (name) => new RegExp(`\\b${name}\\b`).test(CODE)

// 순번 구간으로 절을 나눈다. 경계는 명세의 컨테이너 필드(LIVE_PPLTN_STTS 같은
// 것)가 시작하는 자리다.
const SECTIONS = [
  [1, 2, '장소 식별', null],
  [3, 27, '실시간 인구현황', 'LIVE_PPLTN_STTS'],
  [28, 44, '도로소통현황', 'ROAD_TRAFFIC_STTS'],
  [45, 61, '주차장 현황', 'PRK_STTS'],
  [62, 104, '지하철 실시간 도착 현황', 'SUB_STTS'],
  [105, 130, '버스정류소 현황', 'BUS_STN_STTS'],
  [131, 139, '사고통제현황', 'ACDNT_CNTRL_STTS'],
  [140, 159, '전기차충전소 현황', 'CHARGER_STTS'],
  [160, 167, '따릉이 현황', 'SBIKE_STTS'],
  [168, 199, '날씨 현황', 'WEATHER_STTS'],
  [200, 206, '24시간 예보', 'FCST24HOURS'],
  [207, 216, '문화행사 현황', 'CULTURALEVENTINFO'],
  [217, 240, '실시간 상권 현황', 'LIVE_CMRCL_STTS'],
  [241, 245, '실시간 긴급재난문자', 'LIVE_DST_MESSAGE'],
  [246, 251, '연합뉴스 기사', 'LIVE_YNA_NEWS'],
]

function table(rows) {
  const head = '| 순번 | 출력명 | 설명 | 구현 |\n| ---: | --- | --- | :---: |'
  const body = rows
    .map((f) => `| ${f.no} | \`${f.name}\` | ${f.desc} | ${used(f.name) ? '✅' : '—'} |`)
    .join('\n')
  return `${head}\n${body}`
}

const total = fields.length
const done = fields.filter((f) => used(f.name)).length

const sectionBlocks = SECTIONS.map(([from, to, title, container]) => {
  const rows = fields.filter((f) => f.no >= from && f.no <= to)
  const hit = rows.filter((f) => used(f.name)).length
  const tag = container === null ? '' : ` — \`${container}\``
  return `### ${title}${tag}\n\n구현 ${hit}/${rows.length}\n\n${table(rows)}`
}).join('\n\n')

const doc = `# 서울시 실시간 도시데이터 (\`citydata\`) 명세

서울 열린데이터광장 공식 명세를 옮긴 것이다. **원문은 탭 구분 텍스트였고 표만 마크다운으로 바꿨다 — 값은 한 글자도 고치지 않았다.**

> **이 문서는 참조이자 구현 트래커다.** 「구현」 열은 짐작이 아니라 \`src/\`·\`api/\`에서 그 필드 이름을 실제로 읽는지 기계로 센 것이다(테스트·목업 파일은 제외). 지금 **${done}/${total}**이다. 대부분을 구현하는 것이 목표이므로 안 쓰는 필드도 전부 남겼다.
>
> 원문(탭 구분)이 갱신되면 \`node scripts/format-citydata-spec.mjs <원문경로>\`로 다시 만든다. 「구현」 열도 그때 다시 센다.

## 메타데이터

| | | | |
| --- | --- | --- | --- |
| 공공정보명 | 문화/관광 | 서비스명 | 서울시 실시간 도시데이터 |
| 분류체계 | 문화관광>관광 | 원본시스템 | 서울시 실시간 도시데이터 |
| 제공기관 | 서울특별시 | 저작권자명 | 서울특별시 |
| 제공부서 | 데이터전략과 데이터기획팀 | 저작권자연락처 | 02-2133-4272 |
| 담당자명 | 이원재 | 제3저작권자 | 없음 |
| 담당자연락처 | 02-2133-4272 | 원본형태 | DB |
| 생성기준일 | 2022.06.21 | **적재주기** | **실시간** |
| 데이터 공개일자 | 2022.08.31 | **최종수정일** | **2026.08.03** |
| 이용허락조건 | 공공누리 1유형 — 출처표시 (상업적 이용 및 변경 가능) | | |

**태그:** 실시간, 실시간 인구, 도로소통, 대중교통, 날씨, 환경, 전기차충전소, 문화행사

### 서비스 설명 (원문)

서울시 실시간 도시데이터는 실시간 인구현황, 도로소통현황, 주차장 현황, 지하철 실시간 도착 현황, 버스정류소 현황, 사고통제현황, 따릉이 현황, 날씨 현황, 전기차충전소 현황, 문화행사 현황 정보를 제공합니다.

- 서울시 주요 **121장소**에 대하여 인구, 교통, 환경, 문화행사 등 각 분야의 공공·민간 실시간 데이터를 융합한 데이터입니다.
- 서울 주요 121장소 목록은 '서울시 주요 121장소명 목록(코드포함).xlsx' 파일에서 확인 가능합니다.
- **샘플key를 통해서는 주요 121장소 중 '광화문·덕수궁' 지역만 조회 가능합니다.** 나머지 지역을 조회하기 위해서는 인증키를 발급받아 주시기 바랍니다.
- **서울시 실시간 도시데이터 API는 한 번에 1개 장소씩만 호출 가능합니다.**
- **장소명 OR 장소코드 중 택1 하여 호출이 가능합니다.**

## 요청 인자

| 변수 | 타입 | 변수명 | 값설명 |
| --- | --- | --- | --- |
| \`KEY\` | STRING(필수) | 인증키 | OPENAPI에서 발급된 인증키 |
| \`TYPE\` | STRING(필수) | 요청파일 타입 | xml : xml, xml파일 : xmlf, 엑셀파일 : xls, json파일 : json |
| \`SERVICE\` | STRING(필수) | 서비스명 | citydata |
| \`START_INDEX\` | INTEGER(필수) | 요청시작위치 | 정수 입력 |
| \`END_INDEX\` | INTEGER(필수) | 요청종료위치 | 정수 입력 |
| \`AREA_NM\` | STRING(필수) | 핫스팟 장소명 | 장소명 or 장소코드 입력(서울시 주요 120장소명 목록(코드포함).xlsx 파일 참고) |

**날짜 인자가 없다.** 이 여섯이 전부다 — 그래서 이 서비스로는 과거 조회가 안 된다.

## 출력값

${sectionBlocks}

## 샘플 URL

\`\`\`
http://openapi.seoul.go.kr:8088/sample/xml/citydata/1/5/광화문·덕수궁
\`\`\`

**평문 HTTP다(8088).** HTTPS를 지원하지 않아 토스 웹뷰에서 직접 못 부른다 — \`api/\`의 중계가 존재하는 이유다.

## 에러 및 정보 메시지

| 코드 | 메시지 | 조치 |
| --- | --- | --- |
| \`INFO-000\` | 정상 처리되었습니다 | |
| \`INFO-100\` | 인증키가 유효하지 않습니다. | 인증키가 없는 경우, 열린 데이터 광장 홈페이지에서 인증키를 신청하십시오. |
| \`INFO-200\` | 해당하는 데이터가 없습니다. | |
| \`ERROR-300\` | 필수 값이 누락되어 있습니다. | 요청인자를 참고 하십시오. |
| \`ERROR-301\` | 파일타입 값이 누락 혹은 유효하지 않습니다. | 요청인자 중 TYPE을 확인하십시오. |
| \`ERROR-310\` | 해당하는 서비스를 찾을 수 없습니다. | 요청인자 중 SERVICE를 확인하십시오. |
| \`ERROR-331\` | 요청시작위치 값을 확인하십시오. | 요청인자 중 START_INDEX를 확인하십시오. |
| \`ERROR-332\` | 요청종료위치 값을 확인하십시오. | 요청인자 중 END_INDEX를 확인하십시오. |
| \`ERROR-333\` | 요청위치 값의 타입이 유효하지 않습니다. | 요청위치 값은 정수를 입력하세요. |
| \`ERROR-334\` | 요청종료위치 보다 요청시작위치가 더 큽니다. | 요청시작조회건수는 정수를 입력하세요. |
| \`ERROR-335\` | 샘플데이터(샘플키:sample) 는 한번에 최대 5건을 넘을 수 없습니다. | 요청시작위치와 요청종료위치 값은 1 ~ 5 사이만 가능합니다. |
| \`ERROR-336\` | 데이터요청은 한번에 최대 1000건을 넘을 수 없습니다. | 요청종료위치에서 요청시작위치를 뺀 값이 1000을 넘지 않도록 수정하세요. |
| \`ERROR-500\` | 서버 오류입니다. | 지속적으로 발생시 열린 데이터 광장으로 문의(Q&A) 바랍니다. |
| \`ERROR-600\` | 데이터베이스 연결 오류입니다. | 지속적으로 발생시 열린 데이터 광장으로 문의(Q&A) 바랍니다. |
| \`ERROR-601\` | SQL 문장 오류 입니다. | 지속적으로 발생시 열린 데이터 광장으로 문의(Q&A) 바랍니다. |

## 명세를 읽을 때 걸리는 것 (2026-08-20 확인)

명세 자체의 허술한 곳들이다. **짐작으로 메우면 조용히 틀린다.**

**1. 같은 이름이 다른 자리에 또 있다 — 중첩을 무시하고 파싱하면 섞인다.**

| 이름 | 어디에 | 어디에 또 |
| --- | --- | --- |
| \`PAY_YN\` | 주차장(53) 유무료 | 문화행사(213) 유무료 |
| \`TEMP\` | 날씨(169) 지금 기온 | 24시간 예보(202) 그 시각 기온 |
| \`PRECIPITATION\` | 날씨(176) | 24시간 예보(203) |
| \`PRECPT_TYPE\` | 날씨(177) | 24시간 예보(204) |

이 저장소는 이미 같은 함정을 밟은 적이 있다(2026-08-13에 도로소통·지하철 파서 버그 둘). **평평하게 훑지 말고 컨테이너를 타고 내려가라.**

**2. 순번 170이 없다.** 169 \`TEMP\` 다음이 171 \`MAX_TEMP\`다. 명세의 누락이고 데이터에는 영향이 없다.

**3. \`MAX_TEMP\`와 \`MIN_TEMP\`의 설명이 똑같다** — 둘 다 「일 최저온도/최고온도」다. 이름으로 판단해야 한다.

**4. 121과 120이 한 문서 안에서 엇갈린다.** 서비스 설명은 「121장소」인데 요청 인자 설명은 「120장소명 목록」이다. **실제는 121이다** — 2026-08-20에 전부 받아서 셌다.

**5. \`ROAD_TRAFFIC_IDX\`의 값 목록이 명세에 없다.** 「원활」·「서행」·「정체」가 명세 전문에서 0회다. 그래서 우리는 혼잡도 4단계에 매핑하지 않고 **문자열 그대로** 보여준다 — 짐작으로 매핑하면 처음 보는 값에서 틀린 색이 붙는다.

**6. \`AREA_CD\`로도 호출할 수 있다.** 「장소명 OR 장소코드 중 택1」이라고 명시돼 있는데, 우리는 지금 이름으로만 부른다. 이름은 괄호·중점이 섞여 URL 인코딩이 까다로운 반면 코드는 \`POI001\` 꼴이다 — 이름이 바뀌는 날에도 코드는 남을 가능성이 높다. **아직 실제로 시험해 보지 않았다.**

## 우리 구현과의 관계

- **이 서비스는 명소 상세가 쓴다.** 목록·지도는 인증키 없는 다른 문(SeoulRtd \`/api/hotspot\`)에서 121곳을 한 번에 받는다 — 근거는 \`AGENTS.md\`.
- **인증키가 필요하고 하루 1,000회를 나눠 쓴다.** 한 번에 한 장소뿐이라 부르는 만큼 그대로 나간다.
- **과거 조회가 없다.** 요청 인자 여섯에 날짜가 없다. 다만 SeoulRtd 쪽 \`/api/ppltn\`은 1시간/3시간/한달 전 대비를, \`/api/ppltn_congest\`는 과거 12시간 실측 인구를 준다.
`

writeFileSync(OUT, doc)
console.log(`${OUT} — 필드 ${total}개, 구현 ${done}개`)
