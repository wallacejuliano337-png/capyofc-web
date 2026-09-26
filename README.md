# LYC Arena

Fundação executável de um aplicativo Windows para comunidade e organização da liga LYC. Electron + React + TypeScript + Vite + Tailwind CSS, com Supabase para dados/Auth/Realtime e LiveKit para mídia. Identidade própria em grafite/vermelho; o escudo com a letra L é um ícone provisório criado para este projeto.

## Início rápido

Requer Windows x64 e Node.js 22.12+ (esta implementação foi executada com Node 26). PowerShell na pasta do projeto:

```powershell
npm ci
npm run dev
```

Sem variáveis de ambiente, clique em **Explorar modo local**. Chat, equipes e tickets desse modo ficam no localStorage do aplicativo e não se comunicam com outros computadores. O modo local é identificado na tela; não simula participantes conectados, voz ou uma liga em andamento.

Para usar os serviços reais, copie `.env.example` para `.env`, configure as variáveis e reinicie o desenvolvimento. O build incorpora variáveis VITE_ públicas; recrie o instalador após alterar a configuração.

## Comandos

- `npm run dev`: inicia Vite e Electron; o servidor termina junto com a janela. Mudanças em main/preload exigem reiniciar.
- `npm run dev:web`: interface no navegador, com seletor nativo de compartilhamento em vez de IPC Electron.
- `npm run typecheck`: TypeScript do desktop, renderer, testes e Edge Function.
- `npm run lint`: ESLint.
- `npm run test`: testes de validação, PostgreSQL/RLS e emissão de tokens.
- `npm run build`: verifica tipos, compila a interface e gera main/preload.
- `npm run test:desktop`: abre o Electron compilado e exercita os fluxos locais.
- `npm run dist`: build + instalador NSIS Windows x64.
- `npx prettier --write src electron tests scripts *.json *.ts *.js`: formatação.

Para abrir o pacote diretamente nesta máquina, use `Iniciar-LYC-Arena.cmd`; os dados ficam em `.cache/user-data` no D:. O executável também aceita `--user-data-dir=<caminho absoluto>` para escolher uma pasta de dados. A instalação convencional usa a pasta padrão de usuário do Windows.

Saída esperada: `release/LYC-Arena-Setup.exe`. A pasta `release/win-unpacked` contém a aplicação sem instalador. O executável inicial não tem assinatura de código; o Windows pode apresentar aviso de editor desconhecido. Não foi configurado servidor de atualização.

O script de empacotamento usa temporários e caches em `.cache` neste projeto. Nesta máquina o disco C: estava sem espaço; o Electron foi instalado usando TEMP, TMP e electron_config_cache apontados para o disco D:. Para repetir uma instalação nessa condição:

```powershell
New-Item -ItemType Directory -Force .cache/tmp,.cache/electron | Out-Null
$env:TEMP = Join-Path $PWD '.cache/tmp'
$env:TMP = $env:TEMP
$env:electron_config_cache = Join-Path $PWD '.cache/electron'
npm ci
node node_modules/electron/install.js
```

## Estrutura e fronteiras

- `electron/main.ts`: janela, política de navegação/permissões, captura e notificações.
- `electron/preload.ts`: ponte mínima via contextBridge; nenhum acesso geral a Node, shell ou arquivos.
- `src/App.tsx`: navegação e composição da interface.
- `src/features`: auth, chat, equipes, tickets, liga, voz, perfil e administração.
- `src/services`: integrações de chat, mídia, notificações e armazenamento local.
- `src/hooks`, `src/components`, `src/lib`, `src/types`: funcionalidades compartilhadas.
- `supabase/migrations`: estrutura e políticas do banco.
- `supabase/functions/livekit-token`: endpoint de emissão de tokens, exclusivamente no servidor.
- `tests`: testes automatizados de segurança e autorização.
- `scripts`: desenvolvimento, build, empacotamento, ícone e teste desktop.
- `assets/icon.png` e `assets/icon.ico`: ícones provisórios. Substitua-o por PNG quadrado de pelo menos 256 px antes da distribuição oficial.

O renderer usa `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false` e CSP. Popups, navegação arbitrária e webviews são bloqueados. IPC verifica remetente e frame principal; entradas são validadas. Capture selection vale por 15 segundos e só pode ser usada uma vez. Build de produção não aceita URL de desenvolvimento.

O Auth mantém a sessão no armazenamento da origem isolada do Electron; o token de usuário não é uma credencial privilegiada. Proteção adicional com armazenamento criptografado é uma evolução possível. Nenhum segredo LiveKit ou service_role é incluído no renderer.

## Supabase

Use um projeto dedicado de desenvolvimento para a primeira configuração. A migration depende dos schemas padrão `auth`, `realtime` e da publicação `supabase_realtime`.

1. Configure `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`.
2. Aplique `supabase/migrations/20260920083236_initial_arena.sql` em um projeto novo pelo SQL Editor ou pelo fluxo de migrations da CLI. Consulte `npx supabase --help` para vincular seu próprio projeto; nenhum projeto remoto foi criado ou alterado automaticamente.
3. Habilite login por e-mail/senha e confirmação de e-mail. Configure SMTP para entrega real.
4. Para recuperação dentro do desktop, personalize o template **Reset Password** para mostrar `{{ .Token }}`. O aplicativo recebe e-mail, verifica o OTP e permite escolher uma nova senha, sem depender de redirecionamento file://.
5. Cadastre uma conta e confirme o e-mail. Seu perfil nasce com cargo MEMBER.
6. Pelo SQL Editor de administração, atribua OWNER ao UUID correto: `update public.profiles set role = 'OWNER' where id = '<UUID confirmado>';`
7. Ative somente canais privados de Realtime para broadcast/presence conforme as políticas já definidas. Postgres Changes é habilitado pela migration.

A chave publishable é pública por definição. Use apenas ela ou a anon legada no cliente. Nunca coloque service_role, chave secreta Supabase ou API secret LiveKit em qualquer VITE_.

### Modelo e autorização

Inclui perfis, cargos, equipes/elencos, canais/membros, mensagens/replies/reações, tickets/conversa/histórico, temporadas, grupos, inscrições, rodadas, partidas/resultados, punições e auditoria. Canais `kind=voice` representam salas; a sala LiveKit é derivada como `lyc-<UUID do canal>`.

Todas as tabelas da aplicação têm RLS. Grants existentes nessas tabelas são revogados antes de aplicar permissões explícitas, incluindo restrições por coluna. Usuários não podem editar cargo, autoria, dono do ticket ou capitã através do REST. Metadados de cadastro nunca definem permissões.

Funções SECURITY DEFINER ficam no schema privado, com search_path vazio e permissões limitadas. São usadas para consultas de autorização sem recursão de RLS e triggers internos. Os RPCs públicos são SECURITY INVOKER. A criação de equipe é atômica e gera elenco inicial e dois canais privados.

- MEMBER pode conversar em canais públicos, criar equipe e abrir/ver seus tickets.
- A capitã gerencia jogadores/reservas da própria equipe; a titularidade vem de captain_id, não de um cargo global autodeclarado.
- STAFF/MODERATOR e superiores atendem tickets e moderam mensagens acessíveis.
- ADMIN/OWNER administram canais; o banco possui estrutura para demais ações administrativas.
- BAN bloqueia leitura dos dados; MUTE impede escrita e nova entrada em voz; REMOVE_CHANNEL bloqueia o canal específico.
- Ações em canais, cargos, temporadas e punições possuem auditoria; tickets possuem histórico separado.

Criação de usuários pelo Auth e atribuições iniciais via SQL precisam ser feitas por operador autorizado. Nunca exponha o SQL Editor aos membros.

### Realtime e mensagens

Histórico paginado de 40 mensagens, envio, edição, exclusão, respostas e reação 🔥. Atualizações via Postgres Changes; digitação e presença usam canais privados com políticas. Scroll acompanha novas mensagens apenas quando o usuário está próximo do fim. Conteúdo é texto escapado por React, sem HTML arbitrário.

Uploads ainda não estão habilitados: `src/types/attachments.ts` reserva o contrato para imagens/arquivos/GIFs. Será preciso adicionar Storage com políticas e validação de tamanho/MIME. Presença indica quem está naquele canal; não afirma que um usuário ausente do canal está offline no aplicativo inteiro.

## LiveKit e endpoint seguro

O servidor LiveKit é separado do Supabase. Nenhum áudio ou vídeo é transportado pelo banco.

1. Configure uma instância LiveKit Cloud ou self-hosted acessível por WSS, com TLS e TURN adequados.
2. Configure segredos da Edge Function: LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET (veja `supabase/functions/.env.example`). SUPABASE_URL e SUPABASE_ANON_KEY são fornecidos pelo ambiente Supabase.
3. Publique a função `livekit-token` no seu projeto. `verify_jwt=false` desativa apenas a validação legada do gateway: o handler exige Bearer e valida o usuário com `auth.getUser()` antes de fazer qualquer concessão.
4. O app deriva o endpoint de `VITE_SUPABASE_URL` automaticamente (`/functions/v1/livekit-token`). `VITE_LIVEKIT_TOKEN_ENDPOINT` é uma substituição pública opcional. Nenhum segredo LiveKit deve ser colocado no `.env` do renderer.
5. Teste com duas contas autorizadas em máquinas diferentes.

O endpoint consulta o RPC sob o JWT do próprio usuário (RLS), confirma canal de voz e permissões e assina token de cinco minutos. A identidade é derivada do Auth, nunca do corpo da requisição. O token concede somente a sala solicitada e publicação de microfone/tela/áudio da tela; sem câmera, dados ou administração de sala.

Tokens curtos restringem novas entradas; sua expiração **não desconecta uma sessão já estabelecida**. Expulsão imediata após banimento exige integração adicional server-to-server com LiveKit RoomService e revogação de sessões. Não trate punições no banco como expulsão instantânea de mídia já conectada. Adicione rate limiting de emissão antes de distribuição ampla.

## Voz, tela e áudio no Windows

A sala permite entrada com microfone desligado, ligar/desligar microfone, selecionar entrada/saída quando disponível, silenciar áudio recebido, ver participantes e detectar quem fala. A conexão persiste ao navegar entre módulos e é encerrada no logout. Clicar em um canal de voz inicia a entrada; clicar em outro desconecta a sala anterior antes da nova conexão. Pedidos substituídos são cancelados e as transições são serializadas, inclusive durante conexão pendente. A entrada sempre começa com microfone desligado.

No Electron, `desktopCapturer.getSources` lista monitores e janelas com miniaturas. Uma escolha explícita alimenta `session.setDisplayMediaRequestHandler`, e `getDisplayMedia` fornece as tracks publicadas pelo LiveKit. Há indicação AO VIVO, assistir, fechar visualização e tela cheia. Fim da fonte, encerramento e desconexão limpam as tracks.

Perfis: 720p/30, 1080p/30 e 1080p/60. Resolução/FPS dependem do SO, fonte, hardware e conexão. Para falha de restrição/leitura em qualidade maior, tenta 720p sem áudio; recusa de permissão é informada. É possível tentar manualmente uma fonte diferente.

Áudio usa `audio: 'loopback'` do Electron no Windows, apenas se o usuário marcar a opção. É áudio do **sistema**, mesmo selecionando uma janela. Não há promessa de captura exclusiva do áudio daquele aplicativo. Ausência de track de áudio é avisada; microfone e áudio remoto continuam separados. Use fones para evitar realimentação.

Referências oficiais consultadas:
- [Electron: captura e áudio loopback](https://www.electronjs.org/docs/latest/api/session#sessetdisplaymediarequesthandlerhandler-opts)
- [Electron: segurança](https://www.electronjs.org/docs/latest/tutorial/security)
- [LiveKit: compartilhamento](https://docs.livekit.io/transport/media/screenshare/)
- [LiveKit: tokens e grants](https://docs.livekit.io/frontends/reference/tokens-grants/)
- [Supabase: Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)

## Competição, administração e notificações

Darkness League possui visualização de temporadas e calendário, com schema para grupos, partidas e resultados. Nenhum sistema de pontuação foi inventado. `seasons.scoring_rules` é JSON configurável; `external_system_id` e `match_results.external_payload` permitem futura integração. Cálculo da classificação e editor completo da competição ainda precisam ser implementados.

O painel inicial de ADMIN/OWNER cria/exclui canais. Gestão visual de cargos, usuários, punições, temporadas e logs é evolução; a autorização correspondente está no banco. Transferência de capitã exige um futuro endpoint transacional autorizado.

Notificações nativas de menção e resposta a ticket estão conectadas aos eventos; o processo principal limita a frequência e não notifica com a janela em foco. O serviço tipado reserva eventos de anúncio, rodada, convite e mensagem importante, que ainda dependem de produtores de eventos. Não há push com o aplicativo fechado.

## Verificação e limites

Testes usam PGlite (PostgreSQL em WASM), com schemas Auth/Realtime mínimos para executar a migration e exercitar RLS como roles reais. Isso valida SQL e autorização local, mas não substitui teste de Supabase hospedado, entrega de e-mail, Realtime e concorrência entre clientes.

O teste do endpoint verifica rejeição sem autenticação, usuário inválido, sala sem permissão e assinatura/escopo do JWT com credenciais fictícias de teste. Não usa segredos reais.

O teste desktop abre uma janela real e verifica navegação, persistência local, chat, equipes, tickets, contexto isolado e captura real de vídeo. Também foi executado sobre o aplicativo empacotado. Artefatos ficam em `test-results/`.

Limites desta fundação:
- Sem credenciais externas, Auth/Realtime remoto e mídia entre participantes não puderam ser homologados.
- Sem servidor LiveKit real, não se comprova qualidade de vídeo, reconexão, TURN ou áudio loopback ouvido por um segundo participante.
- Modo local não é um backend de produção e não oferece backup multiusuário.
- Reação inicial única (🔥), sem upload, pesquisa completa, convite de equipe ou edição visual de toda a liga.
- Lista de perfis limitada aos primeiros 100; escalar com busca/paginação.
- Datas e textos ainda não têm internacionalização além do português.
- Sem assinatura do instalador e sem atualizações automáticas. A estrutura main/preload e electron-builder permite incorporar electron-updater após definir hospedagem, assinatura e política de releases.
- Somente tokens e dados acessíveis ao usuário são armazenados no cliente; dispositivos compartilhados exigem logout e proteção da conta Windows.

Próximos passos: configurar serviços e SMTP; validar RLS com contas reais; homologar mídia em duas máquinas e diferentes redes; implementar revogação de mídia e rate limiting; integrar pontuação existente; completar administração; substituir ícone provisório e assinar o instalador.

### Configuração LiveKit Cloud — arena lyc

A Edge Function `livekit-token` foi publicada no projeto `tfjkinffnksmiqatdhnb`. Cadastre as três variáveis em [Edge Functions → Secrets](https://supabase.com/dashboard/project/tfjkinffnksmiqatdhnb/functions/secrets):

- `LIVEKIT_URL`: URL WSS do projeto LYC ARENA no LiveKit Cloud.
- `LIVEKIT_API_KEY`: chave de API do mesmo projeto.
- `LIVEKIT_API_SECRET`: secret correspondente, diretamente no Dashboard, nunca no chat ou frontend.

Salve cada entrada. Não é necessário redeploy após cadastrar os secrets. O cadastro é feito no Supabase Cloud, não no `.env` raiz do aplicativo. [Documentação Supabase](https://supabase.com/docs/guides/functions/secrets).

Validação desta etapa: typecheck/lint e testes locais; função remota rejeitou POST sem autenticação (401) e aceitou OPTIONS (200). A validação de áudio real, microfones, participantes, reconexão e troca de sala entre Coronel e Naori depende do cadastro das credenciais e será feita na próxima etapa. As instâncias Electron da etapa anterior não estavam em execução; seus diretórios de sessão foram preservados.
