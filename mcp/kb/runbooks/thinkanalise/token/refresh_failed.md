---
category: integration
audience: suporte
summary: A renovação automática do acesso ao provedor falhou; o acesso expirou ou foi revogado.
---
# thinkanalise.token.refresh_failed

## O que significa
O token de acesso que autoriza o CRMThink a buscar dados em sistemas como Conta Azul e Bling tem prazo de validade curto. Antes de vencer, o CRMThink tenta renová-lo sozinho, nos bastidores, sem incomodar o parceiro. Este erro quer dizer que essa renovação automática falhou: o sistema externo não devolveu um token novo. Isso normalmente acontece porque o acesso venceu de vez ou foi revogado no lado do provedor. Enquanto não for renovado, o BI não consegue puxar os dados daquela conta.

## Causa provável
- **O parceiro revogou o acesso do app no painel do provedor**: se ele removeu a autorização do CRMThink na conta do Conta Azul/Bling, a renovação passa a ser recusada.
- **O acesso ficou parado tempo demais e expirou de vez**: alguns provedores invalidam a renovação se a conta ficou sem uso por muito tempo.
- **A senha ou o acesso da conta no provedor foi alterado**: mudanças de credencial no lado do provedor derrubam a autorização anterior.
- **Instabilidade momentânea do provedor**: uma falha temporária no sistema externo também pode fazer a renovação falhar naquele instante.

## Como verificar
1. Na tela de Logs do app thinkanalise, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: thinkanalise.token.refresh_failed`.
3. Veja no log qual é o sistema externo (o provider) e a conexão envolvida.
4. Peça ao parceiro pra conferir, no painel do provedor, se a autorização do CRMThink (o app) ainda consta como ativa naquela conta.

## Como resolver
1. Oriente o parceiro a **reconectar a conta** do provedor na configuração do conector no CRMThink. Reconectar gera uma autorização nova e substitui a que expirou ou foi revogada.
2. Peça que ele conclua a janela de autorização até o fim, pois é isso que salva o novo acesso.
3. Confirme com o parceiro que a conta voltou a aparecer como conectada.
4. Peça pra ele rodar de novo a atualização do BI e confirme na tela de Logs que o erro não se repete.

## Quando escalar
Se a renovação continuar falhando mesmo depois de o parceiro reconectar a conta, ou se o erro voltar logo após uma reconexão bem-sucedida, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: thinkanalise.token.refresh_failed`, o sistema externo (provider) envolvido, o domínio do parceiro e o horário do evento.
