import {
  downloadRobotFile,
  type DownloadedRobotFile,
} from './robot-files/fetch-robot-files'

/**
 * Teto por anexo da resposta do operador. A Z-API aceita vídeo de até 100 MB, mas o
 * anexo é carregado em memória (em base64 no envio) e o servidor é pequeno e
 * compartilhado: 64 MB é o limite escolhido por isso. É separado do teto do robô
 * (30 MB) — usá-lo aqui recusava vídeos comuns de celular e derrubava a mensagem
 * inteira, com as fotos junto.
 */
export const OPERATOR_MEDIA_MAX_BYTES = 64 * 1024 * 1024

/** Baixa o anexo do canal aberto antes de guardá-lo para a fila de saída. */
export function downloadOperatorMedia(
  url: string,
): Promise<DownloadedRobotFile> {
  return downloadRobotFile(url, OPERATOR_MEDIA_MAX_BYTES)
}
