export function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-card border border-outline-variant bg-surface-container-lowest p-4">
      <div className="h-4 w-1/3 rounded-sm bg-surface-container-high" />
      <div className="mt-3 h-3 w-1/2 rounded-sm bg-surface-container" />
    </div>
  )
}

/**
 * 명소 목록 자리의 스켈레톤.
 *
 * **`SkeletonCard`를 쓰면 안 된다.** 목록은 카드가 아니라 구분선 행이라
 * (`AreaListItem`) 카드 여섯 장을 세워 두면 데이터가 오는 순간 레이아웃이
 * 통째로 바뀐다 — 로딩 화면이 「무엇이 올지」를 잘못 약속한다. 기하를 행에
 * 맞춘다: 아래 구분선, `min-h-12`, 이름 줄 + 부제 줄, 오른쪽 배지 자리.
 */
function SkeletonRow() {
  return (
    <div className="flex min-h-12 animate-pulse items-center gap-3 border-b border-outline-variant py-2 last:border-b-0">
      <div className="min-w-0 flex-1">
        <div className="h-5 w-2/5 rounded-sm bg-surface-container-high" />
        <div className="mt-1 h-4 w-1/4 rounded-sm bg-surface-container" />
      </div>
      <div className="h-6 w-14 shrink-0 rounded-full bg-surface-container" />
    </div>
  )
}

export function SkeletonList({ count = 5 }: { count?: number }) {
  return (
    // `role="status"`가 없으면 이 상자는 `generic`이고, generic은 이름을 받을 수
    // 없어(ARIA 1.2 "Name from author: prohibited") `aria-label`이 조용히
    // 버려진다 — 예전이 그랬고, 로딩 중이라는 사실이 소리 채널에 아예 없었다.
    // 같은 규칙이 `AreaListItem`의 즐겨찾기 표시와 `HomeScreen`의 포커스 상자
    // 주석에 이미 적혀 있다.
    <div role="status" className="flex flex-col gap-3">
      {/* 이름을 `aria-label`이 아니라 **내용**으로 준다. `status`는 폴라이트
          라이브 리전이라 낭독되는 것은 이름이 아니라 안쪽 텍스트다 — 라벨만
          있고 글자가 없으면 리전이 나타나도 읽을 것이 없다.

          다만 이 상자는 조건부 렌더라 리전이 **내용과 동시에** 삽입된다.
          일부 보조기술이 그 경우를 놓치는 것은 STATE.md에 미해결로 적혀 있는
          것과 같은 사정이고, 여기서도 해소되지 않는다. 그래도 훑어 내려가는
          사용자에게 이름이 생기는 것은 지금 얻는다. */}
      <span className="sr-only">불러오는 중</span>
      {Array.from({ length: count }, (_, index) => (
        <SkeletonCard key={index} />
      ))}
    </div>
  )
}

/** 명소 목록 자리. 행 사이 간격은 구분선이 대신하므로 `gap`을 주지 않는다. */
export function SkeletonRows({ count = 5 }: { count?: number }) {
  return (
    <div role="status" className="flex flex-col">
      <span className="sr-only">불러오는 중</span>
      {Array.from({ length: count }, (_, index) => (
        <SkeletonRow key={index} />
      ))}
    </div>
  )
}
