# Proposal

## Why

O backoffice já tem a tela "Falhas de envio" (`/admin/falhas-envio`, change `resiliencia-envio-fila-linha`): lista as falhas da fila de saída, filtra, mostra o detalhe e reprocessa. Ela deixa quatro lacunas para o suporte:

- **Recebimento não tem nada.** Quando uma mensagem recebida (Z-API, HubMessage, Bitrix) esgota as 3 tentativas da fila `thinkzap-inbound`, a falha só fica no Redis por 7 dias e no log. Não há tela, e para reprocessar é preciso mexer no Redis.
- **Não há log de tentativas.** A fila de saída guarda só um contador (`attempts`) e o último erro (`lastError`, texto cru, sobrescrito a cada tentativa). Não dá para ver o que aconteceu em cada tentativa nem o código de erro.
- **Nada é expurgado.** A lista tem padrão de 7 dias e teto de 90, mas as linhas ficam no banco, com texto e destino das mensagens (dado pessoal).
- **Não há visão por cliente.** A tela filtra por nome de portal, mas a página do cliente em `admin/clientes` não mostra as falhas dele.

## What Changes

- **Falhas de recebimento persistidas e listadas.**
  - Só a falha final (tentativas esgotadas) da fila `thinkzap-inbound` é gravada no banco; sucesso e falha com nova tentativa pela frente não geram linha.
  - A linha guarda origem (`source`), tipo, `traceKey`, portal/instância quando der para identificar, erro e o payload do evento, necessário para reprocessar.
  - A tela "Falhas" ganha uma aba "Recebimento", com os mesmos filtros (portal, período) e o filtro de origem.
- **Reprocessar recebimento.** A mensagem recoloca o evento na fila de entrada. Só é permitido para origens cuja reentrega foi verificada como idempotente; as demais aparecem como "não reprocessável".
- **Log de tentativas por item (só de falhas).** Cada tentativa que falha, de envio ou de recebimento, grava uma linha com número da tentativa, `errorCode`, mensagem, duração e horário. O detalhe do item mostra a linha do tempo. Tentativa bem-sucedida não grava nada.
- **Retenção de 7 dias.**
  - Um job diário apaga, em lotes, as falhas de recebimento, o log de tentativas e as linhas de envio em `FAILED`/`UNKNOWN` com mais de 7 dias.
  - O prazo é configurável por env (padrão 7) e o teto do período da lista passa a ser o prazo de retenção.
  - O reprocessamento de item expirado deixa de existir: a tela avisa o prazo.
- **Visão por cliente.** A página do cliente em `admin/clientes` ganha a seção "Falhas de mensagens" (envio e recebimento) filtrada pelo portal dele, com link para a tela geral já filtrada.
- Gravação do log e das falhas é best-effort: erro ao gravar nunca derruba o envio nem o recebimento.
- **Não muda:** regras de envio (cadência, limite diário, tentativas), o reprocessamento de envio já existente e a confirmação de risco de duplicidade.

## Capabilities

### New Capabilities

- `thinkzap/admin-falhas-recebimento`: persistência, listagem, detalhe e reprocessamento das mensagens recebidas que falharam, na aba "Recebimento" da tela de falhas.
- `thinkzap/log-tentativas-falha`: registro e exibição, por item, das tentativas que falharam, no envio e no recebimento.
- `thinkzap/retencao-falhas`: prazo de guarda (7 dias), expurgo em lote e seus efeitos na tela.
- `portal-admin/falhas-na-pagina-do-cliente`: seção de falhas de mensagens dentro da página do cliente do backoffice.

### Modified Capabilities

Nenhuma. A tela "Falhas de envio" (`thinkzap/admin-falhas-envio`) ainda está só na change `resiliencia-envio-fila-linha`, que não foi arquivada, então não há spec principal para alterar. As mudanças nessa tela (aba, detalhe com tentativas, aviso de retenção) estão descritas nas capabilities novas. Se aquela change for arquivada antes desta, rever se os requisitos viram deltas dela.

## Impact

- **Banco:** migration aditiva com duas tabelas novas (falhas de recebimento e log de tentativas) e índices em `created_at`; sem alterar migration existente. A limpeza apaga linhas de `core_thinkerszap_widget_outbox` em `FAILED`/`UNKNOWN`, nunca as demais.
- **API, workers:** `thinkzap-inbound.worker.ts` (captura da falha final) e `dispatch-widget-outbox-message.ts` (tentativa que falhou). Novo código de erro no catálogo, com runbook em `mcp/kb/` (exige redeploy do MCP).
- **API, portal:** novas rotas atrás de `portalAuthMiddleware` (lista, detalhe e reprocesso de recebimento; tentativas no detalhe de envio; filtro por portal exato) e job de limpeza em `shared/infra/scheduler/`, registrado no `app.ts`.
- **Env:** `FAILURE_RETENTION_DAYS` e a flag do job de limpeza, em `config/env.ts` e `api/.env.example`, e nos compose de staging e produção.
- **Front:** aba "Recebimento" e tentativas no detalhe da tela de falhas, seção na página do cliente, cliente HTTP em `front/lib/`, traduções em `front/messages/{pt,en,es}/admin`.
- **Privacidade:** o payload de recebimento guarda dado pessoal; fica limitado a 7 dias e nunca é copiado para log.
- **Dependência:** estende a change `resiliencia-envio-fila-linha`, já presente no código da `develop`.
