import {
  downloadRobotFile,
  type DownloadedRobotFile,
} from './robot-files/fetch-robot-files'

/**
 * Teto por anexo da resposta do operador: o máximo de vídeo que a Z-API aceita. É
 * separado do teto do robô (30 MB) — usá-lo aqui recusava vídeos comuns de celular
 * e derrubava a mensagem inteira, com as fotos junto.
 */
export const OPERATOR_MEDIA_MAX_BYTES = 100 * 1024 * 1024

/** Baixa o anexo do canal aberto antes de guardá-lo para a fila de saída. */
export function downloadOperatorMedia(
  url: string,
): Promise<DownloadedRobotFile> {
  return downloadRobotFile(url, OPERATOR_MEDIA_MAX_BYTES)
}
