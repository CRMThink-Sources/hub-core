# App: Sonax

## O que é (nível suporte)
Integração de **telefonia** entre o sistema **SonaVoip** e o Bitrix24: registra as
chamadas (início, andamento e encerramento) no CRM do parceiro, aciona discagem
pelo card (click2call), roda **campanhas de discagem preditiva** e anexa a
**gravação de áudio** de cada chamada ao registro no Bitrix24. Depende de o parceiro
ter o app instalado, a configuração salva e a instância de telefonia provisionada.

> Este contexto é apoio interno de triagem. Não descreva arquitetura, fluxo interno
> ou "como funciona por dentro" para o solicitante — só use para identificar o modo
> de falha e guiar a resolução do erro.

## Modos de falha comuns (para triar)

### Instalação / configuração do parceiro (resolve com o parceiro)
- **App não instalado no portal** → `sonax.app.not_installed`.
- **Portal reconhecido, mas usuário sem cadastro** → `sonax.app.user_not_found`
  (a instalação cria o vínculo; reinstalar se deveria existir).
- **Configuração do Sonax não salva** → `sonax.config.not_found`
  (orientar o parceiro a abrir Configurações e salvar).
- **Instância de telefonia ainda não provisionada** → `sonax.instance.not_provisioned`
  (abrir a tela do Sonax para concluir o provisionamento).

### Dado do usuário/ramal no Bitrix24 (resolve conferindo o cadastro)
- **Usuário que originou a chamada não existe no Bitrix24** → `sonax.call.bitrix_user_not_found`.
- **Usuário sem ramal configurado** → `sonax.call.ramal_not_configured`
  (preencher o telefone interno do usuário no Bitrix24).
- **Nenhum usuário corresponde ao ramal da chamada** → `sonax.call.ramal_user_not_found`.

### Discagem preditiva (resolve no painel/lista do parceiro)
- **Enviou sem campanha e/ou sem contatos** → `sonax.preditiva.missing_campaign_or_contacts`.
- **Campanha não encontrada** → `sonax.preditiva.campaign_not_found`
  (conferir se existe e está ativa no painel Sonax).
- **Lista de contatos veio vazia** → `sonax.preditiva.empty_list`.
- **Contato com identificação/nome inválido** → `sonax.preditiva.invalid_contact`.
- **Contato com telefone inválido** → `sonax.preditiva.invalid_phone`.

### Falhas de comunicação com sistema externo (tentar de novo; escalar se persistir)
- **Não leu/gravou a configuração no Bitrix24** → `sonax.config.load_failed`.
- **Provisionamento da instância falhou** → `sonax.instance.provisioning_failed`.
- **Discagem (click2call) não iniciou** → `sonax.call.click2call_failed`.
- **Chamada não foi registrada no Bitrix24** → `sonax.call.register_failed`.
- **Card da chamada não foi ocultado ao encerrar** → `sonax.call.hide_card_failed`
  (costuma se resolver na próxima sincronização).
- **Contatos da preditiva não subiram** → `sonax.preditiva.upload_failed`.
- **Áudio da chamada não encontrado** → `sonax.job.audio_not_found`
  (alguns tipos de chamada não geram gravação).
- **Download do áudio falhou** → `sonax.job.audio_download_failed`
  (reprocessa sozinho na próxima rodada).
- **Anexo do áudio no card falhou** → `sonax.job.attach_failed`
  (reprocessa sozinho na próxima rodada).

### Benignos / técnicos (não são bug de config — avaliar antes de escalar)
- **Evento para chamada fora do registro** → `sonax.call.not_found`
  (geralmente evento duplicado ou fora de ordem; escalar só se o parceiro relatar
  chamadas sumindo).
- **Inconsistência no registro interno do portal** → `sonax.call.appoption_persist_failed`
  (escalar com o traceKey).
- **Erro inesperado ao processar a chamada** → `sonax.job.process_call_failed`
  e **falha interna não prevista** → `sonax.internal.unexpected` (escalar com o traceKey).

## Dicas de triagem
- A maioria dos tickets é **configuração do parceiro** (app não instalado, config não
  salva, instância não provisionada) ou **cadastro de usuário/ramal** no Bitrix24 —
  não bug.
- Separe a chamada em fases: **início** (click2call/registro), **andamento**,
  **encerramento** e **anexo de áudio** (job). O `errorCode` já diz a fase pela área
  (`call.*`, `preditiva.*`, `job.*`).
- Erros de **áudio** (`job.*`) e de **card oculto** costumam se resolver sozinhos na
  próxima rodada; só escale se persistirem para a mesma chamada.
- Codes de área `internal` (ex.: `sonax.internal.unexpected`,
  `sonax.job.process_call_failed`) são para o dev — escale, não tente resolver.
- Uma mesma chamada aparece em eventos separados (início/andamento/encerramento/job);
  o **id da chamada** (id_chamada) liga as fases entre si.
- Sempre peça o `traceKey` da tela de Logs do app sonax para localizar o evento exato
  e confirmar o `errorCode`.
