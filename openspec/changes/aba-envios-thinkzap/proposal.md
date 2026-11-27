# Proposal

## Why

Depois das etapas 1 e 2 de `status-entrega-envios-thinkzap`, cada envio por widget ou robô do Bizproc guarda o status (Enviado, Entregue, Lido, Falhou com motivo), mas só se enxerga isso no comentário do registro do CRM e no sino do Bitrix. Não há um lugar para consultar os envios: quem quer saber "o que aconteceu com as mensagens de ontem" ou "por que aquela falhou" precisa abrir registro por registro. O caso que originou o trabalho foi um cliente com mensagens recusadas pela Meta sem retorno; a consulta fecha esse ciclo, e o histórico já é guardado por 90 dias para isso.

## What Changes

- Nova aba **Envios** no ThinkZap (`/thinkzap/envios`), com item no menu visível a todo usuário com acesso ao app.
- A aba lista os envios por widget e por robô do Bizproc, **uma linha por destinatário de cada disparo**, do mais recente para o mais antigo, com paginação no servidor. Colunas: data e hora, linha, destinatário, tipo (texto, template, anexo, botões), origem (widget ou robô), remetente e status. A falha mostra o motivo traduzido.
- Filtros: período (padrão 7 dias, máximo 90), status, linha e destinatário.
- Detalhe em painel lateral: texto, template e idioma, horários (enviado, entregue, lido, recusado), motivo com o código da Meta, partes (anexos) do envio e link para o registro do CRM.
- **Visibilidade:** o administrador do ThinkZap vê todos os envios da instalação; os demais usuários com acesso só os que fizeram. Envios de robô sem usuário só aparecem para o administrador. O filtro vale também no detalhe.
- API nova, somente leitura: lista e detalhe, atrás do `thinkzapAccessMiddleware`; a instalação e o usuário saem sempre do token. Os nomes dos remetentes são resolvidos no Bitrix, em lote e sem derrubar a lista.
- Migration aditiva com índices para a consulta (por instalação e data, e por instalação, remetente e data).
- Textos em pt, en e es. O motivo da falha sai no idioma da instalação, com as mesmas frases do comentário do CRM.

Fora do escopo: reenvio ou reprocessamento, exportação, nova permissão nas configurações, campanha de SMS, resposta do operador no canal aberto, bot, envio síncrono (sem registro no outbox), grupos de acesso por linha e o status da Z-API (continua em "Enviado" até haver evento).

## Capabilities

### New Capabilities

- `thinkzap/aba-envios`: consulta, na aplicação, dos envios por widget e robô do Bizproc: lista, filtros, detalhe, status e motivo da falha, histórico de 90 dias e visibilidade por perfil.

### Modified Capabilities

Nenhuma. As capacidades de status do envio (comentário do CRM, notificação, Entregue e Lido) vivem na change `status-entrega-envios-thinkzap`, que ainda não foi arquivada e não tem spec principal; esta aba apenas lê esses dados. Se aquela change for arquivada antes, reavaliar se algum requisito aqui vira delta dela.

## Impact

- **Banco:** migration aditiva com dois índices em `core_thinkerszap_widget_outbox`; sem colunas novas, sem alterar migration existente.
- **API (`modules/thinkzap`):** repositório de consulta do outbox, casos de uso de lista e detalhe, controllers e rotas após o `thinkzapAccessMiddleware`; reaproveita o texto do motivo da falha (`describeSendFailure`) e a referência do registro do CRM (`crmRecordReference`).
- **Front:** página `app/(thinkzap)/thinkzap/envios`, item em `thinkzap-aside-config.ts`, cliente HTTP em `_lib`, traduções em `messages/{pt,en,es}/thinkzap`.
- **Privacidade:** a aba expõe texto de mensagem e telefone de contatos; por isso o filtro por usuário é aplicado no servidor e coberto por teste, e nada disso vai para log.
- **Dependência:** requer as etapas 1 e 2 de `status-entrega-envios-thinkzap` (já na `develop`).
