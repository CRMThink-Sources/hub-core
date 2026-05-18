import { NextRequest, NextResponse } from 'next/server'
import {
  LOCALES,
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  type Locale,
} from './i18n/config'

function detectLocale(request: NextRequest): string {
  const cookie = request.cookies.get(LOCALE_COOKIE)?.value
  if (cookie && LOCALES.includes(cookie)) return cookie

  const browserLang = request.headers
    .get('accept-language')
    ?.split(',')[0]
    .split('-')[0]
    .toLowerCase()

  if (browserLang && LOCALES.includes(browserLang)) return browserLang

  return DEFAULT_LOCALE
}

export function middleware(request: NextRequest) {
  const locale = detectLocale(request)
  const response = NextResponse.next()
  response.headers.set('x-locale', locale)
  return response
}

export const config = {
  matcher: ['/((?!_next|api|.*\\..*).*)'],
}
