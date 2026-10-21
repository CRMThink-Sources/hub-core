'use client'

import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import type { CadenceQueueListing } from '@/app/hooks/use-line-api'
import {
  FILA_PAGE_SIZE,
  conteudoDe,
  horaDe,
  intervaloDe,
  origemKey,
  temAnterior,
  temProxima,
} from './fila-cadencia'

/**
 * As mensagens que aguardam na fila da linha, na ordem em que vão sair, de 10 em
 * 10. Só leitura: não há ação sobre as mensagens.
 */
export function FilaAguardando({
  fila,
  onPagina,
  carregando,
}: {
  fila: CadenceQueueListing
  /** Abre a página que começa no `offset` (0 = cabeça da fila). */
  onPagina: (offset: number) => void
  carregando: boolean
}) {
  const { t } = useTranslation('thinkzap/configuracoes/limites')
  const intervalo = intervaloDe(fila)

  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[640px] text-left text-sm">
          <caption className="sr-only">{t('cadenciador.fila.titulo')}</caption>
          <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium">
                {t('cadenciador.fila.colunas.posicao')}
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                {t('cadenciador.fila.colunas.origem')}
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                {t('cadenciador.fila.colunas.destinatario')}
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                {t('cadenciador.fila.colunas.conteudo')}
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                {t('cadenciador.fila.colunas.entrada')}
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                {t('cadenciador.fila.colunas.previsao')}
              </th>
            </tr>
          </thead>
          <tbody>
            {fila.messages.map(item => {
              const conteudo = conteudoDe(item)
              return (
                <tr
                  key={`${item.position}-${item.enqueuedAt}-${item.destination}`}
                  className="border-t border-border"
                >
                  <td className="px-3 py-2 tabular-nums text-muted-foreground">
                    {item.position}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    {t(origemKey(item))}
                    {item.operatorName && (
                      <span className="text-muted-foreground">
                        {' · '}
                        {item.operatorName}
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 tabular-nums">
                    {item.destination}
                  </td>
                  <td className="max-w-[280px] truncate px-3 py-2">
                    {conteudo.midiaKey && (
                      <span className="text-muted-foreground">
                        📎 {t(conteudo.midiaKey)}
                        {conteudo.texto ? ' · ' : ''}
                      </span>
                    )}
                    {conteudo.texto}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 tabular-nums">
                    {horaDe(item.enqueuedAt)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 tabular-nums">
                    {item.waitUntil !== null
                      ? horaDe(item.waitUntil)
                      : t('cadenciador.fila.semPrevisao')}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm tabular-nums text-muted-foreground">
          {t('cadenciador.fila.intervalo', intervalo)}
        </p>
        {/* Só com mais de uma página: com 10 ou menos, os botões não levam a nada. */}
        {intervalo.total > FILA_PAGE_SIZE && (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!temAnterior(fila) || carregando}
              onClick={() => onPagina(Math.max(0, fila.offset - fila.limit))}
            >
              {t('cadenciador.fila.anterior')}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!temProxima(fila) || carregando}
              onClick={() => onPagina(fila.offset + fila.limit)}
            >
              {t('cadenciador.fila.proxima')}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
