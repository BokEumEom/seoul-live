// 서울 API는 레거시 정부 API라 동시 연결 처리량을 신뢰하기 어렵다. 명소 수만큼
// (최대 40개) 한꺼번에 fetch를 열면 연결 거부나 상류 스로틀링을 유발할 수 있고,
// 그렇게 실패한 자리는 C2가 고친 "전부 실패 → no-store" 경로가 아니라 "일부만
// 실패"로 잡혀 원인 파악이 어려워진다. 슬라이딩 윈도우로 동시 실행 수를 제한해
// 상류에 가하는 부하를 줄인다.
//
// 트레이드오프: 이렇게 하면 "최악의 경우 전체가 8~9초 안에 끝난다"는 예전 보장이
// 깨진다. limit=8일 때 30개 전부가 시간 초과로 실패하는 극단적인 경우 4번의
// "웨이브"가 필요해 이론상 30초 넘게 걸릴 수 있다 — Vercel의 maxDuration(15초)에
// 먼저 걸려 플랫폼이 강제 종료할 수 있다는 뜻이다. 이 경우 이 함수가 만드는 정돈된
// "no-store + 502" 대신 플랫폼의 일반 504가 나간다 — 더 느리지만, 실패 상태가
// 캐시되는 C2의 재발은 아니다(플랫폼이 만드는 504는 이 핸들러의 Cache-Control 로직을
// 아예 거치지 않는다). 서울 API가 "부분적으로 느림"인 훨씬 흔한 경우에는 이 한도
// 안에서 충분히 끝난다.
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length)
  let nextIndex = 0

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const current = nextIndex
      nextIndex += 1
      try {
        const value = await fn(items[current])
        results[current] = { status: 'fulfilled', value }
      } catch (reason) {
        results[current] = { status: 'rejected', reason }
      }
    }
  }

  const workerCount = Math.max(1, Math.min(limit, items.length))
  await Promise.all(Array.from({ length: workerCount }, worker))

  return results
}
