import type { CitySummary } from '../../domain/summary'

interface Props {
  readonly summary: CitySummary
}

export function SummaryCard({ summary }: Props) {
  if (summary.counted === 0) {
    return (
      <section className="mx-4 rounded-card bg-surface-container-lowest p-4">
        <h2 className="text-headline-sm text-on-surface">지금 서울</h2>
        <p className="mt-1 text-body-md text-on-surface-variant">
          혼잡도 정보를 아직 받지 못했어요.
        </p>
      </section>
    )
  }

  return (
    <section className="mx-4 rounded-card bg-surface-container-lowest p-4">
      <h2 className="text-label-md text-on-surface-variant">지금 서울</h2>
      <p className="mt-1 text-headline-md font-bold text-on-surface">
        {summary.counted}곳 중 붐빔 {summary.byLevel.붐빔}곳
      </p>
      {/* counted와 total이 다르면 그 사실을 말한다. 30곳이라고 써놓고 22곳만
          센 수치를 보여주면 사용자가 전체를 봤다고 오해한다. */}
      {summary.counted < summary.total && (
        <p className="mt-1 text-label-sm text-outline">
          {summary.total}곳 중 {summary.counted}곳만 정보가 왔어요.
        </p>
      )}
    </section>
  )
}
