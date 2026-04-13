import { spawn } from 'child_process'

export function convertToMp3(inputBuffer: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', [
      '-i',
      'pipe:0',
      '-f',
      'mp3',
      '-acodec',
      'libmp3lame',
      '-ab',
      '128k',
      'pipe:1',
    ])

    const chunks: Buffer[] = []

    ffmpeg.stdout.on('data', (chunk: Buffer) => chunks.push(chunk))
    ffmpeg.stderr.on('data', () => {})

    ffmpeg.on('close', (code: number) => {
      if (code === 0) resolve(Buffer.concat(chunks))
      else reject(new Error(`ffmpeg exited with code ${code}`))
    })

    ffmpeg.on('error', (err: Error) => {
      reject(
        new Error(
          `Failed to spawn ffmpeg. Is it installed? Original error: ${err.message}`,
        ),
      )
    })

    ffmpeg.stdin.write(inputBuffer)
    ffmpeg.stdin.end()
  })
}
