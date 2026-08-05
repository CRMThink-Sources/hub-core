---
category: integration
audience: suporte
summary: O sistema externo bloqueou o acesso do app (limite de consumo ou restrição do plano).
---
# thinkanalise.provider.blocked

## O que significa
Este erro quer dizer que o sistema externo (Asaas, Bling, Conta Azul, Omie ou Sonax) bloqueou o acesso do app às informações. Diferente de um limite momentâneo de chamadas, aqui o provedor barrou o acesso de forma mais firme — normalmente porque o consumo contratado se esgotou, o plano não cobre aquele recurso ou a conta está com alguma restrição. A credencial pode até estar correta, mas o provedor decidiu não liberar os dados. Enquanto o bloqueio existir do lado do provedor, o BI não consegue puxar os dados daquela conta.

## Causa provável
- **Limite de consumo do plano esgotado**: o parceiro atingiu o teto de uso da API contratado com o provedor, e o acesso fica barrado até renovar/virar o ciclo.
- **Recurso fora do plano**: o dado que o BI tenta buscar exige um plano superior ao que o parceiro tem no provedor.
- **Conta com restrição ou pendência**: uma pendência financeira ou administrativa na conta do provedor faz ele bloquear o acesso via API.
- **App/integração desabilitado no painel do provedor**: em alguns provedores é possível desligar o acesso por API, e isso também gera bloqueio.

## Como verificar
1. Na tela de Logs do app thinkanalise, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: thinkanalise.provider.blocked`.
3. Veja no log qual é o sistema externo (o provider) e, se houver, a mensagem que o provedor devolveu explicando o bloqueio.
4. Oriente o parceiro a olhar, no painel do provedor, o estado da conta e do plano: limite de uso, pendências e se o acesso por API está habilitado.

## Como resolver
1. Como o bloqueio é decisão do provedor, oriente o parceiro a resolver **dentro do painel do sistema externo**: regularizar a conta, renovar/ampliar o plano ou reabilitar o acesso por API, conforme o motivo que aparecer.
2. Se o motivo for consumo esgotado, oriente a aguardar a virada do ciclo ou contratar um limite maior com o provedor — trocar a credencial não resolve.
3. Depois que o parceiro confirmar que o acesso foi liberado no provedor, peça pra ele rodar a atualização do BI de novo.
4. Confirme na tela de Logs que o erro não se repete.

## Quando escalar
Se o parceiro confirmou junto ao provedor que a conta está regular, o plano cobre o recurso e o acesso por API está ativo, mas o bloqueio continua, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: thinkanalise.provider.blocked`, o sistema externo (provider) envolvido, o domínio do parceiro, o horário do evento e a mensagem de bloqueio que o provedor retornou (se aparecer no log).
