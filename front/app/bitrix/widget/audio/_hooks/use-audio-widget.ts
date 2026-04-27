'use client'

import { useEffect, useRef, useState } from 'react'

type UseAudioWidgetParams = {
  dialogId: string | null
  uploadEndpoint: string
  domain: string | null
}

export function useAudioWidget({
  dialogId,
  uploadEndpoint,
  domain,
}: UseAudioWidgetParams) {
  const [isRecording, setIsRecording] = useState(false)
  const [buttonScale, setButtonScale] = useState(1)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [isSent, setIsSent] = useState(false)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const audioContextRef = useRef<AudioContext | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const clearCurrentAudio = () => {
    const audio = audioRef.current
    if (audio) {
      audio.pause()
      audio.currentTime = 0
    }

    if (audioUrl) {
      URL.revokeObjectURL(audioUrl)
    }

    setAudioUrl(null)
    setAudioBlob(null)
    setIsPlaying(false)
    setCurrentTime(0)
    setDuration(0)
    setIsSent(false)
  }

  const stopVolumeAnimation = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }

    if (audioContextRef.current) {
      void audioContextRef.current.close()
      audioContextRef.current = null
    }

    setButtonScale(1)
  }

  const startRecording = async () => {
    try {
      setError(null)
      setIsSent(false)

      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Seu navegador nao suporta captura de audio.')
        return
      }

      clearCurrentAudio()

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
  }

  const stopRecording = () => {
    const recorder = mediaRecorderRef.current
    if (!recorder || recorder.state === 'inactive') return

    recorder.stop()
    setIsRecording(false)
  }

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording()
      return
    }

    void startRecording()
  }

  const togglePlayback = () => {
    const audio = audioRef.current
    if (!audio) return

    if (audio.paused) {
      void audio.play()
      return
    }

    audio.pause()
  }

  const handleSeek = (value: number) => {
    const audio = audioRef.current
    if (!audio) return

    audio.currentTime = value
    setCurrentTime(value)
  }

  const handleSendAudio = async () => {
    if (!audioBlob) {
      console.warn('Nenhum audio para enviar')
      return
    }

    try {
      setError(null)
      setIsSending(true)

      const formData = new FormData()
      formData.append('audio', audioBlob, `audio-${Date.now()}.webm`)
      if (dialogId) {
        formData.append('dialogId', dialogId)
      }
      if (domain) {
        formData.append('domain', domain)
      }

      const response = await fetch(uploadEndpoint, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error(`Falha no upload do audio: ${response.status}`)
      }

      clearCurrentAudio()
      setIsSent(true)
    } catch (err) {
      console.error(err)
      setError('Nao foi possivel enviar o audio.')
    } finally {
      setIsSending(false)
    }
  }

  useEffect(() => {
    return () => {
      stopVolumeAnimation()
      clearCurrentAudio()
    }
  }, [])

  return {
    audioRef,
    audioBlob,
    isRecording,
    buttonScale,
    audioUrl,
    isPlaying,
    isSending,
    isSent,
    duration,
    currentTime,
    error,
    toggleRecording,
    togglePlayback,
    handleSeek,
    handleSendAudio,
    handleDeleteAudio: clearCurrentAudio,
    onAudioLoadedMetadata: (durationValue: number) =>
      setDuration(durationValue || 0),
    onAudioTimeUpdate: (timeValue: number) => setCurrentTime(timeValue),
    onAudioPlay: () => setIsPlaying(true),
    onAudioPause: () => setIsPlaying(false),
    onAudioEnded: () => setIsPlaying(false),
  }
}
