import { useEffect, useMemo, useRef, useState } from 'react'
import { useI18n } from '../i18n'
import { formatPersonDate } from './PersonNode'

interface Props {
  id: string
  label: string
  value: string | null
  initialViewDate?: string
  onChange: (value: string | null) => void
}

const mondayFirstWeekdays = [1, 2, 3, 4, 5, 6, 0]
const yearPageSize = 20
type CalendarView = 'days' | 'months' | 'years'

export function DatePicker({ id, label, value, initialViewDate, onChange }: Props) {
  const { language, t } = useI18n()
  const selectedDate = value ? parseDate(value) : null
  const suggestedDate = initialViewDate ? parseDate(initialViewDate) : null
  const [open, setOpen] = useState(false)
  const [visibleMonth, setVisibleMonth] = useState(() => monthStart(selectedDate ?? suggestedDate ?? new Date()))
  const [view, setView] = useState<CalendarView>('days')
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const closeOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', closeOutside)
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOutside)
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  const locale = language === 'sl' ? 'sl-SI' : 'en-GB'
  const monthLabel = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(visibleMonth)
  const monthNames = useMemo(() => Array.from({ length: 12 }, (_, month) => new Intl.DateTimeFormat(locale, { month: 'long' })
    .format(new Date(Date.UTC(2024, month, 1)))), [locale])
  const weekdays = useMemo(() => mondayFirstWeekdays.map((day) => new Intl.DateTimeFormat(locale, { weekday: 'short' })
    .format(new Date(Date.UTC(2024, 0, 7 + day))).replace('.', '')), [locale])
  const days = calendarDays(visibleMonth)
  const yearPageStart = Math.floor(visibleMonth.getUTCFullYear() / yearPageSize) * yearPageSize
  const visibleYears = Array.from({ length: yearPageSize }, (_, index) => yearPageStart + index)
  const toggle = () => {
    if (!open) {
      setVisibleMonth(monthStart(selectedDate ?? suggestedDate ?? new Date()))
      setView('days')
    }
    setOpen((current) => !current)
  }

  return (
    <div className="date-picker" ref={rootRef}>
      <div className="date-picker-control">
        <input
          id={id}
          type="text"
          readOnly
          value={value ? formatPersonDate(value, language) : ''}
          placeholder={t('chooseDate')}
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={toggle}
        />
        <button type="button" className="date-picker-toggle" onClick={toggle} aria-label={`${t('chooseDate')}: ${label}`} aria-expanded={open}>
          <CalendarIcon />
        </button>
      </div>
      {open && <div className="date-picker-popover" role="dialog" aria-label={`${t('chooseDate')}: ${label}`}>
        <header>
          <button type="button" onClick={() => setVisibleMonth(navigateBack(visibleMonth, view))} aria-label={t('calendarPrevious')}>‹</button>
          {view === 'days' && <button type="button" className="date-picker-heading" onClick={() => setView('months')} aria-label={`${t('chooseMonth')}: ${monthLabel}`}>{monthLabel}</button>}
          {view === 'months' && <button type="button" className="date-picker-heading" onClick={() => setView('years')} aria-label={`${t('chooseYear')}: ${visibleMonth.getUTCFullYear()}`}>{visibleMonth.getUTCFullYear()}</button>}
          {view === 'years' && <strong>{yearPageStart}–{yearPageStart + yearPageSize - 1}</strong>}
          <button type="button" onClick={() => setVisibleMonth(navigateForward(visibleMonth, view))} aria-label={t('calendarNext')}>›</button>
        </header>
        {view === 'days' && <>
          <div className="date-picker-weekdays" aria-hidden="true">
            {weekdays.map((weekday) => <span key={weekday}>{weekday}</span>)}
          </div>
          <div className="date-picker-days">
            {days.map((date, index) => date ? <button
              type="button"
              key={isoDate(date)}
              className={`${value === isoDate(date) ? 'selected' : ''} ${isToday(date) ? 'today' : ''}`}
              aria-label={new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(date)}
              aria-pressed={value === isoDate(date)}
              onClick={() => { onChange(isoDate(date)); setOpen(false) }}
            >{date.getUTCDate()}</button> : <span key={`empty-${index}`} />)}
          </div>
        </>}
        {view === 'months' && <div className="date-picker-months">
          {monthNames.map((month, index) => <button
            type="button"
            key={month}
            className={index === visibleMonth.getUTCMonth() ? 'selected' : ''}
            onClick={() => { setVisibleMonth(dateForMonth(visibleMonth.getUTCFullYear(), index)); setView('days') }}
          >{month}</button>)}
        </div>}
        {view === 'years' && <div className="date-picker-years">
          {visibleYears.map((year) => <button
            type="button"
            key={year}
            className={year === visibleMonth.getUTCFullYear() ? 'selected' : ''}
            onClick={() => { setVisibleMonth(dateForMonth(year, visibleMonth.getUTCMonth())); setView('months') }}
          >{year}</button>)}
        </div>}
        <footer>
          <button type="button" className="quiet" onClick={() => { onChange(null); setOpen(false) }}>{t('clearDate')}</button>
        </footer>
      </div>}
    </div>
  )
}

function CalendarIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3v3m12-3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1Z" /></svg>
}

function parseDate(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

function monthStart(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
}

function addMonths(date: Date, amount: number) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + amount, 1))
}

function navigateBack(date: Date, view: CalendarView) {
  if (view === 'days') return addMonths(date, -1)
  return dateForMonth(date.getUTCFullYear() - (view === 'years' ? yearPageSize : 1), date.getUTCMonth())
}

function navigateForward(date: Date, view: CalendarView) {
  if (view === 'days') return addMonths(date, 1)
  return dateForMonth(date.getUTCFullYear() + (view === 'years' ? yearPageSize : 1), date.getUTCMonth())
}

function dateForMonth(year: number, month: number) {
  const date = new Date(Date.UTC(2000, month, 1))
  date.setUTCFullYear(year)
  return date
}

function calendarDays(month: Date): Array<Date | null> {
  const firstDayOffset = (month.getUTCDay() + 6) % 7
  const dayCount = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0)).getUTCDate()
  return [
    ...Array.from<null>({ length: firstDayOffset }).fill(null),
    ...Array.from({ length: dayCount }, (_, index) => new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), index + 1))),
  ]
}

function isoDate(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
}

function isToday(date: Date) {
  const today = new Date()
  return date.getUTCFullYear() === today.getFullYear() && date.getUTCMonth() === today.getMonth() && date.getUTCDate() === today.getDate()
}
