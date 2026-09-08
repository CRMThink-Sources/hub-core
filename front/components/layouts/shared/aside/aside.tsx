'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { AsideProps } from '../../types/types'

export const Aside = ({
  logo,
  homeHref,
  brandIcon,
  brandName,
  links,
  languages,
  onLanguageChange,
  activeRoute,
  bgColor = '#F9F9FB',
  activeColor = '#d9fce6',
  activeTextColor = '#000000',
  inactiveTextColor = '#000000',
  hoverColor = '#e8fdf0',
  borderColor = '#e5e7eb',
  accentColor = '#5A997E',
  betaMode,
  linksNamespace,
}: AsideProps) => {
  const pathname = usePathname()
  const { t } = useTranslation('shared/aside')
  const { t: tLinks } = useTranslation(linksNamespace ?? 'shared/aside')

  const isActive = (href: string) =>
    activeRoute ? activeRoute === href : pathname === href

  const handleLanguageChange = (code: string) => {
    if (onLanguageChange) onLanguageChange(code)
  }

  return (
    <aside
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        height: '100vh',
        width: '256px',
        padding: '16px 16px 0',
        borderRight: `1px solid ${borderColor}`,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: bgColor,
      }}
    >
      <div
        style={{
          position: 'relative',
          display: 'flex',
          justifyContent: 'center',
          marginBottom: '32px',
        }}
      >
        <div className="w-full h-full p-8">
          {homeHref ? (
            <Link href={homeHref}>
              <img src={logo} alt="Logo" className="" />
            </Link>
          ) : (
            <img src={logo} alt="Logo" className="" />
          )}
        </div>
        <div
          style={{
            position: 'absolute',
            top: '110px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <img
            src={brandIcon}
            alt="Brand favicon"
            style={{ width: '16px', height: '16px' }}
          />
          <span
            style={{
              fontSize: '10px',
              fontWeight: 500,
              color: '#6b7280',
              lineHeight: 1,
            }}
          >
            {t('desenvolvido', { brandName })}
          </span>
        </div>
        <div
          style={{
            position: 'absolute',
            top: '135px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          {languages.map(lang => (
            <button
              key={lang.code}
              onClick={() => handleLanguageChange(lang.code)}
              style={{
                cursor: 'pointer',
                background: 'none',
                border: 'none',
                padding: 0,
                opacity: 1,
                transition: 'opacity 0.2s',
              }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '0.7')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
            >
              <img
                src={lang.flag}
                alt={`${lang.code} Flag`}
                style={{ width: '20px', height: '20px', borderRadius: '2px' }}
              />
            </button>
          ))}
        </div>
      </div>

      <nav
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          marginTop: '32px',
          flex: 1,
        }}
      >
        {links.map(link => (
          <Link
            key={link.href}
            href={link.href}
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '10px 12px',
              borderRadius: '8px',
              textDecoration: 'none',
              transition: 'background-color 0.2s',
              backgroundColor: isActive(link.href)
                ? activeColor
                : 'transparent',
              color: isActive(link.href) ? activeTextColor : inactiveTextColor,
              fontWeight: isActive(link.href) ? 'bold' : 'normal',
            }}
            onMouseEnter={e => {
              if (!isActive(link.href))
                e.currentTarget.style.backgroundColor = hoverColor
            }}
            onMouseLeave={e => {
              if (!isActive(link.href))
                e.currentTarget.style.backgroundColor = 'transparent'
            }}
          >
            {link.icon && (
              <img
                src={link.icon}
                alt={link.label}
                style={{ width: '20px', height: '20px' }}
              />
            )}
            <span>{linksNamespace ? tLinks(link.label) : link.label}</span>
          </Link>
        ))}
      </nav>

      {betaMode && (
        <div
          style={{
            padding: '20px 0',
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <span
            style={{
              fontSize: '10px',
              fontWeight: 600,
              color: '#3b82f6',
              backgroundColor: '#eff6ff',
              border: '1px solid #bfdbfe',
              borderRadius: '999px',
              padding: '3px 10px',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            {t('versaoBeta')}
          </span>
        </div>
      )}
    </aside>
  )
}
