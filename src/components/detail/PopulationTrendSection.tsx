import { useAreaPopulation } from '../../data/queries'
import { PopulationTrendCard } from './PopulationTrendCard'

interface Props {
  /** 서울 API 호출 키. **한국어 원문이어야 한다**(`entry.name`) */
  readonly areaName: string
}

/**
 * 인파 변화 절의 조회 껍데기. **`CctvSection`과 같은 자리의 같은 예외다** —
 * 「props만 받는다」를 깨는 쪽이지만 기준은 「그 데이터를 쓰는 곳이 자기
 * 하나뿐이냐」이고(AGENTS.md 레이어 규칙), 이 질의는 형제도 부모도 안 본다.
 * 위로 끌어올리면 `AreaDetailScreen`이 자기가 안 쓰는 값을 받아 내려보내기만
 * 하는 통로가 된다.
 *
 * **여기서 부르는 것에는 이유가 하나 더 있다.** 인구 탭은 `tab === 'population'`
 * 일 때만 마운트되므로, 조회도 그때만 일어난다. 위로 올리면 상세를 열기만 해도
 * 매번 요청이 나가는데 — **상대가 문서화된 API가 아닌 남의 서버다.** 요약 탭만
 * 보고 나가는 사용자의 요청까지 보내지 않는 편이 예의에 맞다.
 *
 * 로딩·실패에 아무것도 안 그린다. `fetchPopulationTrend`가 실패를 빈 값으로
 * 흡수하고 `PopulationTrendCard`가 못 읽은 값을 `null`로 접으므로, 이 절은
 * 「있으면 뜨고 없으면 없다」로 충분하다 — 부가 정보라 재시도 버튼도 두지 않는다.
 */
export function PopulationTrendSection({ areaName }: Props) {
  const { data } = useAreaPopulation(areaName)

  return data === undefined ? null : <PopulationTrendCard trend={data.trend} />
}
