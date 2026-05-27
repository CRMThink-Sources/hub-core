import { convertToMp3 } from '@/shared/helpers/convert-to-mp3'

export type ConvertedRecordedAudio = {
  buffer: Buffer
  fileName: string
}

export function toMp3FileName(original?: string): string {
  const stem = (original ?? `audio-${Date.now()}`).replace(/\.[^.]+$/, '')
  return `${stem}.mp3`
}

export async function convertRecordedAudioToMp3(
  inputBuffer: Buffer,
  originalFileName?: string,
): Promise<ConvertedRecordedAudio> {
  const buffer = await convertToMp3(inputBuffer)
  return {
    buffer,
    fileName: toMp3FileName(originalFileName),
  }
}
