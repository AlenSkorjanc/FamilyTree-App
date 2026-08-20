import { useEffect, useRef } from 'react'

interface Props {
  value: string
  placeholder: string
  label: string
  onChange: (value: string) => void
  onDone: () => void
}

export function SearchBox({ value, placeholder, label, onChange, onDone }: Props) {
  const elementRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const element = elementRef.current
    if (element && element.textContent !== value) element.textContent = value
  }, [value])

  return (
    <div
      ref={elementRef}
      className="global-search-input"
      role="searchbox"
      aria-label={label}
      aria-multiline="false"
      contentEditable="plaintext-only"
      suppressContentEditableWarning
      inputMode="search"
      enterKeyHint="done"
      autoCapitalize="none"
      spellCheck={false}
      data-empty={value.length === 0}
      data-placeholder={placeholder}
      onInput={(event) => onChange(event.currentTarget.textContent ?? '')}
      onKeyDown={(event) => {
        if (event.key !== 'Enter') return
        event.preventDefault()
        event.currentTarget.blur()
        onDone()
      }}
    />
  )
}
