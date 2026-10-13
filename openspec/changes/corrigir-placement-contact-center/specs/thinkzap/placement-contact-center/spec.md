# Spec Delta

## Purpose

Define a tela que o Bitrix24 abre ao configurar o conector ThinkZap pelo Contact Center: como ela se autentica dentro do iframe do placement, quais linhas oferece e como vincula uma linha ao canal aberto de onde foi aberta.

## ADDED Requirements

### Requirement: Endereço do handler preservado
A tela SHALL continuar respondendo no mesmo endereço registrado como handler do conector (`/thinkzap/connector`), para que instalações existentes funcionem sem re-registrar o conector no Bitrix24.

#### Scenario: Instalação antiga abre a tela
- **WHEN** o administrador abre a configuração do conector ThinkZap no Contact Center de um portal instalado antes desta mudança
- **THEN** o Bitrix24 carrega a tela pelo endereço já registrado e ela abre normalmente

### Requirement: Autenticação própria no placement
A tela SHALL se autenticar com o backend a partir do contexto do BX24 do placement antes de qualquer chamada à API, sem depender de token gravado por outra tela do app. A tela SHALL NOT exibir a navegação lateral nem as telas internas do app ThinkZap.

#### Scenario: Primeira abertura sem sessão prévia
- **WHEN** o placement é aberto num iframe sem token salvo no navegador
- **THEN** a tela mostra um indicador de carregamento, autentica, e em seguida lista as linhas — sem nenhum erro não tratado no console

#### Scenario: Falha de autenticação
- **WHEN** a autenticação com o backend falha
- **THEN** a tela mostra a mensagem de erro retornada e não tenta listar linhas

#### Scenario: Aberta fora do Bitrix24
- **WHEN** o endereço é aberto diretamente no navegador, fora de um iframe do Bitrix24
- **THEN** a tela informa que deve ser aberta pelo Bitrix24 e não lança erro

### Requirement: Listagem das linhas da instalação
Depois de autenticada, a tela SHALL listar as linhas ativas da instalação, identificando cada uma pelo número e nome do WhatsApp quando disponíveis, ou pelo nome da linha caso contrário.

#### Scenario: Instalação com linhas
- **WHEN** a instalação tem linhas ativas
- **THEN** a tela oferece cada uma para seleção

#### Scenario: Instalação sem linhas
- **WHEN** a instalação não tem linhas ativas
- **THEN** a tela informa que não há números disponíveis e não exibe o botão de vincular

#### Scenario: Usuário sem permissão de leitura de conexões
- **WHEN** o usuário do Bitrix24 não tem permissão de leitura de conexões do ThinkZap
- **THEN** a tela mostra a mensagem de falta de permissão em vez da lista

### Requirement: Escolha do canal aberto
A tela SHALL exibir um seletor com os canais abertos do portal, identificados pelo nome, e o canal do vínculo SHALL ser o escolhido nesse seletor. O canal informado pelo placement SHALL NOT ser usado como destino sem escolha do usuário: o Bitrix24 informa um canal mesmo quando o usuário clica em "Conectar" sem ter escolhido nenhum. A tela SHALL pré-selecionar linha e canal somente quando já existir uma linha vinculada ao canal informado pelo placement. Canais já vinculados a outra linha SHALL aparecer identificados com a linha que os ocupa.

#### Scenario: Conectar sem vínculo prévio
- **WHEN** o usuário abre a tela por "Conectar" e nenhuma linha está vinculada ao canal informado pelo placement
- **THEN** nem linha nem canal vêm selecionados e o botão "Vincular" fica desabilitado até o usuário escolher os dois

#### Scenario: Alterar um vínculo existente
- **WHEN** uma linha da instalação já está vinculada ao canal informado pelo placement
- **THEN** a tela pré-seleciona essa linha e esse canal e indica que a linha já está vinculada a ele

#### Scenario: Canal ocupado por outra linha
- **WHEN** um canal aberto já está vinculado a outra linha da instalação
- **THEN** o seletor mostra o canal com a identificação da linha que o ocupa

#### Scenario: Falha ao carregar os canais
- **WHEN** a leitura dos canais abertos falha
- **THEN** a tela mostra a mensagem de erro e o botão "Vincular" fica desabilitado

### Requirement: Vincular linha ao canal aberto
Ao confirmar, a tela SHALL vincular a linha escolhida ao canal aberto escolhido, usando o mesmo vínculo da tela de configuração da linha: o conector é ativado no canal aberto do Bitrix24 e o vínculo é gravado na linha. A tela SHALL mostrar sucesso apenas depois que o backend confirmar o vínculo.

#### Scenario: Vínculo com sucesso
- **WHEN** o usuário escolhe uma linha e um canal aberto e clica em "Vincular"
- **THEN** o conector fica ativo no canal escolhido, a linha passa a ter esse canal como vinculado, e a tela mostra a confirmação

#### Scenario: Canal já pertence a outra linha
- **WHEN** o usuário tenta vincular uma linha a um canal aberto que já é de outra linha ativa
- **THEN** o vínculo não é feito e a tela mostra a mensagem do backend indicando a linha que ocupa o canal

#### Scenario: Usuário sem permissão de edição
- **WHEN** o usuário não tem permissão de edição de conexões do ThinkZap
- **THEN** o vínculo não é feito e a tela mostra a mensagem de falta de permissão

#### Scenario: Falha na ativação do conector
- **WHEN** a ativação do conector no Bitrix24 falha
- **THEN** o vínculo não é gravado e a tela mostra o erro, mantendo a seleção para nova tentativa

### Requirement: Idioma da tela
Todos os textos próprios da tela — títulos, rótulos, estados de carregamento, avisos e mensagens de erro padrão — SHALL estar disponíveis em português, inglês e espanhol. O idioma SHALL ser o escolhido pelo usuário no app quando houver; sem escolha, SHALL ser o idioma do portal Bitrix24 (português, inglês ou espanhol), e português nos demais casos. Mensagens de erro devolvidas pela API SHALL ser exibidas como vêm.

#### Scenario: Portal em inglês sem idioma escolhido
- **WHEN** a tela é aberta num portal Bitrix24 em inglês e o usuário nunca escolheu idioma no app
- **THEN** todos os textos da tela aparecem em inglês

#### Scenario: Portal em espanhol
- **WHEN** a tela é aberta num portal Bitrix24 em espanhol e o usuário nunca escolheu idioma no app
- **THEN** todos os textos da tela aparecem em espanhol

#### Scenario: Idioma escolhido no app prevalece
- **WHEN** o usuário já escolheu um idioma no app
- **THEN** a tela usa esse idioma, independentemente do idioma do portal

#### Scenario: Idioma do portal não suportado
- **WHEN** o portal está num idioma diferente de português, inglês e espanhol e não há escolha no app
- **THEN** a tela aparece em português

#### Scenario: Troca de idioma pelas bandeiras
- **WHEN** o usuário clica numa das bandeiras (Brasil, EUA, Espanha) no topo da tela
- **THEN** a tela passa para o idioma escolhido sem perder a seleção de linha e canal, e a escolha fica gravada como idioma do app
