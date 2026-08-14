import { UpdateInstanceGateway } from '@/modules/thinkzap/domain/repositories/update-instance.gateway'

/**
 * Renomeia a linha **no provider**.
 *
 * Substitui a metade de rename do antigo `UpdateInstanceSettingsUseCase`. A outra
 * metade — persistir `settings` — saiu: settings vivem no item da SPA e são
 * gravados uma vez só, por `UpdateLineSettings`. Um caso de uso chamado
 * "update settings" que não toca em settings seria mentira, daí o nome novo.
 *
 * Recebe credencial e host do portal já resolvidos. Não lê `Instance` nem
 * `core_domains`: a credencial vem de `item.metadata` e o host vem de
 * `context.customer.name`, os dois no contexto que o chamador já leu.
 *
 * **Lança.** O nome da linha passou a viver no item, e esta chamada é o espelho
 * para o painel da Z-API — mas a tolerância a falha é de quem orquestra, não
 * daqui: `UpdateLineSettings` a captura porque sabe que já gravou a fonte. Engolir
 * o erro aqui tornaria o caso de uso inútil para um chamador que precise do
 * resultado, e o nome dele diz "renomeia", não "tenta renomear".
 */
export type RenameLineOnProviderInput = {
  zApiInstanceId: string
  zApiInstanceToken: string
  /** Host do portal do cliente, usado como prefixo do nome na Z-API. */
  domainName: string
  /** Nome como o usuário digitou, sem prefixo. */
  name: string
}

export class RenameLineOnProviderUseCase {
  constructor(private readonly updateInstanceGateway: UpdateInstanceGateway) {}

  async execute(input: RenameLineOnProviderInput): Promise<void> {
    /**
     * O prefixo `"{domínio} | "` é convenção antiga e é o que `GetLineSettings`
     * remove na leitura. Manter os dois lados no mesmo formato é o que faz o
     * round-trip do nome não acumular prefixos.
     */
    await this.updateInstanceGateway.update(
      input.zApiInstanceId,
      `${input.domainName} | ${input.name}`,
      input.zApiInstanceToken,
    )
  }
}
