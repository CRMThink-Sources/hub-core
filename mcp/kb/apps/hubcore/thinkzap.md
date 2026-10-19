# App: ThinkZap

## O que é (nível suporte)
Integração de WhatsApp entre o Bitrix24 do cliente e o WhatsApp, para conversar com
contatos e disparar mensagens a partir do CRM. Cada **linha** é um número de WhatsApp
conectado, em uma de duas modalidades:
- **WhatsApp não-oficial (z-api)**: a linha conecta lendo um **QR Code** na aba Conexão;
  se o aparelho cai, a linha desconecta e para de enviar/receber.
- **WhatsApp Oficial (HubMessage)**: canal oficial; permite mensagem livre só dentro da
  janela de 24h desde a última interação do contato — fora disso, só **template aprovado**.

Recursos: envio pelo **widget** de conversa, disparo automático pelo **robô** do fluxo
(Bizproc), recebimento de mensagens para o CRM, e **assinatura** (período de teste ou
contratação por cartão/manual, com linhas adicionais).

> Este contexto é apoio interno de triagem. Não descreva arquitetura, fluxo interno ou
> "como funciona por dentro" para o solicitante — só use para identificar o modo de falha
> e guiar a resolução do erro.

## Modos de falha comuns (para triar)
- **Linha não envia/recebe (z-api)** → geralmente desconectada; ver `thinkzap.zapi.*`
  (ex.: `thinkzap.zapi.message_send_failed`) e `thinkzap.provisioning.instance_resolve_failed`.
  Caminho: reconectar lendo o QR Code na aba Conexão.
- **Mensagem livre recusada no WhatsApp Oficial** → `thinkzap.hubmessage.window_closed`
  (passou das 24h): só sai template aprovado.
- **Falha ao falar com o WhatsApp Oficial** → `thinkzap.hubmessage.request_failed`.
- **Pagou e a linha não liberou** → `thinkzap.subscription.line_blocked_after_payment`
  (URGENTE; sem nova cobrança, liberação manual). Ativação em geral → `thinkzap.subscription.*`.
- **Contratação por cartão indisponível** → `thinkzap.gateway.not_configured` /
  `thinkzap.gateway.checkout_create_failed`.
- **Disparo pelo robô não saiu** → `thinkzap.bitrix.robot_webhook_failed`.
- **Arquivo do robô de envio não chegou, o texto sim** → `thinkzap.bitrix.robot_file_unavailable`.
- **App não instalado no portal** → `thinkzap.app.not_found`.

## Dicas de triagem
- Erro de envio z-api quase sempre é linha desconectada: peça para conferir a aba Conexão
  e reler o QR Code antes de escalar.
- No WhatsApp Oficial, distinga "janela fechada" (esperado, usar template) de falha real
  do canal (`request_failed`).
- Erros de pagamento pós-aprovação (`line_blocked_after_payment`, `activation_failed`,
  `additional_line_failed`): **nunca** há nova cobrança; a resolução é manual — tranquilize
  o cliente e escale com o e-mail da conta.
- Para falha externa (z-api/WhatsApp Oficial/Bitrix24), leia no log o status/mensagem que o
  serviço devolveu — é o que diz o motivo real.
- Sempre peça o `traceKey` da tela de Logs para localizar o evento exato.
