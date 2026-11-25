# Tasks

## 1. Conexão em coexistência

- [x] 1.1 Criar a branch `task/coexistencia-whatsapp-oficial` a partir da `develop`; verificar com `git branch --show-current`
- [x] 1.2 API: aceitar `coexistence` nas duas rotas de conexão, repassá-lo à HubMessage e exigir `phoneId` só sem coexistência; verificar com testes dos dois controllers e de `ConnectOfficialLine` (com, sem e ausente)
- [x] 1.3 Front: enviar `coexistence` e aceitar retorno sem `phoneId` nesse modo; verificar em `connect-hubmessage-channel.test.ts`
- [x] 1.4 Front: avisos na aba de conexão desconectada, em pt, en e es; verificar no navegador
- [x] 1.5 Rodar `yarn check-types`, `yarn lint` e `yarn test` em `api` e `front`

## 2. Gate: validação com número real (bloqueia o grupo 3)

- [ ] 2.1 Em staging, conectar um número em coexistência, inclusive o caso sem `phoneId`; registrar o resultado no design
- [ ] 2.2 Capturar os payloads de texto e mídia enviados pelo app e pela API e responder os itens da decisão 2 no design; sem evento do app, parar e acionar a HubMessage
- [ ] 2.3 Ajustar design, spec e tarefas ao que foi observado e obter o aceite antes de seguir

## 3. Espelhamento

- [ ] 3.1 Webhook: enfileirar `from_me` sem `from_api` e descartar os demais; verificar com testes do controller
- [ ] 3.2 Extrair do espelhamento Z-API a postagem como operador; verificar que os testes da Z-API passam sem mudar expectativas
- [ ] 3.3 Criar o caso de uso de espelhamento oficial, o processor e o roteamento no worker (linha ativa, canal, duplicata, identidade, operador, contato, conversa nova); verificar com um teste por cenário da spec
- [ ] 3.4 Worker de saída: guard anti-loop também na linha oficial; verificar em `bitrix-received-message.processor.test.ts` que a cópia não é reenviada e a resposta do operador segue
- [ ] 3.5 Processador de bot: ignorar mensagem com o aviso do aparelho nos três idiomas; verificar com testes
- [ ] 3.6 Se o gate pedir, atualizar os eventos do webhook; verificar com o teste da constante
- [ ] 3.7 Rodar `yarn check-types`, `yarn lint` e `yarn test` em `api`

## 4. Validação integrada

- [ ] 4.1 Em staging: responder pelo celular e pelo Bitrix em conversa existente, iniciar pelo celular com contato novo e linha com fluxo de bot; conferir ausência de duplicata e de mensagem automática indevida
