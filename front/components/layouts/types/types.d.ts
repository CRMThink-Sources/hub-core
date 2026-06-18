export interface NavLink {
  href: string
  label: string
  icon?: string
}

export interface Language {
  code: string
  flag: string
}

export interface AsideProps {
  logo: string
  brandIcon: string
  brandName: string
  links: NavLink[]
  languages: Language[]
  onLanguageChange?: (code: string) => void
  activeRoute?: string
  bgColor?: string
  activeColor?: string
  activeTextColor?: string
  inactiveTextColor?: string
  hoverColor?: string
  borderColor?: string
  accentColor?: string
  betaMode?: boolean
  linksNamespace?: string
}
