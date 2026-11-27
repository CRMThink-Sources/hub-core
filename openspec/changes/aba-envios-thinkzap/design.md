# Design

## Context

- O outbox (`core_thinkerszap_widget_outbox`) já guarda tudo que a aba mostra: destino, texto, template, origem, remetente (`operator_bitrix_user_id`), linha (`subscription_item_id`), grupo do disparo (`dispatch_group_id`, `part_index`), estado da fila, `rejected_at`, `failure_code`, `failure_reason`, `delivered_at` e `read_at` (etapas 1 e 2). O histórico dos envios rastreados fica 90 dias.
- O status por destinatário já é regra pura: `summarizeRecipients` (`domain/send-notice.ts`). O motivo da falha já é traduzido por `describeSendFailure` (`application/helpers/send-failure.ts`), e o registro do CRM tem `crmRecordReference`.
- Um disparo de robô ou um envio com anexo gera **várias rows** por destinatário (uma por parte), todas com o mesmo `dispatch_group_id`. Um envio simples (texto, template, botões do widget) é uma row sem grupo.
- Acesso: `thinkzapAccessMiddleware` já preenche `req.thinkzapAccess` (`canManageAccess` = administrador), `req.bitrixUserId`, `req.domainId` e `req.appId`. O front esconde itens do menu em `app/(thinkzap)/layout.tsx` e tem padrão de abas, tabela e painel (`components/ui/sheet`, `select`, `input`).
- Hoje não há índice que sirva a uma consulta por instalação e data: os existentes são `(status, created_at)`, `(dispatch_group_id)`, `(instance_id, provider_message_id)` e `(send_notice_id)`.
- Linhas Z-API não recebem evento de entrega por mensagem: ficam em Enviado.

## Goals / Non-Goals

**Goals:**
- Consultar os envios por widget e robô, por destinatário, com status e motivo da falha, em 90 dias.
- Visibilidade por perfil aplicada no servidor, inclusive no detalhe.
- Lista rápida e paginada, sem trazer o disparo inteiro para a memória.

**Non-Goals:**
- Reenvio, reprocessamento, exportação, nova permissão, edição de qualquer dado.
- Campanha de SMS, resposta do operador, bot e envio síncrono (sem row no outbox).
- Grupos de acesso por linha como regra de visibilidade (a regra escolhida é por perfil).
- Status de entrega da Z-API.
- Alterar o link da notificação do sino para apontar para a aba (acompanhamento futuro).

## Decisions

### 1. Uma linha por destinatário de cada disparo, calculada no banco

A unidade da lista é `(COALESCE(dispatch_group_id, id), destination)`. A consulta agrupa as rows rastreadas dessa forma e devolve, por grupo: o id da primeira parte (o "id do envio" que o detalhe usa), a data mais antiga, e agregados que reproduzem as regras de `summarizeRecipients` (tem falha, tem sem confirmação, tem parte na fila, todas lidas, todas entregues ou lidas). O estado exibido sai de um `CASE` sobre esses agregados, usado **só para filtrar e contar**; as partes da página são então lidas e o estado mostrado é recalculado por `summarizeRecipients`, que é a fonte da verdade.

- **Alternativa descartada, coluna `display_status` no outbox:** acopla toda transição de estado a um segundo campo e exige backfill; um erro de atualização mostraria status errado de forma persistente.
- **Alternativa descartada, paginar rows e agrupar na aplicação:** quebra a paginação e a contagem quando um destinatário tem várias partes.
- **Consulta:** `$queryRaw` parametrizado (nunca interpolação) para os ids da página e para o total; a leitura das partes da página usa o cliente Prisma. O `CASE` do SQL e `summarizeRecipients` ficam lado a lado em comentário que manda alterar os dois juntos, e um teste de tabela de casos cobre `summarizeRecipients`; a equivalência com o SQL é validada em staging.

### 2. Filtros e índices

Filtro fixo: `domain_id` e `app_code` do token, origens rastreadas (as mesmas de `TRACKED_SEND_ORIGINS`) e `sms_message_id IS NULL`, e `created_at >= max(from, agora - 90 dias)`. Filtros opcionais: `status`, `subscriptionItemId` (linha), `destination` (trecho dos dígitos, comparado com a coluna normalizada), `senderId` (só administrador) e o intervalo. Período acima de 90 dias é **limitado** a 90 (não é erro), para o front não precisar tratar a recusa.

Migration aditiva com dois índices: `(domain_id, created_at)` e `(domain_id, operator_bitrix_user_id, created_at)`. Sem colunas novas.

### 3. Visibilidade aplicada no servidor, a partir do token

- Administrador (`thinkzapAccess.canManageAccess`): todos os envios da instalação, com filtro opcional por remetente.
- Demais: o `where` ganha `operator_bitrix_user_id = req.bitrixUserId`, sem exceção, e o parâmetro `senderId` é ignorado.
- Row sem `operator_bitrix_user_id` (robô sem usuário): só o administrador a vê, naturalmente.
- Detalhe: carrega a row pelo id, exige `domain_id`/`app_code` do token e, para não administrador, o remetente igual ao usuário; qualquer falha responde `404`, o mesmo de id inexistente. As partes irmãs são as rows com o mesmo grupo e destino, e herdam a mesma checagem.
- Nada de texto de mensagem ou telefone vai para log; o log registra só contagem e filtros.
- **Alternativa descartada, visibilidade por linha (grupos de acesso):** ajuda equipes que dividem a linha, mas um operador veria o texto das mensagens dos colegas; a escolha do usuário foi por perfil.

### 4. Rotas e contratos (somente leitura)

Depois do `thinkzapAccessMiddleware`, sem `requireThinkzapPermission` (qualquer usuário com acesso):

- `GET /api/thinkzap/messages/sends` — parâmetros `from`, `to`, `status`, `line`, `destination`, `senderId`, `page`, `limit` (validados com Zod; `limit` com teto). Devolve `{ items, total, page, limit, retentionDays, lines, senders }`, onde `lines` e `senders` são as opções dos filtros (administrador recebe os remetentes do período; os demais, lista vazia).
- `GET /api/thinkzap/messages/sends/:id` — o detalhe.
- Item da lista: `id`, `createdAt`, `line { id, name }`, `destination`, `kind`, `origin`, `sender { id, name }`, `status` (`WAITING | SENT | DELIVERED | READ | FAILED | PARTIAL | UNKNOWN`) e `failureReason` (já traduzido, só quando falhou).
- Detalhe: o item mais `text`, `template { name, language }`, `timestamps { sentAt, deliveredAt, readAt, rejectedAt }`, `failure { code, reason }`, `parts[]` (tipo, nome do arquivo, estado) e `crmRecord { entity, entityId, url }`.
- Os textos de status vão como código; o front traduz. O motivo da falha vai traduzido pelo servidor (idioma da instalação), reaproveitando `describeSendFailure`.

### 5. Nomes de linha e de remetente

- **Linha:** nome e provedor vêm do contexto da instalação (`getAplicationContext`, que lê os itens de assinatura); sem nome, o id da linha. Não chama a Z-API nem a HubMessage por linha.
- **Remetente:** uma chamada `user.get` em lote por página (`FILTER: { ID: [...] }`) pelo cliente Bitrix da instalação (passa por `bitrix-limits`), melhor esforço; falha ou usuário inexistente devolve `name: null`, e o front mostra um indicador neutro. Sem cache próprio no início.

### 6. Front

- Página `app/(thinkzap)/thinkzap/envios/page.tsx` (client component, como as irmãs) e item `envios` em `thinkzap-aside-config.ts`, sem filtro por permissão em `layout.tsx` (o item aparece para quem tem `canAccess`).
- Componentes: barra de filtros (período, status, linha, destinatário e, para administrador, remetente), tabela com paginação por página, painel lateral de detalhe (`sheet`), e estados de carregando, vazio e erro. Filtros e página ficam na query string (`useSearchParams`, com `Suspense`), para o link e o voltar do navegador funcionarem.
- Cliente HTTP em `_lib/` seguindo `resolveThinkzapClient`; traduções em `messages/{pt,en,es}/thinkzap/envios.json` e rótulo em `aside.json`. Data e hora no fuso e formato do usuário, como as demais telas.
- Aviso na tela: o histórico vale 90 dias, e linhas Z-API informam só "Enviado".

## Risks / Trade-offs

- **Consulta com `GROUP BY` sobre o outbox:** com 90 dias de histórico a tabela passa de centenas de milhares de linhas; os dois índices novos e o filtro obrigatório por instalação e data limitam o custo, mas o desempenho real precisa ser conferido em staging com volume. Se for pesado, limitar o período padrão ou pré-agregar.
- **Divergência entre o `CASE` do SQL e `summarizeRecipients`:** o filtro por status poderia incluir ou excluir um envio que o estado mostrado contradiz. Mitigação: regra duplicada documentada nos dois lugares, tabela de casos no teste do domínio e conferência em staging.
- **Privacidade:** a aba mostra texto e telefone. O filtro por usuário é aplicado no servidor, coberto por teste (listas e detalhe, administrador e não administrador, robô sem usuário, outra instalação), e sem texto em log.
- **Limites do Bitrix:** a resolução de nomes faz uma chamada por página; sob pausa do Bitrix a lista abre sem nomes.
- **Envios anteriores às etapas 1 e 2** não têm entregue/lido: aparecem como Enviado, o que é verdade mas não completo.
- **Envio síncrono** (outbox unificada desligada no portal): não aparece; está registrado como limite conhecido da feature.
