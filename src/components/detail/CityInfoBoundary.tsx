import type { ReactNode } from 'react'
import { t } from '../../i18n/t'
import { useCityInfo } from '../../data/queries'
import type { CityInfo } from '../../domain/cityInfo'
import { ErrorState } from '../common/ErrorState'
import { SkeletonList } from '../common/SkeletonCard'

interface Props {
  readonly areaName: string
  /** 이 패널에 볼 것이 하나라도 있나. 없으면 아래 빈 문구를 대신 그린다. */
  readonly has: (info: CityInfo) => boolean
  /** 볼 것이 없을 때의 한 줄. 패널마다 다르다. */
  readonly empty: string
  readonly children: (info: CityInfo) => ReactNode
}

/**
 * 도시 정보 한 벌을 기다리고, 실패·빈 상태를 **한 자리에서** 그린다.
 *
 * 탭이 일곱 개가 되면서 같은 조회를 여섯 패널이 나눠 쓴다. 각자
 * `isPending`·`isError`·`hasAny`를 따로 쓰면 여섯 벌이 되고, 그중 하나가
 * 「빈 배열이면 조용히 null」로 갈리는 순간 사용자에게는 **탭을 눌렀는데
 * 아무 일도 안 일어나는** 화면이 된다.
 *
 * **추가 호출은 0이다.** `useCityInfo`는 명소 이름이 같으면 queryKey가 같아
 * 여섯 패널이 한 응답을 나눠 쓴다.
 */
export function CityInfoBoundary({ areaName, has, empty, children }: Props) {
  const query = useCityInfo(areaName)
  const info = query.data

  if (query.isPending) {
    return (
      <div className="px-4">
        <SkeletonList count={2} />
      </div>
    )
  }

  if (query.isError) {
    return (
      <div className="px-4">
        <ErrorState
          message={t('도시 정보를 가져오지 못했어요.')}
          onRetry={() => void query.refetch()}
        />
      </div>
    )
  }

  if (info === undefined || !has(info)) {
    return (
      <p className="px-4 py-10 text-center text-body-md text-on-surface-variant">
        {empty}
      </p>
    )
  }

  return <>{children(info)}</>
}
