interface IconProps {
  className?: string
}

function iconClass(className?: string) {
  return `app-icon ${className ?? ''}`.trim()
}

export function PencilIcon({ className }: IconProps) {
  return <svg className={iconClass(className)} viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m4 20 4.2-1 10.7-10.7a2.1 2.1 0 0 0-3-3L5.2 16 4 20Z" /><path d="m14.8 6.5 2.8 2.8" /></svg>
}

export function TrashIcon({ className }: IconProps) {
  return <svg className={iconClass(className)} viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5" /></svg>
}

export function CloseIcon({ className }: IconProps) {
  return <svg className={iconClass(className)} viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m6 6 12 12M18 6 6 18" /></svg>
}

export function RemoveRelationshipIcon({ className }: IconProps) {
  return <svg className={iconClass(className)} viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m9.5 14.5 5-5M7.5 17H6a4 4 0 0 1 0-8h3M16.5 7H18a4 4 0 0 1 0 8h-3" /><path d="m5 5 14 14" /></svg>
}

export function PlusIcon({ className }: IconProps) {
  return <svg className={iconClass(className)} viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 5v14M5 12h14" /></svg>
}

export function MinusIcon({ className }: IconProps) {
  return <svg className={iconClass(className)} viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 12h14" /></svg>
}

export function ShareIcon({ className }: IconProps) {
  return <svg className={iconClass(className)} viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M14 5h5v5M19 5l-9 9" /><path d="M18 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></svg>
}

export function CopyIcon({ className }: IconProps) {
  return <svg className={iconClass(className)} viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="8" y="8" width="11" height="11" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></svg>
}

export function UserIcon({ className }: IconProps) {
  return <svg className={iconClass(className)} viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="8" r="3.5" /><path d="M5.5 20c.5-4 2.7-6 6.5-6s6 2 6.5 6" /></svg>
}

export function CheckIcon({ className }: IconProps) {
  return <svg className={iconClass(className)} viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m5 12 4.5 4.5L19 7" /></svg>
}

export function FitViewIcon({ className }: IconProps) {
  return <svg className={iconClass(className)} viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 4H4v4m12-4h4v4M8 20H4v-4m12 4h4v-4" /></svg>
}

export function CalendarIcon({ className }: IconProps) {
  return <svg className={iconClass(className)} viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 3v3m12-3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1Z" /></svg>
}

export function ChevronIcon({ className }: IconProps) {
  return <svg className={iconClass(className)} viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m7 9 5 5 5-5" /></svg>
}

export function ArrowLeftIcon({ className }: IconProps) {
  return <svg className={iconClass(className)} viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m15 5-7 7 7 7" /></svg>
}

export function ArrowRightIcon({ className }: IconProps) {
  return <svg className={iconClass(className)} viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m9 5 7 7-7 7" /></svg>
}
