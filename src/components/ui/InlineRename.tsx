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
  /** Extra classes applied only to the <input> while editing (e.g. a width). */
  inputClassName?: string
  /**
   * Styling for the box that wraps the field — padding, rounding, and (for a
   * fixed writing area) width. Defaults to a tight, slightly-rounded box.
   */
  wrapperClassName?: string
  /**
   * Wrapper classes applied only when the field is interactive (not read-only).
   * Carries the underline + any hover/focus width animation; supplying it moves
   * the accent underline from the text to the wrapper box so it spans the full
   * (possibly animating) width, and enables width-keyword interpolation.
   */
  activeWrapperClassName?: string
  /** Render as static text: no underline, no hover, no click-to-edit. */
  readOnly?: boolean
  /**
   * Uncontrolled only: start (or enter) edit mode when this becomes true — e.g.
   * a just-created row that should accept a name immediately. Ignored when
   * `editing` is supplied.
   */
  autoEdit?: boolean
  style?: React.CSSProperties
}

/**
 * Inline-editable text label. A padded box wraps the field; on hover or while
 * editing an accent underline eases in. Click the text to edit; Enter/blur
 * commits, Escape reverts. Works controlled (pass editing/onEditingChange) or
 * uncontrolled. Pass `activeWrapperClassName` to put the underline on the box
 * and animate its width (e.g. content-width at rest, expanding to an edit
 * width on hover); pass `readOnly` to render it as static, uneditable text.
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
  inputClassName = "",
  wrapperClassName = "rounded-sm px-1.5 py-0.5 -mx-1.5",
  activeWrapperClassName,
  readOnly = false,
  autoEdit = false,
  style,
}: InlineRenameProps) {
  const isControlled = editing !== undefined
  const [internalEditing, setInternalEditing] = useState(
    () => !isControlled && autoEdit,
  )
  const isEditing = isControlled ? editing : internalEditing

  const inputRef = useRef<HTMLInputElement>(null)
  const cancelledRef = useRef(false)

  function setEditing(next: boolean) {
    if (!isControlled) setInternalEditing(next)
    onEditingChange?.(next)
  }

  useEffect(() => {
    if (!isControlled && autoEdit) setInternalEditing(true)
  }, [autoEdit, isControlled])

  useEffect(() => {
    if (isEditing && autoFocus) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [isEditing, autoFocus])

  const wrapperStyle = {
    "--rename-accent": accentColor ?? DEFAULT_ACCENT,
  } as React.CSSProperties

  if (readOnly) {
    // Reserve the same transparent bottom border as the editable box so toggling
    // lock neither shifts by 1px nor flashes a fading underline (the reused DOM
    // node would otherwise animate border-color from currentColor to transparent).
    return (
      <span
        className={`inline-flex items-center border-b border-transparent ${wrapperClassName}`}
        style={wrapperStyle}
        title={title}
      >
        <span
          className={`min-w-0 block truncate pr-0.5 ${className}`}
          style={style}
        >
          {value || (
            <span className="italic text-muted font-normal">
              {placeholder ?? ""}
            </span>
          )}
        </span>
      </span>
    )
  }

  // `box` mode (activeWrapperClassName present): the underline lives on the
  // wrapper so it spans the full, possibly-animating width; the caller's classes
  // supply the hover/focus width. `text` mode: the underline sits under the text
  // and its 1px is reserved so nothing reflows.
  const box = activeWrapperClassName !== undefined

  if (box) {
    ;(wrapperStyle as Record<string, string>).interpolateSize = "allow-keywords"
  }

  const wrapperClass = box
    ? "group inline-flex items-center cursor-text " +
      "border-b border-transparent transition-[border-color,width] duration-300 " +
      "hover:border-[var(--rename-accent)] focus-within:border-[var(--rename-accent)] " +
      `${wrapperClassName} ${activeWrapperClassName}`
    : "group inline-flex items-center border border-transparent " +
      "transition-colors duration-300 cursor-text " +
      wrapperClassName

  const innerUnderline = box
    ? ""
    : "border-b border-transparent transition-colors duration-300 " +
      "group-hover:border-[var(--rename-accent)] " +
      "group-focus-within:border-[var(--rename-accent)] "
  const innerClass = `min-w-0 bg-transparent outline-none ${innerUnderline}${className}`

  return (
    <span className={wrapperClass} style={wrapperStyle} title={title}>
      {isEditing ? (
        <input
          ref={inputRef}
          size={box ? 1 : undefined}
          defaultValue={value}
          placeholder={placeholder}
          aria-label={ariaLabel}
          className={`${innerClass} placeholder:italic placeholder:font-normal placeholder:text-muted ${inputClassName}`}
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
        // pr-0.5: the italic placeholder's last glyph overhangs the truncate
        // clip box; without it the final letter is shaved.
        <span
          onClick={() => setEditing(true)}
          className={`${innerClass} block truncate pr-0.5`}
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
