# Implantação — Novidades do ThinkZap

Roteiro para subir a change `novidades-thinkzap`. A ordem importa: banco e código primeiro com a sincronização desligada, depois o Bitrix, e só então a flag.

## 1. Banco

- A migration `api/prisma/migrations/20261029120000_add_thinkzap_product_updates/` é aditiva: só cria a tabela `thinkzap_product_updates`, com FKs para `portal_users`.
- Ela sobe pelo fluxo normal de deploy (`prisma migrate deploy`) e pode ir antes do código.
- Ela ainda não foi aplicada em nenhum banco. Rodar uma vez localmente com `yarn prisma migrate dev` antes do PR, para conferir.

## 2. Variáveis de ambiente (API e workers)

| Variável | Homologação | Produção | Observação |
|---|---|---|---|
| `CRMTHINK_TASKS_SYNC_ENABLED` | `false` | `true` (só no passo 4) | Desligada: não cria, conclui nem reabre tarefas, ignora o webhook e não agenda a reconciliação. Buscar e vincular continuam funcionando. |
| `CRMTHINK_TASKS_GROUP_ID` | `2677` | `2677` | Projeto "Produtos \| Desenvolvimento e Sustentação". |
| `CRMTHINK_TASKS_WEBHOOK_TOKEN` | vazio ou token | token do passo 3 | Vazio faz o webhook responder `503`. |
| `FRONT_URL` (já existe) | — | — | Usado no link da novidade gravado na descrição da tarefa criada. |

Homologação e produção usam o **mesmo** portal da CRMThink. Por isso a flag fica desligada em homologação: lá, vincular uma tarefa só grava o ID no banco de homologação.

O R2 usa as variáveis `R2_*` que já existem (mesmo bucket), com o prefixo novo `product-updates/`. Esse prefixo não pode entrar na regra de expiração do bucket (hoje restrita a `template-headers/`).

## 3. Portal Bitrix24 da CRMThink

1. **Webhook de entrada** (`CRMTHINK_WEBHOOK_URL`): incluir os escopos **`task`** e **`user`**, mantendo os atuais.
2. **Permissão do usuário dono do webhook**:
   - precisa ver, criar, concluir e reabrir tarefas no grupo 2677, ou seja, ser membro do projeto;
   - precisa poder concluir tarefas em que não é o responsável.

   Sem isso, as ações respondem `502` com a mensagem do Bitrix.
3. **Webhook de saída** (Aplicativos → Desenvolvedores → Outros → Webhook de saída):
   - URL: `https://<api>/api/webhooks/crmthink-tasks`;
   - eventos: **Atualização de tarefa (`ONTASKUPDATE`)** e **Exclusão de tarefa (`ONTASKDELETE`)**;
   - copiar o *token de aplicação* gerado para `CRMTHINK_TASKS_WEBHOOK_TOKEN`.

   O endpoint recebe eventos de todas as tarefas do portal. Ele ignora em poucos milissegundos as que não estão vinculadas a uma novidade.

## 4. Processos

- **API (`app.ts`):**
  - monta `/api/portal/novidades` e `/api/webhooks/crmthink-tasks`;
  - inicia a reconciliação horária (minuto 15, com lock em Redis), só com a flag ligada.
- **Worker `worker:spa-resource-sync`:** passa a consumir também a fila `crmthink-task-sync`. Reiniciar esse processo no deploy; não há serviço docker novo.
- Depois de configurar o passo 3, ligar `CRMTHINK_TASKS_SYNC_ENABLED=true` em produção e reiniciar a API e o worker.

## 5. Validação em produção (tarefa 10.3)

- [ ] Criar uma novidade de teste, vincular uma tarefa de teste do grupo 2677 e concluí-la no Bitrix: a novidade fica "Aguardando revisão" em segundos.
- [ ] Publicar como disponível: ela aparece em "Já disponível" no ThinkZap, nos três idiomas.
- [ ] Criar uma tarefa pelo backoffice escolhendo o responsável: a tarefa aparece no grupo 2677 com o link da novidade.
- [ ] Marcar como concluída pelo backoffice: a tarefa fica concluída no Bitrix.
- [ ] Repetir com uma tarefa que exige aprovação do criador: o backoffice mostra "aguardando aprovação no Bitrix"; após aprovar no Bitrix, a novidade conclui.
- [ ] Reabrir a tarefa no Bitrix antes de disponibilizar: a novidade volta para "Em breve".
- [ ] Excluir a tarefa no Bitrix: a novidade fica sem vínculo e mantém a situação.
- [ ] Despublicar a novidade de teste ao final.

## Rollback

- Desligar `CRMTHINK_TASKS_SYNC_ENABLED` para parar toda a sincronização.
- Remover o item do menu do ThinkZap (`thinkzap-aside-config.ts`) para esconder a aba.
- A tabela pode ficar no banco.
