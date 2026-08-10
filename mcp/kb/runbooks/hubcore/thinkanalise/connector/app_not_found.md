---
category: config
audience: suporte
summary: O CRMThink não achou o app instalado no portal, então o conector não abre nem salva.
---
# thinkanalise.connector.app_not_found

## O que significa
A integração do thinkanalise com o BI do Bitrix24 funciona por meio de um aplicativo instalado dentro do portal (o Bitrix24 do cliente final). Esse aplicativo é o que guarda o vínculo entre o CRMThink e o portal e permite criar e gravar os conectores de BI. Este erro quer dizer que, na hora de abrir ou salvar um conector, o CRMThink procurou esse aplicativo naquele portal e não encontrou nenhum. Sem esse vínculo, ele não tem onde criar nem onde salvar o conector, então a tela simplesmente não funciona.

## Causa provável
- **Aplicativo nunca foi instalado** (mais comum): o portal está tentando usar a integração, mas o aplicativo thinkanalise não chegou a ser instalado nele, então não há vínculo pra encontrar.
- **Aplicativo foi removido ou desativado**: o vínculo existia, mas alguém desinstalou ou desativou o aplicativo no portal, e o CRMThink perdeu a referência.
- **Portal diferente do que foi instalado**: cada portal tem seu próprio endereço (domínio). Se o parceiro instalou o aplicativo em um endereço e está tentando usar a integração a partir de outro, o CRMThink não acha o vínculo, porque ele existe só no endereço original.

## Como verificar
1. Na tela de Logs do app thinkanalise, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: thinkanalise.connector.app_not_found`.
3. Veja no log qual é o domínio (o endereço do portal) que gerou o erro e confirme com o parceiro se é exatamente o portal onde ele espera usar a integração. Isso descarta o caso de estar tentando de um portal diferente do que foi instalado.

## Como resolver
1. Peça ao parceiro pra confirmar, dentro do Bitrix24 do cliente, se o aplicativo thinkanalise aparece na lista de aplicativos instalados. É esse aplicativo que cria o vínculo que está faltando.
2. Se não estiver instalado, oriente o parceiro a instalar (ou reinstalar) o aplicativo pelo marketplace do próprio Bitrix24 do cliente. A instalação é o que recria o vínculo que o CRMThink não encontrou.
3. Depois de instalar, oriente o parceiro a reabrir a tela do conector. Reabrir força o CRMThink a procurar o vínculo de novo, agora que ele existe.
4. Confirme com o parceiro que o conector abre e pode ser salvo normalmente.

## Quando escalar
Se o parceiro confirmou que o aplicativo thinkanalise consta como instalado naquele portal e o erro continua ao abrir ou salvar o conector, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: thinkanalise.connector.app_not_found`, o domínio do parceiro, o horário do evento e a confirmação de que o aplicativo aparece como instalado no Bitrix24.
