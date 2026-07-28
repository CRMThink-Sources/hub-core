---
category: integration
audience: suporte
summary: A troca do código de autorização pelo acesso falhou (código expirado ou já usado).
---
# thinkanalise.oauth.code_exchange_failed

## O que significa
Ao conectar uma conta do Conta Azul ou do Bling, o provedor devolve pro CRMThink um **código de autorização** — um comprovante de uso único que o CRMThink logo em seguida troca pelo token de acesso definitivo. Este erro quer dizer que essa troca falhou: o parceiro autorizou, mas na hora de converter o código em acesso o provedor recusou. Normalmente é porque o código já tinha vencido (eles duram muito pouco) ou já tinha sido usado. Como a troca não deu certo, a conexão não se completa e nenhum acesso é salvo.

## Causa provável
- **O código venceu antes de ser trocado**: esses códigos têm validade de poucos segundos/minutos; se houve demora entre autorizar e concluir, ele expira.
- **O código foi usado duas vezes**: se o parceiro voltou/atualizou a página de retorno da autorização, o mesmo código é reenviado, e o provedor só aceita uma vez.
- **Configuração de conexão divergente no provedor**: em casos mais raros, a autorização volta pra um endereço de retorno que não bate com o cadastrado no provedor, e a troca é recusada.
- **Instabilidade momentânea do provedor**: uma falha temporária no sistema externo também pode derrubar a troca naquele instante.

## Como verificar
1. Na tela de Logs do app thinkanalise, filtre pelo `traceKey` do ticket.
2. Confirme `errorCode: thinkanalise.oauth.code_exchange_failed`.
3. Veja no log qual é o sistema externo (o provider) e, se houver, a mensagem que o provedor devolveu na troca.
4. Pergunte ao parceiro se ele demorou pra concluir ou se atualizou/voltou a página de retorno da autorização. Isso ajuda a confirmar código expirado ou reutilizado.

## Como resolver
1. Oriente o parceiro a começar a conexão de novo, do zero, pela configuração do conector no CRMThink.
2. Peça que ele conclua a autorização **rápido e de uma vez só**, sem atualizar nem voltar a página de retorno, pra que o código ainda esteja válido quando o CRMThink for trocá-lo.
3. Confirme com o parceiro que a conta passou a aparecer como conectada e peça pra rodar a atualização do BI.
4. Se falhar de novo, peça pra ele tentar mais uma vez após alguns minutos, pra descartar uma instabilidade momentânea do provedor.

## Quando escalar
Se o parceiro concluiu a autorização de forma direta e a troca continua falhando, acione a equipe de desenvolvimento. Anexe: `traceKey`, `errorCode: thinkanalise.oauth.code_exchange_failed`, o sistema externo (provider) envolvido, o domínio do parceiro, o horário do evento e a mensagem que o provedor retornou (se aparecer no log).
