'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

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

  const clearRecording = useCallback(() => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl)
    }

    setAudioUrl(null)
    setAudioBlob(null)
  }, [audioUrl])

  const startRecording = useCallback(async () => {
    try {
      setError(null)

      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Seu navegador nao suporta captura de audio.')
        return
      }

      clearRecording()

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
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
        const recordedAudioBlob = new Blob(audioChunksRef.current, {
          type: 'audio/webm',
        })
        const url = URL.createObjectURL(recordedAudioBlob)
        setAudioBlob(recordedAudioBlob)
        setAudioUrl(url)

        mediaStreamRef.current?.getTracks().forEach(track => track.stop())
        mediaStreamRef.current = null
        mediaRecorderRef.current = null
        stopVolumeAnimation()
      }

      recorder.start()
      setIsRecording(true)
    } catch (err) {
      console.error(err)
      setError('Nao foi possivel acessar o microfone.')
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
      clearRecording()
    }
  }, [clearRecording, stopVolumeAnimation])

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
