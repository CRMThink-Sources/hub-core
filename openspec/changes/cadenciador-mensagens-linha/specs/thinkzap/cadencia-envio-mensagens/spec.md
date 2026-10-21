# Spec Delta

## Purpose

Controla o ritmo de envio de uma linha não oficial (Web, Z-API): no máximo N mensagens por janela de D minutos, com pausa opcional ao atingir o limite. O objetivo é reduzir o risco de bloqueio pelo WhatsApp por rajadas. Diferente do limite diário, a cadência não recusa mensagens: o excesso espera na fila e sai sozinho na próxima janela.

## ADDED Requirements

### Requirement: Configuração da cadência por linha não oficial
Cada linha não oficial (provider Z-API) SHALL ter uma configuração própria de cadência com estes valores:

- **ativada**: sim ou não;
- **mensagens por janela (N)**: inteiro maior ou igual a 1;
- **duração da janela (D)**: inteiro em minutos, maior ou igual a 1;
- **pausa ativada**: sim ou não;
- **duração da pausa (P)**: inteiro em minutos, maior ou igual a 1;
- **contar mensagens enviadas pelo aparelho**: sim ou não, desligada por padrão (ver "Contagem da janela").

Linha nova ou linha que nunca teve a configuração SHALL ter a cadência **desativada**, e os envios dela SHALL NOT ser atrasados por cadência. O sistema SHALL NOT pré-preencher valores sugeridos. Os valores são definidos pelo usuário.

Estes casos SHALL ser recusados com erro de validação, sem gravar nada:

- gravar a cadência ativada com N ou D ausente, zero, negativo ou não inteiro;
- gravar a pausa ativada com P ausente, zero, negativo ou não inteiro.

Linhas oficiais (HubMessage) SHALL NOT expor nem aplicar a cadência. Uma tentativa de gravar a cadência numa linha oficial SHALL ser recusada.

Só quem tem permissão de edição da linha SHALL poder alterar a configuração.

#### Scenario: Ativar a cadência sem pausa
- **WHEN** um usuário com permissão de edição ativa a cadência numa linha não oficial com N = 20 e D = 1 e salva
- **THEN** a linha passa a enviar no máximo 20 mensagens por janela de 1 minuto

#### Scenario: Ativar a cadência com pausa
- **WHEN** o usuário ativa a cadência com N = 20, D = 1, pausa ativada e P = 5 e salva
- **THEN** a configuração é gravada com a pausa de 5 minutos

#### Scenario: Valor inválido
- **WHEN** o usuário tenta salvar a cadência ativada com N = 0
- **THEN** a gravação é recusada com erro de validação
- **AND** a configuração anterior continua valendo

#### Scenario: Pausa ativada sem duração
- **WHEN** o usuário tenta salvar a pausa ativada sem informar P
- **THEN** a gravação é recusada com erro de validação

#### Scenario: Linha existente sem configuração
- **WHEN** uma linha não oficial criada antes desta funcionalidade é lida
- **THEN** a cadência aparece desativada e nenhum envio dela é atrasado por cadência

#### Scenario: Linha oficial não tem cadência
- **WHEN** alguém tenta gravar a cadência numa linha HubMessage
- **THEN** a gravação é recusada
- **AND** os envios da linha não são afetados

### Requirement: Janela de envio e pausa
Com a cadência ativada, o sistema SHALL controlar os envios da linha por janelas:

- A janela SHALL começar no **primeiro envio** feito pela linha quando não há janela aberta nem pausa em andamento. A janela SHALL NOT ser alinhada ao relógio.
- A janela SHALL durar D minutos a partir do seu início e SHALL aceitar no máximo N envios.
- Ao ser feito o N-ésimo envio da janela, a janela SHALL ser considerada com **limite atingido**.
- Com a pausa ativada, a pausa SHALL começar no instante em que o limite é atingido e SHALL durar P minutos. A pausa **substitui** o restante da janela: nenhuma mensagem sai durante a pausa, e a próxima janela só pode abrir quando a pausa termina.
- Sem pausa, a próxima janela só pode abrir quando a janela atual termina (início + D).
- Se a janela termina sem atingir o limite, o próximo envio SHALL abrir uma janela nova.

Envios concorrentes, inclusive em processos diferentes, SHALL NOT fazer uma janela ultrapassar N envios.

O estado da janela e da pausa SHALL sobreviver a um reinício dos processos de envio.

#### Scenario: Janela começa no primeiro envio
- **WHEN** a linha está ociosa e a primeira mensagem é enviada às 10:00:37, com D = 1
- **THEN** a janela vai de 10:00:37 até 10:01:37

#### Scenario: Ritmo sem pausa
- **WHEN** com N = 20, D = 1 e sem pausa, um robô dispara 50 mensagens de uma vez às 10:00:00
- **THEN** 20 mensagens saem na janela que começa às 10:00:00
- **AND** as próximas 20 saem a partir de 10:01:00
- **AND** as 10 restantes saem a partir de 10:02:00
- **AND** nenhuma mensagem é recusada

#### Scenario: Pausa substitui o restante da janela
- **WHEN** com N = 20, D = 1 e P = 5, a janela começa às 10:00:00 e a 20ª mensagem sai às 10:00:40
- **THEN** nenhuma mensagem sai antes de 10:05:40
- **AND** a 21ª mensagem sai a partir de 10:05:40, abrindo uma janela nova

#### Scenario: Envios simultâneos na última vaga da janela
- **WHEN** a janela está com 19 de 20 envios e duas mensagens tentam sair ao mesmo tempo
- **THEN** só uma sai nesta janela
- **AND** a outra aguarda a próxima janela, sem ser recusada

#### Scenario: Reinício durante a pausa
- **WHEN** os processos de envio reiniciam durante uma pausa que vai até 10:05:40
- **THEN** nenhuma mensagem da linha sai antes de 10:05:40

#### Scenario: Cadência desativada
- **WHEN** a linha está com a cadência desativada e um robô dispara 50 mensagens
- **THEN** as mensagens saem sem espera por janela, respeitando só o limite diário

### Requirement: Contagem da janela
A janela SHALL contar as mensagens de saída **aceitas pelo provider**, com a mesma regra de unidade do limite diário:

- cada parte aceita conta uma unidade (texto mais dois anexos contam 3);
- o envio que o provider respondeu com erro SHALL NOT contar;
- o envio sem resposta do provider (tempo esgotado ou falha de rede) SHALL contar;
- uma retentativa da mesma mensagem SHALL NOT contar duas vezes.

A janela SHALL contar toda origem de envio da linha:

- resposta do operador no canal aberto;
- widget;
- robô "Enviar mensagem" e robô de botões;
- Campanha de SMS;
- falas do bot.

As mensagens **enviadas pelo aparelho** (celular ou WhatsApp Web, recebidas pelo espelhamento) SHALL NOT contar na janela por padrão. A configuração da cadência SHALL ter a opção **contar mensagens enviadas pelo aparelho** (sim ou não), desligada em linha nova ou que nunca teve a opção. Só com ela ligada a mensagem do aparelho conta.

A mensagem do aparelho já foi enviada. Quando conta, ela SHALL contar na janela em andamento, ou abrir uma janela se não houver nenhuma, e SHALL NOT esperar. Se ela fizer a janela atingir o limite, a pausa (quando ativada) SHALL começar normalmente. Se chegar durante uma pausa ou com a janela já no limite, ela SHALL ser registrada, sem prolongar a pausa nem antecipar a próxima janela. Esta opção só decide se a mensagem do aparelho conta, e vale a partir da próxima mensagem do aparelho, sem esperar a próxima janela.

#### Scenario: Texto com anexos conta cada parte
- **WHEN** o usuário envia pelo widget um texto com dois anexos e as três partes são aceitas
- **THEN** a janela soma 3 envios

#### Scenario: Erro do provider não conta
- **WHEN** o provider responde com erro a uma mensagem
- **THEN** a contagem da janela não muda

#### Scenario: Mensagem do aparelho não conta por padrão
- **WHEN** a opção de contar mensagens do aparelho está desligada, a janela está com 19 de 20 envios e o usuário manda uma mensagem pelo celular
- **THEN** a mensagem é espelhada normalmente
- **AND** a janela continua com 19 envios

#### Scenario: Espelhada conta e dispara a pausa
- **WHEN** com a opção de contar mensagens do aparelho ligada, N = 20 e P = 5, a janela está com 19 envios e o usuário manda uma mensagem pelo celular, que é espelhada
- **THEN** a mensagem espelhada conta como o 20º envio
- **AND** a pausa começa e as mensagens da fila aguardam o fim dela

#### Scenario: Espelhada durante a pausa
- **WHEN** com a opção de contar mensagens do aparelho ligada, a linha está em pausa e o usuário manda uma mensagem pelo celular
- **THEN** a mensagem é espelhada normalmente
- **AND** a pausa termina no horário já previsto

### Requirement: Enfileiramento sem recusa e ordem de envio
Toda mensagem de saída da linha não oficial SHALL ser persistida e enviada pela fila de saída, com a cadência ativada ou desativada. Isso vale para todas as origens: resposta do operador, widget (inclusive envio com anexo), robô "Enviar mensagem", robô de botões, Campanha de SMS e falas do bot.

A mensagem que não tem vaga, seja porque a janela atingiu o limite ou porque está em pausa, SHALL NOT ser recusada pela cadência. Ela SHALL aguardar na fila e ser enviada automaticamente quando houver vaga numa janela.

- **Ordem:** a ordem de saída SHALL ser FIFO por linha, pela ordem de entrada na fila, sem prioridade entre origens. A resposta do operador SHALL NOT passar na frente de mensagens de robô ou de Campanha de SMS que entraram antes.
- **Por destinatário:** mensagens para o mesmo destinatário SHALL sair na ordem em que foram criadas, mesmo atravessando janelas.
- **Abertura da janela:** quando a janela abre, no máximo N mensagens da fila SHALL sair nela. As demais aguardam a janela seguinte.
- **Sem tempo máximo:** não há tempo máximo de espera. A mensagem SHALL aguardar o quanto for preciso.
- **Tentativas:** a espera por cadência SHALL NOT consumir as tentativas de envio da mensagem.
- **Linha que não pode enviar:** se a linha deixar de poder enviar com mensagens na fila (linha desconectada, sem assinatura ativa ou removida), as mensagens SHALL seguir a regra de falha já existente da sua origem, em vez de ficar presas.

O limite diário SHALL continuar valendo, verificado no momento do envio real. A mensagem que estava na fila e encontra o limite diário atingido SHALL falhar pela regra do limite diário (`thinkzap.line.daily_limit_reached`). A mensagem enfileirada que sai depois da meia-noite em `America/Sao_Paulo` SHALL contar no dia em que foi enviada.

#### Scenario: Excesso aguarda e sai sozinho
- **WHEN** com N = 20 e D = 1, o widget envia a 21ª mensagem dentro da mesma janela
- **THEN** a mensagem não é recusada
- **AND** ela sai automaticamente quando abre a próxima janela

#### Scenario: FIFO sem prioridade para o operador
- **WHEN** um robô enfileira 40 mensagens com N = 20 e, em seguida, o operador responde um cliente
- **THEN** a resposta do operador sai depois das 40 mensagens do robô

#### Scenario: Ordem por destinatário entre origens
- **WHEN** durante uma pausa o bot fala com um contato e, em seguida, o operador responde o mesmo contato
- **THEN** a fala do bot sai antes da resposta do operador

#### Scenario: Espera longa não expira
- **WHEN** uma mensagem fica 3 horas na fila de cadência
- **THEN** ela é enviada normalmente quando chega a vez dela

#### Scenario: Espera não consome tentativas
- **WHEN** uma mensagem é adiada por cadência três vezes e depois o provider responde com erro
- **THEN** a mensagem ainda tem todas as tentativas de envio disponíveis para esse erro

#### Scenario: Limite diário atingido durante a espera
- **WHEN** uma mensagem aguarda na fila de cadência e o limite diário da linha é atingido antes de ela sair
- **THEN** ela falha com o código `thinkzap.line.daily_limit_reached`
- **AND** a origem informa a falha conforme a capability `thinkzap/limite-diario-mensagens`

#### Scenario: Operador sem cadência
- **WHEN** a linha está com a cadência desativada e o operador responde um cliente
- **THEN** a resposta é persistida, enfileirada e enviada assim que processada, sem espera por janela

### Requirement: Mudança de configuração vale na próxima janela
Qualquer alteração da configuração de cadência, inclusive ativar a pausa, mudar N, D ou P e **desativar** a cadência, SHALL valer somente a partir da próxima janela. A janela em andamento e a pausa em andamento SHALL terminar com os valores com que começaram.

- Ao desativar a cadência durante uma janela ou pausa, a fila SHALL continuar respeitando essa janela ou pausa até o fim. Depois disso, as mensagens SHALL sair sem cadência.
- Ao ativar a cadência numa linha que tinha a cadência desativada, a primeira janela SHALL começar no primeiro envio feito depois da ativação.

#### Scenario: Reduzir N durante a janela
- **WHEN** com N = 20 e 12 envios na janela atual, o usuário muda N para 10 e salva
- **THEN** a janela atual continua aceitando até 20 envios
- **AND** a próxima janela abre com limite de 10

#### Scenario: Aumentar a pausa durante uma pausa
- **WHEN** a linha está numa pausa de 5 minutos e o usuário muda P para 10
- **THEN** a pausa em andamento termina no horário original
- **AND** a próxima pausa dura 10 minutos

#### Scenario: Desativar durante a pausa
- **WHEN** a linha está em pausa até 10:05:40 com 30 mensagens aguardando e o usuário desativa a cadência
- **THEN** nenhuma mensagem sai antes de 10:05:40
- **AND** a partir de 10:05:40 as 30 mensagens saem sem espera por janela

### Requirement: Aviso de espera no widget
O widget SHALL mostrar a mensagem adiada pela cadência com o status "aguardando janela de envio" e o horário previsto de saída. O horário previsto é o início da próxima janela possível ou o fim da pausa. Quando a mensagem sai, o status SHALL mudar para o status normal de enviada. Se ela falhar, o status SHALL mudar para o status normal de falha.

O envio com anexo pelo widget SHALL deixar de aguardar o envio de todas as partes para responder. O widget SHALL mostrar o envio como aceito e acompanhar o status de cada parte como acompanha uma mensagem da fila.

A timeline do CRM SHALL NOT registrar a espera. Ela continua registrando só o resultado final do envio.

#### Scenario: Mensagem do widget durante a pausa
- **WHEN** o usuário envia uma mensagem pelo widget com a linha em pausa até 10:05:40
- **THEN** o widget mostra a mensagem como "aguardando janela de envio", com saída prevista para 10:05:40
- **AND** quando a mensagem sai, o widget passa a mostrá-la como enviada

#### Scenario: Timeline não registra espera
- **WHEN** uma mensagem do widget é adiada por cadência e depois é enviada
- **THEN** a timeline do CRM registra só o envio, sem comentário de espera

### Requirement: Aviso de espera ao operador
Quando uma resposta do operador no canal aberto for adiada pela cadência, o operador SHALL receber no chat do canal aberto um aviso de que a mensagem está aguardando a janela de envio, com o horário previsto de saída.

- O aviso SHALL ser enviado uma vez por espera. Reagendamentos internos da mesma mensagem SHALL NOT gerar novos avisos.
- Se o operador mandar várias mensagens na mesma conversa durante a mesma espera (mesma janela no limite ou mesma pausa), ele SHALL receber um único aviso.
- A resposta enviada depois da espera SHALL NOT gerar aviso de erro.
- A falha ao postar o aviso SHALL NOT impedir nem atrasar o envio da mensagem.

#### Scenario: Operador responde durante a pausa
- **WHEN** a linha está em pausa até 10:05:40 e o operador responde um cliente
- **THEN** o operador vê no chat o aviso de que a mensagem aguarda a janela de envio, com saída prevista para 10:05:40
- **AND** a mensagem é enviada a partir de 10:05:40

#### Scenario: Várias respostas na mesma pausa
- **WHEN** o operador manda três mensagens na mesma conversa durante a mesma pausa
- **THEN** ele recebe um único aviso de espera

### Requirement: Exibição do estado da cadência
A configuração da linha não oficial SHALL mostrar o estado atual da cadência:

- com a cadência ativa e janela aberta: os envios da janela sobre N e o horário de término da janela;
- em pausa: a indicação de pausa e o horário de término;
- sem janela aberta: a indicação de que a próxima mensagem abre uma janela nova;
- a quantidade de mensagens aguardando na fila da linha;
- quando houver uma alteração que só vale na próxima janela, a indicação de que os novos valores entram na próxima janela.

Com a cadência desativada, SHALL mostrar a indicação de que a cadência não está ativa.

#### Scenario: Janela em andamento
- **WHEN** a linha tem N = 20, a janela atual teve 12 envios e termina às 10:01:00
- **THEN** a tela mostra 12 de 20 envios e o término às 10:01:00

#### Scenario: Linha em pausa com fila
- **WHEN** a linha está em pausa até 10:05:40 e 30 mensagens aguardam
- **THEN** a tela mostra a pausa até 10:05:40 e 30 mensagens aguardando

### Requirement: Lista das mensagens aguardando
Além da quantidade, a configuração da linha não oficial SHALL listar as mensagens que aguardam na fila da linha, **na ordem em que vão sair**. Cada linha da lista SHALL mostrar:

- a posição na fila;
- a origem (operador, bot, widget, envio com anexo, robô "Enviar mensagem", robô de botões, Campanha de SMS). Na resposta do operador, também o nome do operador, como no Bitrix24; se o nome não puder ser lido, só a origem;
- o destinatário;
- um trecho do conteúdo: o texto, a legenda ou, em mídia sem legenda, o tipo e o nome do arquivo;
- o horário em que entrou na fila;
- a previsão de saída, quando a mensagem está esperando uma janela ou o fim de uma pausa.

A lista SHALL ser **paginada**, com 10 mensagens por página, e SHALL permitir navegar por toda a fila. Ela SHALL indicar o intervalo exibido e o total (por exemplo, "11–20 de 23"). A posição exibida é a posição na fila inteira, e não na página. Como a fila anda enquanto o usuário navega, cada página reflete a fila no momento em que é lida. Se a página aberta deixar de existir (a fila encolheu), a lista SHALL voltar para a última página que existe.

A lista SHALL ser lida ao abrir a aba e SHALL poder ser atualizada sem recarregar a página. Ver a lista exige a mesma permissão de ler a configuração da linha. A lista SHALL NOT oferecer ações sobre as mensagens.

Sem mensagens aguardando, a lista SHALL NOT aparecer. Linhas oficiais SHALL NOT expor a lista.

#### Scenario: Pausa com mensagens na fila
- **WHEN** a linha está em pausa até 10:05:40 com uma resposta do operador e duas mensagens de robô aguardando, nessa ordem
- **THEN** a tela mostra "3 mensagens aguardando na fila" e a lista com as três, nessa ordem
- **AND** cada uma mostra a origem, o destinatário, o trecho, a hora de entrada e a saída prevista para 10:05:40

#### Scenario: Paginação de 10 em 10
- **WHEN** 23 mensagens aguardam na fila da linha
- **THEN** a primeira página mostra as posições 1 a 10 e indica "1–10 de 23"
- **AND** a terceira página mostra as posições 21 a 23

#### Scenario: Página que deixou de existir
- **WHEN** o usuário está na terceira página e, ao atualizar, só restam 12 mensagens na fila
- **THEN** a lista mostra a segunda página, com as posições 11 e 12

#### Scenario: Fila vazia
- **WHEN** nenhuma mensagem aguarda
- **THEN** a lista não aparece

#### Scenario: Atualizar a lista
- **WHEN** a fila andou desde a abertura da aba e o usuário pede para atualizar
- **THEN** a lista e a quantidade passam a refletir a fila atual

### Requirement: Idioma dos avisos de cadência
Os textos de cadência gerados pelo servidor SHALL sair no idioma escolhido no app para a instalação, entre `pt`, `en` e `es`, conforme a capability `thinkzap/idioma-avisos-servidor`. Isso inclui o aviso de espera ao operador no chat do canal aberto. Instalação sem idioma escolhido SHALL receber os avisos em português.

#### Scenario: Aviso de espera em espanhol
- **WHEN** o idioma do app é espanhol e a resposta do operador é adiada pela cadência
- **THEN** o aviso de espera no chat do canal aberto aparece em espanhol
