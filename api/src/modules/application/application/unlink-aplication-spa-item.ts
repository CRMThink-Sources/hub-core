import { AplicationRepository } from '@/modules/application/domain/repositories/aplication.repository'
import { apiLogger } from '@/shared/infra/logger'

/**
 * Desvincula a instalação cujo espelho na SPA 1060 foi apagado.
 *
 * O evento traz o id do **item**, não o da instalação, então a resolução passa por
 * `getAplicationBySpaId`. Item sem instalação correspondente é o caso comum — item
 * criado e apagado à mão no CRM não espelha nada —, e por isso é `debug`, não `warn`:
 * um aviso por exclusão manual treinaria o leitor a ignorar a linha.
 *
 * O log do desvínculo efetivo traz instalação, `spa_id` anulado e domínio porque o
 * sintoma que chega ao suporte é "a tela de linhas ficou vazia", e este é o único lugar
 * que liga esse sintoma à exclusão.
 *
 * **Nunca apaga a linha de `core_apps`.** Ver `unlinkSpaItem` no repositório: o item da
 * SPA é espelho de CRM, e deletar a instalação a partir de um evento de CRM inverteria
 * a direção da verdade.
 */
export class UnlinkAplicationSpaItem {
  constructor(private readonly aplications: AplicationRepository) {}

  async execute(spaId: string): Promise<void> {
    const aplication = await this.aplications.getAplicationBySpaId(spaId)

    if (!aplication) {
      apiLogger.debug(
        { app: 'payments', spaId },
        'Item apagado na SPA de aplicação não espelha instalação nenhuma — nada a desvincular',
      )
      return
    }

    await this.aplications.unlinkSpaItem(aplication.id)

    apiLogger.info(
      {
        app: 'payments',
        aplicationId: aplication.id,
        spaId,
        domain: aplication.customer.name,
        appCode: aplication.appCode,
      },
      'Espelho da instalação desvinculado — o item da SPA 1060 foi apagado no CRM',
    )
  }
}
