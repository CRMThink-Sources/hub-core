---
category: auth
audience: suporte
summary: Não há token de acesso salvo para essa conexão — a conta do provedor não está conectada.
---
# thinkanalise.token.not_found

## O que significa
Alguns sistemas externos (como Conta Azul e Bling) não usam uma chave fixa: o parceiro precisa **conectar a conta** por meio de uma janela de autorização, e o CRMThink guarda um token de acesso — uma espécie de crachá temporário que autoriza buscar os dados daquela conta. Este erro quer dizer que o CRMThink foi usar esse token pra puxar os dados e não encontrou nenhum salvo pra essa conexão. Ou seja, a conta do provedor nunca foi conectada, ou a conexão foi desfeita. Sem o token, o BI não tem como acessar os dados.

## Causa provável
- **A conta do provedor nunca foi conectada** (mais comum): o conector foi criado, mas o parceiro pulou a etapa de conectar a conta na janela de autorização, então nenhum token chegou a ser salvo.
- **A conexão foi desfeita ou removida**: alguém desconectou a conta, ou a configuração do conector foi refeita e o token ficou de fora.
- **A conexão não terminou**: a janela de autorização foi aberta mas fechada antes de concluir, então o token nunca foi salvo.

## Como verificar
1. Na tela de Logs do app thinkanalise, filtre pelo `traceKey` do ticket.
2. Confirme `errorCode: thinkanalise.token.not_found`.
3. Veja no log qual é o sistema externo (o provider) e a conexão envolvida.
4. Peça ao parceiro pra confirmar, na configuração do conector no CRMThink, se aquela conta aparece como **conectada**. A expectativa aqui é que ela apareça como desconectada, o que confirma a causa.

## Como resolver
1. Oriente o parceiro a abrir a configuração do conector no CRMThink e usar a opção de **conectar a conta** do provedor. Isso abre a janela de autorização.
2. Peça que ele conclua a autorização até o fim, sem fechar a janela antes de voltar pra tela do conector. É a conclusão que faz o CRMThink salvar o token que estava faltando.
3. Confirme com o parceiro que a conta passou a aparecer como conectada.
4. Peça pra ele rodar de novo a atualização do BI e confirme na tela de Logs que o erro não se repete.

## Quando escalar
Se o parceiro concluiu a conexão da conta e ela aparece como conectada, mas o erro de token não encontrado continua ao buscar os dados, acione a equipe de desenvolvimento. Anexe: `traceKey`, `errorCode: thinkanalise.token.not_found`, o sistema externo (provider) envolvido, o domínio do parceiro e o horário do evento.
