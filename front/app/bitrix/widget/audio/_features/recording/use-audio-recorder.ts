'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

const RECORDING_TIMESLICE_MS = 1000

const MIME_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/ogg;codecs=opus',
] as const

function resolveRecorderMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined
  for (const mime of MIME_CANDIDATES) {
    if (MediaRecorder.isTypeSupported(mime)) return mime
  }
  return undefined
}

function resolveMicrophoneError(err: unknown): string {
  if (err instanceof DOMException) {
    if (err.name === 'NotAllowedError') {
      return 'Permissao de microfone negada. Autorize no navegador ou nas configuracoes do Bitrix24.'
    }
    if (err.name === 'NotFoundError') {
      return 'Nenhum microfone encontrado.'
    }
  }
  return 'Nao foi possivel acessar o microfone.'
}

export function useAudioRecorder() {
  const [isRecording, setIsRecording] = useState(false)
  const [buttonScale, setButtonScale] = useState(1)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [error, setError] = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const audioContextRef = useRef<AudioContext | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const audioUrlRef = useRef<string | null>(null)
  const recorderMimeTypeRef = useRef<string>('audio/webm')

  const stopVolumeAnimation = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }

    if (audioContextRef.current) {
      void audioContextRef.current.close()
      audioContextRef.current = null
    }

    setButtonScale(1)
  }, [])

  const revokeAudioUrl = useCallback(() => {
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current)
      audioUrlRef.current = null
    }
  }, [])

  const clearRecording = useCallback(() => {
    revokeAudioUrl()
    setAudioUrl(null)
    setAudioBlob(null)
  }, [revokeAudioUrl])

  const startRecording = useCallback(async () => {
    try {
      setError(null)

      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Seu navegador nao suporta captura de audio.')
        return
      }

      clearRecording()

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = resolveRecorderMimeType()
      recorderMimeTypeRef.current = mimeType ?? 'audio/webm'

      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream)

      const audioContext = new AudioContext()
      const source = audioContext.createMediaStreamSource(stream)
      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 2048
      analyser.smoothingTimeConstant = 0.15
      const dataArray = new Uint8Array(analyser.fftSize)

      source.connect(analyser)
      audioContextRef.current = audioContext

      const updateVolume = () => {
        analyser.getByteTimeDomainData(dataArray)

        let sum = 0
        for (let i = 0; i < dataArray.length; i += 1) {
          const centered = (dataArray[i] - 128) / 128
          sum += centered * centered
        }

        const rms = Math.sqrt(sum / dataArray.length)
        const normalized = Math.max(0, (rms - 0.015) / 0.12)
        const clamped = Math.min(1, normalized)
        const nextScale = 1 + clamped * 0.55
        setButtonScale(prev => prev + (nextScale - prev) * 0.45)

        animationFrameRef.current = requestAnimationFrame(updateVolume)
      }

      animationFrameRef.current = requestAnimationFrame(updateVolume)

      mediaStreamRef.current = stream
      mediaRecorderRef.current = recorder
      audioChunksRef.current = []

      recorder.ondataavailable = event => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      recorder.onstop = () => {
        const blobType =
          recorder.mimeType || recorderMimeTypeRef.current || 'audio/webm'
        const recordedAudioBlob = new Blob(audioChunksRef.current, {
          type: blobType,
        })
        const url = URL.createObjectURL(recordedAudioBlob)
        audioUrlRef.current = url
        setAudioBlob(recordedAudioBlob)
        setAudioUrl(url)

        mediaStreamRef.current?.getTracks().forEach(track => track.stop())
        mediaStreamRef.current = null
        mediaRecorderRef.current = null
        stopVolumeAnimation()
      }

      recorder.start(RECORDING_TIMESLICE_MS)
      setIsRecording(true)
    } catch (err) {
      console.error(err)
      setError(resolveMicrophoneError(err))
      setIsRecording(false)
    }
  }, [clearRecording, stopVolumeAnimation])

  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current
    if (!recorder || recorder.state === 'inactive') return

    recorder.stop()
    setIsRecording(false)
  }, [])

  const toggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecording()
      return
    }

    void startRecording()
  }, [isRecording, startRecording, stopRecording])

  useEffect(() => {
    return () => {
      stopVolumeAnimation()
      revokeAudioUrl()
      mediaStreamRef.current?.getTracks().forEach(track => track.stop())
      mediaStreamRef.current = null
      const recorder = mediaRecorderRef.current
      if (recorder && recorder.state !== 'inactive') {
        try {
          recorder.stop()
        } catch {
          // ignore if already stopped
        }
      }
      mediaRecorderRef.current = null
    }
  }, [revokeAudioUrl, stopVolumeAnimation])

  return {
    isRecording,
    buttonScale,
    audioUrl,
    audioBlob,
    error,
    setError,
    toggleRecording,
    clearRecording,
  }
}
