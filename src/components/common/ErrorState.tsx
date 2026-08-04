interface Props {
  readonly message: string
  readonly onRetry?: () => void
}

export function ErrorState({ message, onRetry }: Props) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-card bg-surface-container-lowest px-4 py-10 text-center">
      <p className="text-body-md text-on-surface-variant">{message}</p>
      {onRetry !== undefined && (
        <button
          type="button"
          onClick={onRetry}
          className="min-h-12 rounded-action bg-primary px-5 text-label-md font-semibold text-on-primary"
        >
          다시 시도
        </button>
      )}
    </div>
  )
}
