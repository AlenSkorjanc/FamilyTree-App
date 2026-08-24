interface Props {
  className?: string
}

export function AppLogo({ className = '' }: Props) {
  return <img className={`app-logo ${className}`.trim()} src="/family-tree-logo.png" alt="" aria-hidden="true" />
}
