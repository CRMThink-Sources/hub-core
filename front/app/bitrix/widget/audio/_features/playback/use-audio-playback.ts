'use client'

import { sanitizeAudioDuration } from '@/app/bitrix/widget/audio/_lib/format-audio-time'
import { useRef, useState } from 'react'

export function useAudioPlayback() {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)

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

  const resetPlayback = () => {
    const audio = audioRef.current
    if (audio) {
      audio.pause()
      audio.currentTime = 0
    }

    setIsPlaying(false)
    setCurrentTime(0)
    setDuration(0)
  }

  return {
    audioRef,
    isPlaying,
    duration,
    currentTime,
    togglePlayback,
    handleSeek,
    resetPlayback,
    onLoadedMetadata: (durationValue: number) =>
      setDuration(sanitizeAudioDuration(durationValue)),
    onTimeUpdate: (timeValue: number) => setCurrentTime(timeValue),
    onPlay: () => setIsPlaying(true),
    onPause: () => setIsPlaying(false),
    onEnded: () => setIsPlaying(false),
  }
}
