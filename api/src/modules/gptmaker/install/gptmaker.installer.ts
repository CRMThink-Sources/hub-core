import type { AppInstaller } from '@/shared/domain/app-installer'
import { GPTMAKER_APP_CODE_ID } from '../gptmaker.constants'

/**
 * O GPT Maker não registra nada no portal do cliente.
 *
 * Não tem robô, conector nem placement: o app abre pela aba própria do Bitrix.
 * E o handler de mensagem não é da aplicação — ele é declarado no
 * `EVENT_HANDLER` de **cada bot**, na criação dele, que acontece quando o
 * usuário vincula um agente e não na instalação.
 *
 * O installer existe vazio de propósito: sem ele não dá para distinguir "não
 * precisa registrar nada" de "esqueceram de registrar".
 */
export class GptMakerInstaller implements AppInstaller {
  readonly appCode = GPTMAKER_APP_CODE_ID

  async install(): Promise<void> {
    // Intencionalmente vazio. Ver comentário da classe.
  }
}
