import { useEffect, useRef, useState } from "react"

const DEFAULT_ACCENT = "#60a5fa" // blue-400, matches the prior focus underline

export interface InlineRenameProps {
  /** Current text. The edit input is uncontrolled (seeded from this on entry). */
  value: string
  /** Called with the raw field value on Enter/blur. Caller decides emptiness. */
  onCommit: (next: string) => void
  /** Controlled editing state. Omit for self-managed (click-to-edit) behaviour. */
  editing?: boolean
  onEditingChange?: (editing: boolean) => void
  /**
   * Whether entering edit focuses + selects the input. Default true. Pass false
   * for fields that render the input continuously (e.g. an always-editable row)
   * so they don't grab focus on mount.
   */
  autoFocus?: boolean
  /** Underline accent (e.g. a team's element hex). Defaults to blue-400. */
  accentColor?: string
  /** Shown muted/italic when value is empty (display) and as input placeholder. */
  placeholder?: string
  ariaLabel?: string
  title?: string
  /** Sizing / typography applied to the text + input (e.g. "text-3xl font-bold"). */
  className?: string
  /**
   * Styling for the box that wraps the field — padding, rounding, and (for a
   * fixed writing area) width. Defaults to a tight, slightly-rounded box.
   */
  wrapperClassName?: string
  style?: React.CSSProperties
}

/**
 * Inline-editable text label. A padded box wraps the field; on hover or while
 * editing an accent underline eases in inside it. Click the text to edit;
 * Enter/blur commits, Escape reverts. Works controlled (pass editing/
 * onEditingChange) or uncontrolled.
 */
export function InlineRename({
  value,
  onCommit,
  editing,
  onEditingChange,
  autoFocus = true,
  accentColor,
  placeholder,
  ariaLabel,
  title,
  className = "",
  wrapperClassName = "rounded-sm px-1.5 py-0.5 -mx-1.5",
  style,
}: InlineRenameProps) {
  const [internalEditing, setInternalEditing] = useState(false)
  const isControlled = editing !== undefined
  const isEditing = isControlled ? editing : internalEditing

  const inputRef = useRef<HTMLInputElement>(null)
  const cancelledRef = useRef(false)

  function setEditing(next: boolean) {
    if (!isControlled) setInternalEditing(next)
    onEditingChange?.(next)
  }

  useEffect(() => {
    if (isEditing && autoFocus) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [isEditing, autoFocus])

  // The accent underline sits inside the field box — transparent at rest (its 1px
  // space reserved so nothing reflows), revealed on hover / focus-within.
  const wrapperClass =
    "group inline-flex items-center border border-transparent " +
    "transition-colors duration-300 cursor-text " +
    wrapperClassName
  const innerClass =
    "min-w-0 bg-transparent outline-none border-b border-transparent " +
    "transition-colors duration-300 " +
    "group-hover:border-[var(--rename-accent)] " +
    "group-focus-within:border-[var(--rename-accent)] " +
    className

  const wrapperStyle = {
    "--rename-accent": accentColor ?? DEFAULT_ACCENT,
  } as React.CSSProperties

  return (
    <span className={wrapperClass} style={wrapperStyle} title={title}>
      {isEditing ? (
        <input
          ref={inputRef}
          defaultValue={value}
          placeholder={placeholder}
          aria-label={ariaLabel}
          className={innerClass}
          style={style}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              onCommit(e.currentTarget.value)
              setEditing(false)
            } else if (e.key === "Escape") {
              cancelledRef.current = true
              setEditing(false)
            }
          }}
          onBlur={(e) => {
            if (cancelledRef.current) {
              cancelledRef.current = false
              return
            }
            onCommit(e.currentTarget.value)
            setEditing(false)
          }}
        />
      ) : (
        <span
          onClick={() => setEditing(true)}
          className={`${innerClass} block truncate`}
          style={style}
        >
          {value || (
            <span className="italic text-muted font-normal">
              {placeholder ?? ""}
            </span>
          )}
        </span>
      )}
    </span>
  )
}
