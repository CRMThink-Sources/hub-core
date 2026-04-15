import { useEffect, useRef } from 'react'
import { io } from 'socket.io-client'
import { envConfig } from '@/shared/infra/env-config'

export function useConnectorsSocket({
  appId,
  onDisconnected,
}: {
  appId: string
  onDisconnected: () => void
}) {
  const onDisconnectedRef = useRef(onDisconnected)
  onDisconnectedRef.current = onDisconnected

  useEffect(() => {
    if (!appId) return

    const socketUrl = new URL(envConfig.apiUrl).origin

    const socket = io(socketUrl, {
      autoConnect: false,
      path: '/api/socket.io',
    })

    socket.on('connect', () => {
      console.log('[socket] joined room:', appId)
      socket.emit('join', appId)
    })

    socket.on('connector:disconnected', (data: unknown) => {
      console.log('[socket] instance:connected', data)
      onDisconnectedRef.current?.()
    })
    socket.connect()

    return () => {
      socket.emit('leave', appId)
      socket.disconnect()
    }
  }, [appId])
}
