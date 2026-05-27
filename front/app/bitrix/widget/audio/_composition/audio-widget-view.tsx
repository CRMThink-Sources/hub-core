'use client'

import { StatusBanner } from '../_components/status-banner'
import { OperatorOAuthPrompt } from '../_features/auth/operator-oauth-prompt'
import { AudioPreviewPanel } from '../_features/playback/audio-preview-panel'
import { useAudioPlayback } from '../_features/playback/use-audio-playback'
import { RecordControls } from '../_features/recording/record-controls'
import { useAudioRecorder } from '../_features/recording/use-audio-recorder'
import { useAudioUpload } from '../_features/upload/use-audio-upload'
import { useAudioWidgetContext } from './audio-widget-provider'

export function AudioWidgetView() {
  const { dialogId, domain, imbotAuth, thinkzapAppCode, uploadEndpoint } =
    useAudioWidgetContext()

  const playback = useAudioPlayback()
  const recorder = useAudioRecorder()

  const upload = useAudioUpload({
    endpoint: uploadEndpoint,
    dialogId,
    domain,
    imbotAuth,
    onSuccess: () => {
      recorder.clearRecording()
      playback.resetPlayback()
    },
  })

  const displayError =
    recorder.error ??
    upload.error ??
    (!imbotAuth
      ? 'Abra o widget pelo iframe imbot do Bitrix24 (Open Lines).'
      : null)

  const handleToggleRecording = () => {
    if (!recorder.isRecording) {
      upload.resetSent()
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
