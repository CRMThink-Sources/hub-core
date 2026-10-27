# Proposal

## Why

Em 27/10/2026, às 10:22, o portal querobombinhas perdeu 8 mensagens do canal aberto, entre elas um "Buen día". Todas ficaram com o erro "Linha não encontrada na instalação" e 0 tentativas.

A linha existia. O que aconteceu foi isto:

- o cache de 5 minutos do contexto da aplicação tinha vencido;
- a consulta ao Bitrix interno da CRMThink falhou (`Failed to list CRM items`);
- o worker de envio tratou essa instabilidade como "linha não existe" e marcou a mensagem como falha definitiva, sem usar as 3 tentativas que a fila já tem configuradas.

Para descobrir o problema foi preciso entrar por SSH e consultar o banco de produção, e para reprocessar não existe caminho nenhum. Hoje o suporte não tem como ver nem reenviar essas mensagens.

## What Changes

- **Falha ao consultar a linha deixa de ser falha definitiva.**
  - Só a linha que realmente não está mais na instalação (removida, ou item de outra assinatura) vira falha definitiva na hora.
  - Qualquer outra falha na consulta (Bitrix fora do ar, erro de rede, limite de requisições) devolve a mensagem para a fila, que tenta de novo.
  - A espera entre as tentativas aumenta para cobrir instabilidades de dezenas de segundos.
  - Se todas as tentativas se esgotarem, a mensagem vira falha definitiva com um motivo que diz o que de fato aconteceu, e o operador é avisado como hoje. Ela não pode ficar parada como pendente.
- **Cópia de reserva do cache do contexto da aplicação.**
  - Assinaturas, itens de assinatura (linhas), planos e produtos passam a guardar, além do cache de 5 minutos, uma cópia de reserva de 24 horas.
  - A cópia de reserva só é usada quando a consulta ao Bitrix falha. Com o Bitrix respondendo, nada muda: alterações e cancelamentos continuam valendo em até 5 minutos.
  - Cada uso da cópia de reserva fica registrado em log.
- **Nova tela "Falhas de envio" no portal admin** (`/admin`):
  - lista as mensagens da fila de saída com status de falha (`FAILED`) ou indeterminado (`UNKNOWN`), da mais recente para a mais antiga;
  - filtros por portal, status, origem (operador, widget, robô, bot, SMS) e período;
  - detalhe de cada mensagem: texto, destino, linha, chat do canal aberto, operador, tentativas, erro e horários;
  - ação **Reprocessar**, para uma mensagem ou várias selecionadas. A mensagem volta para a fila e passa pelas regras normais de envio, como limite diário e cadência;
  - uma mensagem `UNKNOWN` só é reprocessada com confirmação explícita de que o contato pode receber em duplicidade;
  - cada reprocessamento registra quem fez, quando e quantas vezes a mensagem já foi reprocessada.

## Capabilities

### New Capabilities

- `thinkzap/resolucao-linha-envio`: como o envio pela fila de saída encontra a linha de destino, separa linha inexistente de falha temporária, tenta de novo e usa a cópia de reserva dos dados da assinatura quando o Bitrix não responde.
- `thinkzap/admin-falhas-envio`: tela do portal admin para consultar e reprocessar mensagens da fila de saída que falharam ou ficaram com resultado indeterminado.

### Modified Capabilities

Nenhuma. A cadência (`thinkzap/cadencia-envio-mensagens`) e o limite diário (`thinkzap/limite-diario-mensagens`) não mudam: a mensagem reprocessada passa por eles como qualquer outra.

## Impact

- **API, worker de envio:** `api/src/workers/thinkzap-widget-send.processor.ts` (resolução da linha) e `api/src/queue/thinkzap-widget-outbound.queue.ts` (tentativas e espera entre elas).
- **API, cache:** os quatro decorators em `api/src/modules/application/infra/cache/` (produto, plano, assinatura e item de assinatura) e as chaves em `keys.ts`. O uso de Redis cresce com as cópias de 24 horas.
- **API, portal admin:** novas rotas em `api/src/modules/portal/routes.ts`, atrás de `portalAuthMiddleware`, para listar, detalhar e reprocessar as falhas, e novas consultas no repositório do outbox.
- **Banco:** migration aditiva em `core_thinkerszap_widget_outbox` (contagem, data e autor do último reprocessamento). A listagem usa o índice `[status, createdAt]`, que já existe.
- **Front:** nova página `front/app/(admin)/admin/falhas-envio`, item no menu do `admin-shell.tsx`, cliente em `front/lib/` e traduções em `front/messages/{pt,en,es}/admin`.
- **Sem mudança** para o cliente final nem para o app dentro do Bitrix.
