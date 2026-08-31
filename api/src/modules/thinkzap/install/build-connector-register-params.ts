import { env } from '@/config/env'

const WHATSAPP_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.865 9.865 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>`

const WHATSAPP_ICON_DATA = `data:image/svg+xml;charset=US-ASCII,${encodeURIComponent(
  WHATSAPP_ICON_SVG,
)}`

/**
 * Os parâmetros de `imconnector.register` — a declaração de **o que este conector
 * sabe fazer**, e não só o cadastro dele.
 *
 * Existe como função própria porque dois caminhos precisam do mesmo corpo: a
 * instalação e o script de re-registro das instalações antigas. Montá-lo em dois
 * lugares divergiria no primeiro campo novo, e a divergência apareceria como
 * conector com ícone ou handler diferente dependendo de por onde passou.
 *
 * **O corpo vai sempre inteiro.** Re-chamar `imconnector.register` com o mesmo `ID`
 * **atualiza** o conector, e a documentação do Bitrix não garante preservar campo
 * omitido — mandar parcial arrisca zerar ícone e `PLACEMENT_HANDLER` de toda a base.
 */
export function buildConnectorRegisterParams(): Record<string, unknown> {
  return {
    ID: env.bitrix.connector.code,
    NAME: env.bitrix.connector.name,
    ICON: {
      DATA_IMAGE: WHATSAPP_ICON_DATA,
      COLOR: '#25D366',
      SIZE: '90%',
      POSITION: 'center',
    },
    PLACEMENT_HANDLER: env.bitrix.connector.url,
    CHAT_GROUP: 'N',

    /**
     * **Exclusão de mensagem do operador: ligada.**
     *
     * Sem isto o Bitrix **recusa a exclusão no servidor** — a mensagem some da tela
     * de forma otimista, o servidor reverte, e ela reaparece ao recarregar. Nenhum
     * `ONIMCONNECTORMESSAGEDELETE` é emitido, porque não houve exclusão a notificar.
     *
     * Foi o que manteve a sincronização de exclusão sem funcionar entre 2026-06 e
     * 2026-08: o código existia, o evento nunca chegava. O default do Bitrix para
     * este campo é `true`; era o nosso `'N'` que a desligava.
     */
    DEL_INTERNAL_MESSAGES: 'Y',

    /**
     * **Edição de mensagem do operador: desligada, de propósito.**
     *
     * A sincronização de edição continua descontinuada. Ligar ofereceria ao operador
     * uma edição que não propaga para o WhatsApp — controle que promete o que não
     * entrega.
     */
    EDIT_INTERNAL_MESSAGES: 'N',

    /**
     * **Exclusão de mensagem recebida: desligada.**
     *
     * O evento de exclusão do Bitrix **não dispara** para mensagem vinda do canal
     * externo, por documentação. Ligar permitiria apagar a mensagem do contato no
     * CRM sem nada acontecer no WhatsApp dele — e a mensagem continuaria no aparelho
     * de quem a enviou, que é onde ela vive.
     */
    DEL_EXTERNAL_MESSAGES: 'N',

    NEED_SIGNATURE: 'N',
  }
}
