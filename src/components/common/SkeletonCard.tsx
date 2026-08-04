export function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-card border border-outline-variant bg-surface-container-lowest p-4">
      <div className="h-4 w-1/3 rounded bg-surface-container-high" />
      <div className="mt-3 h-3 w-1/2 rounded bg-surface-container" />
    </div>
  )
}

export function SkeletonList({ count = 5 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-3" aria-label="불러오는 중">
      {Array.from({ length: count }, (_, index) => (
        <SkeletonCard key={index} />
      ))}
    </div>
  )
}
