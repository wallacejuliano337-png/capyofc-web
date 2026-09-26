# Administração da comunidade — validação de 21/09/2026

Projeto: **arena lyc**, `tfjkinffnksmiqatdhnb`. As duas sessões reais existentes de Coronel e Naori foram reutilizadas, com storages separados. Nenhum usuário foi criado ou apagado. Nenhum instalador ou redesign foi produzido.

## Implementação

- Configurações da comunidade separadas de criar/entrar/sair. O acesso administrativo depende das permissões da comunidade, não do cargo global do profile. Cada seção verifica a sua permissão.
- Reutilizados criar/editar/excluir categorias, canais de texto e voz. Exclusões continuam lógicas: dados e histórico são preservados. Categoria com canais ativos não pode ser excluída.
- Botões subir/descer persistem a ordem em operações RPC atômicas. Listas incompletas, repetidas ou com IDs de outra categoria/comunidade são rejeitadas.
- Cargos personalizados: criar, renomear, definir prioridade, editar permissões, atribuir, remover e excluir. Reutilizado `community_members.role_id`: **um cargo por membro por comunidade**. Remoção retorna a MEMBER; excluir cargo atribuído também retorna seus membros a MEMBER. Acúmulo de múltiplos cargos não faz parte deste modelo atual.
- Permissões: administrar comunidade, gerenciar canais/cargos/membros, criar convites, enviar mensagens, entrar em voz, falar, compartilhar tela e moderar membros. Foram reutilizados o catálogo e as verificações existentes.
- Hierarquia no backend: não é permitido modificar cargo igual/superior ao do ator, editar o próprio cargo, elevar a própria atribuição ou conceder permissão não possuída. OWNER está protegido e mantém controle total. Cargos padrão não podem ser excluídos. Transferência é ação separada, exclusiva do proprietário, com confirmação exata do nome da comunidade no backend e na interface.
- Convites: lista persistente, código aleatório, validade, limite/contagem de usos, cópia e revogação. Entrada continua validada atomicamente pelo backend. Reentrar já sendo membro não consome outro uso.
- Realtime existente por revisão da comunidade reutilizado para canais, categorias, cargos, permissões, membros e convites. Mudanças das permissões de mídia renovam a conexão LiveKit do aplicativo com novo token.

## Migration aplicada

**`20260921174314_community_administration.sql`**, uma vez, somente no projeto acima.

A migration acrescentou `community_roles.deleted_at`, substituiu a unicidade do nome por índice para cargos ativos e estendeu `private.community_command`. Não criou tabelas duplicadas, não reaplicou migrations anteriores, não alterou cargos globais, policies ou publicação Realtime. A definição anterior da função foi preservada no backup privado já existente.

`supabase/rollback/community_administration.sql` restaura o contrato anterior das operações, mantendo a coluna/índice aditivos e todos os dados. É um rollback funcional deliberadamente não destrutivo, validado localmente; não foi executado no ambiente real. Qualquer aplicação futura deve ser registrada em nova migration revisada.

## Testes com Coronel e Naori

- OWNER criou, editou e reordenou categoria, canal de texto e canal de voz pela UI; Naori recebeu as mudanças sem refresh.
- OWNER criou/renomeou cargo, mudou prioridade e permissões e o atribuiu a Naori. Lista de membros e acesso à configuração atualizaram por Realtime.
- Delegação positiva: com Gerenciar canais, Naori editou o canal de teste. Sem Gerenciar cargos, continuou bloqueada para criar cargo.
- Como MEMBER, Naori recebeu **42501** em 17 ações RPC administrativas, incluindo categorias, canais, ordenação, cargos, convites e transferência. Escrita direta nas tabelas administrativas e INSERT direto em channels: **42501**. UPDATE direto em channels: **zero linhas alteradas**.
- Remoção de Enviar mensagens: INSERT real de Naori negado com **42501**.
- Remoção de Compartilhar tela: token LiveKit real continha apenas `microphone`, identidade autenticada correta e sala `lyc-<UUID do canal>`. Nenhum token ou secret foi registrado.
- Remoção de Entrar em voz: aplicativo de Naori desconectou; RPC retornou false; Edge Function retornou **403**, sem token. Exclusão do cargo de teste atribuído restaurou MEMBER e a conexão ao lobby.
- Cargos/canais/categoria novos de teste foram arquivados pela interface; desapareceram na outra sessão sem refresh. Nenhum item anterior foi excluído.
- Em comunidade de teste separada: Coronel criou/editou a comunidade; Naori entrou por código pela interface; owner recebeu novo membro e uso do convite por Realtime; Naori saiu; reentrada com convite de uso único esgotado foi rejeitada; revogação também bloqueou entrada.
- Chat #geral: Coronel → Naori e Naori → Coronel, mensagens recebidas sem refresh.
- Voz: canal dinâmico existente `voz-validacao`, participantes e microfone nos dois sentidos; pacotes RTP de áudio recebidos. Troca lobby → treino → lobby removeu/adicionou corretamente o participante.
- Compartilhamento apenas da janela do LYC Arena nos dois sentidos: vídeo recebido e decodificado **1102×720**, mais de dois frames em cada direção. Transmissões encerradas; nenhuma gravação de mídia.
- As duas sessões ficaram conectadas no lobby, microfones desligados, sem transmissão.

Evidências locais ignoradas pelo versionamento: `.cache/administration-live-validation.json`, `.cache/administration-invites-validation.json`, `.cache/administration-voice-validation.json`, `.cache/administration-screen-validation.json`, `.cache/administration-regression-validation.json`, `.cache/administration-voice-permissions.json`.

## Preservação e checks

Comparação antes/depois por IDs e conteúdo: **12 canais anteriores preservados**, **15 mensagens anteriores preservadas**, vínculos originais de membros preservados. Coronel permanece OWNER e Naori MEMBER na Comunidade LYC; ambos continuam MEMBER globalmente. Ao final há 14 registros de canais (os dois novos estão arquivados) e 17 mensagens (duas mensagens adicionais de teste). Permanecem também uma categoria arquivada, dois cargos personalizados arquivados e uma comunidade de teste (`Validação admin 3066424 OK`), com convite revogado e a saída de Naori registrada.

- Typecheck: aprovado.
- ESLint: aprovado.
- Vitest: **41 testes / 6 arquivos aprovados**. PostgreSQL isolado cobre permissões, hierarquia, convites/expiração, preservação de mensagens, ordenação e rollback. Os usuários sintéticos desses testes existem apenas no banco de testes em memória.
- Todas as tabelas públicas permanecem com RLS. Função administrativa não é executável por anon. Advisor de segurança não apontou novos problemas; mantém o aviso preexistente de proteção contra senhas vazadas desabilitada no Auth.

## Limites e teste manual

Os testes reais usaram duas sessões neste computador. Qualidade audível, eco, volume, indicador de fala com voz humana e comportamento entre dois computadores/redes continuam dependendo de teste manual. Nenhum teste automatizado aqui equivale a ouvir a conversa.

As permissões de mídia são impostas pelo servidor nos novos tokens. O aplicativo oficial reconecta quando elas mudam. Tokens e conexões LiveKit já autorizados de um cliente externo/modificado não são revogados automaticamente por esta etapa; revogação imediata de uma conexão externa requer sincronização server-side com a API de participantes LiveKit. Não foi acrescentado um serviço de moderação de sessões nesta entrega.

A transferência válida de propriedade não foi exercitada na comunidade real, para preservar Coronel como OWNER. O bloqueio de transferência não autorizada/sem confirmação foi testado.

## Arquivos de produção alterados

- `src/features/communities/Communities.tsx`
- `src/features/communities/CommunityAdministration.tsx` (novo)
- `src/services/communities.ts`
- `src/App.tsx` (renovação da sessão quando permissões de mídia mudam)
- `supabase/migrations/20260921174314_community_administration.sql` (nova)
- `supabase/rollback/community_administration.sql` (novo)
- `tests/database.test.ts`

O código de chat, a geração de tokens na Edge Function e os componentes de voz/tela existentes foram reutilizados.
