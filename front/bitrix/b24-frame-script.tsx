'use client'

import { useEffect, useRef } from 'react'
import { B24JS_SDK_URL } from './b24-jssdk.types'

interface B24FrameScriptProps {
  onLoad: () => void
}

/**
 * SDK oficial para iframes do messenger (imbot.app.register).
 * @see https://apidocs.bitrix24.com/sdk/b24jssdk/iframe-messenger-textarea.html
 */
export function B24FrameScript({ onLoad }: B24FrameScriptProps) {
  const onLoadRef = useRef(onLoad)
  onLoadRef.current = onLoad
  const calledRef = useRef(false)

  useEffect(() => {
    if (typeof document === 'undefined') return

    const notify = () => {
      if (!calledRef.current) {
        calledRef.current = true
        onLoadRef.current()
      }
    }

    if (window.B24Js?.initializeB24Frame) {
      notify()
      return
    }

    const script = document.createElement('script')
    script.src = B24JS_SDK_URL
    script.async = true
    script.onload = notify
    script.onerror = notify
    document.head.appendChild(script)

    return () => {
      script.remove()
    }
  }, [])

  return null
}
