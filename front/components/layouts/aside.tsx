'use client'

import { usePathname } from 'next/navigation'
import { AsideProps } from './types'

export const Aside = ({
  logo,
  brandIcon,
  brandName,
  links,
  languages,
  onLanguageChange,
  activeRoute,
  bgColor = '#F9F9FB',
  activeColor = '#d9fce6',
  activeTextColor = '#000000',
  hoverColor = '#e8fdf0',
  borderColor = '#e5e7eb',
  accentColor = '#5A997E',
}: AsideProps) => {
  const pathname = usePathname()

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
        <img src={logo} alt="Logo" style={{ width: 'auto', height: 'auto' }} />
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
            Desenvolvido por {brandName}
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
        }}
      >
        {links.map(link => (
          <a
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
              color: activeTextColor,
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
            {isActive(link.href) && (
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: '4px',
                  borderRadius: '0 4px 4px 0',
                  backgroundColor: accentColor,
                }}
              />
            )}
            <img
              src={link.icon}
              alt={link.label}
              style={{ width: '20px', height: '20px' }}
            />
            <span>{link.label}</span>
          </a>
        ))}
      </nav>
    </aside>
  )
}
