/** A centered empty-space state: a bold statement over an optional muted description. */
export function EmptyStatement({
  statement,
  description,
  className = "flex-1",
}: {
  statement: string
  description?: string
  className?: string
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center p-10 min-h-0 ${className}`}
    >
      <div className="flex flex-col gap-2 items-center text-center max-w-110">
        <span className="text-stat font-semibold text-foreground">
          {statement}
        </span>
        {description && (
          <span className="text-sm text-muted">{description}</span>
        )}
      </div>
    </div>
  )
}
