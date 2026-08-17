import type { ReactNode } from 'react'

interface Props { title: string; children: ReactNode; onClose: () => void; wide?: boolean }

export function Modal({ title, children, onClose, wide }: Props) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <header><h2>{title}</h2><button className="icon-button" onClick={onClose} aria-label="Close">×</button></header>
        {children}
      </section>
    </div>
  )
}
