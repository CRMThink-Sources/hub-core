'use client'

import { StatusBanner } from '../_components/status-banner'
import { OperatorOAuthPrompt } from '../_features/auth/operator-oauth-prompt'
import { AudioPreviewPanel } from '../_features/playback/audio-preview-panel'
import { useAudioPlayback } from '../_features/playback/use-audio-playback'
import { RecordControls } from '../_features/recording/record-controls'
import { useAudioRecorder } from '../_features/recording/use-audio-recorder'
import { useAudioUpload } from '../_features/upload/use-audio-upload'
import { useAudioWidgetContext } from './audio-widget-provider'

function AudioWidgetSkeleton() {
  return (
    <div className="mx-auto w-full rounded-xl border border-slate-200 bg-white/90 p-4 shadow-sm backdrop-blur">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 animate-pulse rounded-full bg-slate-200" />
        <div className="h-4 w-32 animate-pulse rounded bg-slate-200" />
      </div>
      <p className="mt-3 text-xs text-slate-500">Carregando...</p>
    </div>
  )
}

export function AudioWidgetView() {
  const {
    mounted,
    dialogId,
    domain,
    imbotAuth,
    accessToken,
    canUpload,
    thinkzapAppCode,
    uploadEndpoint,
  } = useAudioWidgetContext()

  const playback = useAudioPlayback()
  const recorder = useAudioRecorder()

  const upload = useAudioUpload({
    endpoint: uploadEndpoint,
    dialogId,
    domain,
    imbotAuth,
    accessToken,
    canUpload,
    onSuccess: () => {
      recorder.clearRecording()
      playback.resetPlayback()
    },
  })

  if (!mounted) {
    return <AudioWidgetSkeleton />
  }

  const displayError =
    recorder.error ??
    upload.error ??
    (!canUpload
      ? 'Abra o widget pelo painel do chat no Bitrix24 (Canais Abertos).'
      : null)

  const handleToggleRecording = () => {
    if (!recorder.isRecording) {
      upload.resetSent()
      playback.resetPlayback()
    }
    recorder.toggleRecording()
  }

  const handleDelete = () => {
    recorder.clearRecording()
    playback.resetPlayback()
    upload.resetSent()
  }

  const handleSend = () => {
    void upload.sendAudio(recorder.audioBlob)
  }

  return (
    <div className="mx-auto w-full rounded-xl border border-slate-200 bg-white/90 p-4 shadow-sm backdrop-blur">
      <RecordControls
        isRecording={recorder.isRecording}
        buttonScale={recorder.buttonScale}
        elapsedSeconds={recorder.recordingElapsedSeconds}
        onToggle={handleToggleRecording}
      />

      {upload.isSent ? (
        <StatusBanner variant="success" message="Audio enviado com sucesso!" />
      ) : null}

      {displayError ? (
        <StatusBanner variant="error" message={displayError} />
      ) : null}

      {upload.needsOperatorOAuth && domain ? (
        <OperatorOAuthPrompt domain={domain} appCode={thinkzapAppCode} />
      ) : null}

      {recorder.audioUrl ? (
        <AudioPreviewPanel
          audioRef={playback.audioRef}
          audioUrl={recorder.audioUrl}
          isPlaying={playback.isPlaying}
          isSending={upload.isSending}
          duration={playback.duration}
          currentTime={playback.currentTime}
          fallbackDurationSeconds={recorder.recordedDurationSeconds}
          blobSize={recorder.audioBlob?.size}
          onLoadedMetadata={playback.onLoadedMetadata}
          onTimeUpdate={playback.onTimeUpdate}
          onPlay={playback.onPlay}
          onPause={playback.onPause}
          onEnded={playback.onEnded}
          onTogglePlayback={playback.togglePlayback}
          onSeek={playback.handleSeek}
          onDelete={handleDelete}
          onSend={handleSend}
        />
      ) : null}
    </div>
  )
}
