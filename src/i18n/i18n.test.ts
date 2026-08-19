import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { AGE_LABELS } from '../domain/composition'
import { congestionHeadline } from '../domain/congestion'
import { filterLabel, PRESETS } from '../domain/presets'
import { summarizeCityInfo } from '../domain/cityInfoSummary'
import { AREA_CATEGORIES, CATEGORY_LABEL, CONGESTION_LEVELS } from '../domain/types'
import { EN } from './en'

/**
 * 요약 칩의 라벨 틀. **도메인을 실제로 불러서 뽑는다** — 손으로 적으면 칩이
 * 하나 늘 때 여기가 낡는데, 이렇게 두면 그때 「사전에 없다」로 죽는다.
 */
function chipLabels(): readonly string[] {
  return summarizeCityInfo({
    areaName: '광화문·덕수궁',
    areaCode: 'POI009',
    freshness: null,
    weather: null,
    // **도로소통도 이제 들어온다.** 예전에는 번역할 수 없어 `null`로 뺐는데
    // (키가 혼잡도 헤드라인의 `원활`과 다퉜다), 도메인이 「도로」를 붙여 칸을
    // 가르면서 셋 다 사전에 들어왔다. 값의 종류를 다 알지는 못하므로 여기서
    // 고정하는 것은 실제로 본 셋이다.
    roadTraffic: { index: '정체', speed: 13.9, message: '', updatedAt: '' },
    accidents: [],
    parking: [
      { name: '주차장', coords: null, capacity: 100, available: 45, liveAvailable: true, paid: null },
    ],
    bikes: [{ name: '대여소', coords: null, bikes: 5, racks: 10 }],
    events: [{ name: '행사', period: '', place: '', free: null, url: '' }],
    alerts: [],
    subway: [{ station: '시청', line: '1호선', direction: '', terminal: '', message: '' }],
  }).map((chip) => chip.label)
}

/**
 * 감싸지 않아도 되는 한국어. **화면에 안 나오는 값들이다.**
 *
 * 여기 더할 때는 「왜 화면에 안 나오는가」를 말할 수 있어야 한다. 못 하겠으면
 * 그건 감싸야 하는 것이다.
 */
const ALLOWED: ReadonlySet<string> = new Set([
  // 필터·카테고리 **값**. 화면 글자가 아니라 도메인이 명소를 거르는 키다.
  '전체',
  // 시트 단계의 값 이름표. 쓰는 자리에서 `t(...)`로 감싼다.
  '살짝 열림',
  '절반',
  // 요일 키. `dayLabel()`이 `t()`로 감싸 쓴다.
  '일',
  '월',
  '화',
  '수',
  '목',
  '금',
  '토',
  // **언어 버튼은 일부러 안 감싼다.** 「한국어로 바꾸기」는 한국어를 찾는
  // 사람에게 보여야 하는 말이라 영어 화면에서도 한국어여야 한다 — 번역하면
  // 정작 필요한 사람이 못 읽는다. 버튼 글자 「한」도 같은 이유다.
  '한국어로 바꾸기',
  '한',
  // 개발자용 콘솔. 화면에 안 나온다.
  '지도 스크립트를 불러오지 못했습니다:',
  '[cctv] 플레이어를 불러오지 못했습니다:',
])

/** 화면이 변수로 넘기지만 도메인에 상수가 없는 것들. 여기 적는 것이 정본이다. */
const DAY_KEYS = ['일', '월', '화', '수', '목', '금', '토'] as const
const DETENT_LABELS = ['살짝 열림', '절반', '전체'] as const
const RESIDENCE_LABELS = ['외지인이 많아요', '동네 생활권이에요'] as const
/** 통합대기환경등급. 서울 API가 주는 값이다. */
const AIR_GRADE_LABELS = ['좋음', '보통', '나쁨', '매우나쁨'] as const
/**
 * 도로소통 칩. 도메인이 값 앞에 「도로」를 붙여 만든다.
 *
 * **명세에 값의 종류가 없어 이 셋이 전부라고 단언할 수 없다.** 그래서 위
 * `chipLabels()`처럼 도메인에서 뽑아 오지 못하고 여기 손으로 적는다 — 새 값을
 * 보거든 여기와 `en.ts`에 함께 더하라. 못 더한 값은 영어 화면에서 「도로 ○○」로
 * 한국어가 남고, 그건 죽지 않는다(사전에 없으면 키를 그대로 돌려준다).
 */
const ROAD_CHIP_LABELS = ['도로 원활', '도로 서행', '도로 정체'] as const
const LOCATION_ERROR_MESSAGES = [
  '위치 권한이 거부되었습니다',
  '이 환경에는 위치 기능이 없습니다',
] as const

/** `src/`의 컴포넌트 원문(테스트 제외). `vitest.config.ts`의 define이 넣는다. */
declare const __SRC_SOURCES__: string
const SOURCES = __SRC_SOURCES__

/** 화면 파일(components·screens)만. 데이터 파일의 한국어는 화면 글자가 아니다. */
declare const __UI_SOURCES__: string
const UI_SOURCES = __UI_SOURCES__

/** 같은 파일들을 경로와 함께. 모듈 최상위 `t()` 검사가 파일 단위로 파싱한다. */
declare const __UI_FILES__: readonly { readonly path: string; readonly source: string }[]
const UI_FILES = __UI_FILES__

/**
 * `t('...')`에 넘긴 문자열 전부. 두 번째 인자(값)는 안 본다.
 *
 * **작은따옴표만 보면 안 된다.** 코드 포매터가 문자열 안의 작은따옴표 때문에
 * 큰따옴표로 바꿔 놓는 자리가 있어서(`t("주차장")`), 한쪽만 보면 멀쩡히 쓰는
 * 키가 「안 쓰임」으로 잡힌다 — 실제로 그렇게 헛짚었다.
 *
 * **주석은 안 걷어낸다.** 그래서 주석에 예시로 적은 호출까지 「사전에 없다」로
 * 걸린다(2026-08-18에 실제로 겪었다 — 주석의 예시 한 줄이 검사를 죽였다).
 * 일부러 두는 쪽이다: 걷어내면 주석에만 남은 옛 키가 「안 쓰는 항목」으로 잡혀
 * 반대쪽 검사가 시끄러워진다. 주석에 호출 예시를 적을 때는 진짜 키를 쓰거나
 * 따옴표를 빼라.
 */
function translatedKeys(): readonly string[] {
  return [
    ...[...SOURCES.matchAll(/\bt\(\s*'((?:[^'\\]|\\.)*)'/g)].map((found) =>
      found[1].replace(/\\'/g, "'"),
    ),
    ...[...SOURCES.matchAll(/\bt\(\s*"((?:[^"\\]|\\.)*)"/g)].map((found) =>
      found[1].replace(/\\"/g, '"'),
    ),
  ]
}

/**
 * 화면이 **변수로** 넘기는 키. 정적으로는 못 찾는다 — `t(CATEGORY_LABEL[c])`
 * 처럼 도메인이 돌려주는 값을 그대로 번역하기 때문이다.
 *
 * **도메인에서 직접 가져온다.** 목록을 손으로 적으면 도메인에 값이 하나 늘 때
 * 여기가 낡는데, 이렇게 두면 그때 「사전에 없다」로 죽는다.
 */
function dynamicKeys(): readonly string[] {
  return [
    ...CONGESTION_LEVELS,
    ...CONGESTION_LEVELS.map(congestionHeadline),
    ...AREA_CATEGORIES,
    ...AREA_CATEGORIES.map((category) => CATEGORY_LABEL[category]),
    ...PRESETS.map((preset) => filterLabel(preset.key)),
    filterLabel('fav'),
    ...AGE_LABELS,
    ...DAY_KEYS,
    ...DETENT_LABELS,
    ...RESIDENCE_LABELS,
    ...AIR_GRADE_LABELS,
    ...ROAD_CHIP_LABELS,
    ...LOCATION_ERROR_MESSAGES,
    ...chipLabels(),
  ]
}

// ── 완결성 ────────────────────────────────────────────────────────────────
//
// **절반만 옮기면 안 하느니 못하다.** 영어 화면에 한국어가 섞이면 사용자는
// 「번역이 덜 됐다」가 아니라 「이 앱은 영어를 지원하지 않는다」로 읽는다.
// 사람이 155개를 세어 지킬 수 있는 일이 아니라 기계가 잠근다.
describe('영어 사전 완결성', () => {
  it('화면이 번역을 요청한 문자열은 전부 사전에 있다', () => {
    const missing = [...new Set(translatedKeys())].filter((key) => !(key in EN))

    expect(missing).toEqual([])
  })

  it('변수로 넘기는 키도 전부 사전에 있다', () => {
    // 도메인 값이 하나 늘면 여기서 죽는다 — 「붐빔」에 다섯째 단계가 생기거나
    // 카테고리가 추가되면 화면이 조용히 한국어로 돌아가는 것을 막는다.
    const missing = dynamicKeys().filter((key) => !(key in EN))

    expect(missing).toEqual([])
  })

  it('사전에 있는데 화면에서 안 쓰는 항목이 없다', () => {
    // 낡은 항목이 쌓이면 「이 문구가 아직 쓰이나」를 물을 자리가 없어진다.
    // 문구를 고칠 때 옛 키가 남는 것이 가장 흔한 경로다.
    const used = new Set([...translatedKeys(), ...dynamicKeys()])
    const unused = Object.keys(EN).filter((key) => !used.has(key))

    expect(unused).toEqual([])
  })

  // 위 둘이 빈 배열끼리 비교하며 조용히 통과하는 것을 막는다.
  it('양쪽에서 실제로 읽어낸다', () => {
    expect(translatedKeys().length).toBeGreaterThan(100)
    expect(Object.keys(EN).length).toBeGreaterThan(100)
  })

  it('영어 번역이 비어 있지 않다', () => {
    const empty = Object.entries(EN)
      .filter(([, value]) => value.trim() === '')
      .map(([key]) => key)

    expect(empty).toEqual([])
  })

  // 값이 낀 문구는 양쪽의 자리 이름이 같아야 한다. 영어에서 자리 하나를
  // 빠뜨리면 그 값이 화면에서 통째로 사라진다 — 「45% parking free」가
  // 「% parking free」가 되는 식이다.
  it('값이 낀 자리가 한국어와 영어에서 짝이 맞는다', () => {
    const holes = (text: string): string =>
      [...text.matchAll(/\{([^{}]+)\}/g)].map((m) => m[1]).toSorted().join(',')

    const mismatched = Object.entries(EN)
      .filter(([korean, english]) => holes(korean) !== holes(english))
      .map(([korean, english]) => `${korean} → ${english}`)

    expect(mismatched).toEqual([])
  })
})

// ── 섞임 방지 ─────────────────────────────────────────────────────────────
//
// **위 검사만으로는 부족하다.** 사전이 완전해도 화면 어딘가에서 `t()`를 안
// 감싸면 그 자리는 영어 모드에서 한국어로 남는다 — 그게 「절반만 옮긴」
// 상태이고, 사용자는 「번역이 덜 됐다」가 아니라 「영어를 지원하지 않는다」로
// 읽는다. 사람이 51개 파일을 눈으로 지킬 수 있는 일이 아니다.
describe('감싸지 않은 한국어가 없다', () => {
  /**
   * 화면 파일에서 `t(...)` 밖에 있는 한국어 문자열을 찾는다.
   *
   * **주석은 뺀다.** 이 저장소는 주석을 한국어로 적고, 그건 화면에 안 나온다.
   */
  function unwrapped(): readonly string[] {
    const withoutComments = UI_SOURCES.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(
      /(^|[^:])\/\/[^\n]*/g,
      '$1',
    )
    // `t('...')`·`t("...")`로 감싼 것을 먼저 지운다. 남은 한국어가 문제다.
    const withoutTranslated = withoutComments
      .replace(/\bt\(\s*'(?:[^'\\]|\\.)*'/g, 't(')
      .replace(/\bt\(\s*"(?:[^"\\]|\\.)*"/g, 't(')

    return [
      ...new Set(
        // 줄바꿈을 넘지 않는다 — 넘으면 서로 다른 두 따옴표를 한 문자열로 잇는다.
        [...withoutTranslated.matchAll(/'([^'\n]*[가-힣][^'\n]*)'/g)].map(
          (found) => found[1],
        ),
      ),
    ]
  }

  it('컴포넌트에 감싸지 않은 한국어 문자열이 없다', () => {
    // 여기 걸린 것은 셋 중 하나다 — (1) 감싸는 걸 잊었거나, (2) 화면에 안
    // 나오는 값(도메인 키·저장소 키)이라 `ALLOWED`에 적어야 하거나,
    // (3) 개발자용 콘솔 문구다.
    expect(unwrapped().filter((text) => !ALLOWED.has(text))).toEqual([])
  })

  it('실제로 읽어낸다', () => {
    // 정규식이 깨져 0개가 되면 위 단언이 언제나 참이 된다.
    expect(UI_SOURCES).toMatch(/[가-힣]/)
  })
})

// ── 굳지 않는다 ───────────────────────────────────────────────────────────
//
// **위 검사들이 전부 통과하면서도 화면이 한국어로 남는 길이 하나 더 있다.**
// 사전에 항목이 있고 `t()`로 감싸기까지 했는데, 그걸 **모듈 최상위에서** 부르면
// import 시점의 언어(=기본값 한국어)로 값이 굳는다. 이후 언어를 바꿔도 그
// 상수는 다시 계산되지 않는다 — 사전은 완전한데 그 자리만 안 바뀐다.
//
// 2026-08-18에 실제로 6개 파일 19개 문자열이 이 상태였다(정렬 줄·화면 테마·
// 지도 앱 버튼·위치 안내·평소 대비 문구·지도 실패 안내). 기존 검사 다섯 개가
// 전부 초록인 채였다. 화면 쪽 증거는 `languageSwitch.test.tsx`에 있고, 여기서는
// **원인 자체**를 막는다.
describe('모듈 최상위에서 t()를 부르지 않는다', () => {
  /** `t(...)` 호출을 감싸는 함수가 하나도 없으면 그건 모듈 최상위다. */
  function frozenCalls(): readonly string[] {
    const frozen: string[] = []

    for (const file of UI_FILES) {
      const parsed = ts.createSourceFile(
        file.path,
        file.source,
        ts.ScriptTarget.Latest,
        // `setParentNodes`. 부모를 거슬러 올라가 함수 안인지 보려면 필요하다.
        true,
        ts.ScriptKind.TSX,
      )

      const visit = (node: ts.Node, insideFunction: boolean): void => {
        if (
          !insideFunction &&
          ts.isCallExpression(node) &&
          ts.isIdentifier(node.expression) &&
          node.expression.text === 't'
        ) {
          const first = node.arguments[0]
          const key =
            first !== undefined && ts.isStringLiteral(first) ? first.text : '?'
          frozen.push(`${file.path}: t('${key}')`)
        }
        // 화살표 함수·함수 선언·메서드 안쪽은 부를 때마다 다시 도므로 안전하다.
        const opens = ts.isFunctionLike(node)
        ts.forEachChild(node, (child) => {
          visit(child, insideFunction || opens)
        })
      }

      visit(parsed, false)
    }

    return frozen
  }

  it('언어가 바뀌어도 안 바뀌는 상수 문구가 없다', () => {
    expect(frozenCalls()).toEqual([])
  })

  it('실제로 파싱해서 t() 호출을 찾아낸다', () => {
    // 파서가 조용히 0개를 돌려주면 위 단언이 언제나 참이 된다. 함수 **안**의
    // 호출은 정상이므로, 그게 많이 잡히는지로 탐지기가 살아 있음을 확인한다.
    let inside = 0
    for (const file of UI_FILES) {
      const parsed = ts.createSourceFile(
        file.path,
        file.source,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX,
      )
      const visit = (node: ts.Node): void => {
        if (
          ts.isCallExpression(node) &&
          ts.isIdentifier(node.expression) &&
          node.expression.text === 't'
        ) {
          inside += 1
        }
        ts.forEachChild(node, visit)
      }
      visit(parsed)
    }
    expect(inside).toBeGreaterThan(100)
  })
})
