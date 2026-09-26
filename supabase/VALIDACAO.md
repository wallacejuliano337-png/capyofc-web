# Validação do Supabase — LYC Arena

Projeto exclusivo: arena lyc
Project ref: tfjkinffnksmiqatdhnb
Região: sa-east-1

## Migration

O Supabase confirmou que initial_arena já havia sido aplicada com sucesso antes da interrupção anterior. O bloqueio de uso ocorreu durante uma consulta de validação posterior.

Histórico remoto: 20260920083236 / initial_arena. Na validação inicial, existia exatamente uma migration, que não foi reaplicada. A correção incremental posterior está registrada ao final deste documento.

O arquivo local foi renomeado para migrations/20260920083236_initial_arena.sql para corresponder ao histórico remoto. O SQL permaneceu igual. A comparação MD5 confirmou igualdade com o SQL aplicado, considerando apenas a quebra de linha final adicionada pelo terminal.

## Estruturas existentes

19 tabelas: roles, profiles, teams, team_members, channels, channel_members, moderation_actions, messages, message_reactions, tickets, ticket_messages, ticket_history, seasons, groups, season_teams, rounds, matches, match_results, audit_logs.

- RLS habilitado nas 19 tabelas.
- 40 policies no schema public.
- 2 policies de autorização de broadcast/presença em realtime.messages, também com RLS.
- 7 cargos iniciais e 10 canais.
- 7 triggers ativos: on_user_created, on_team_created, on_ticket_changed, audit_channels, audit_roles, audit_moderation, audit_seasons.
- Nenhuma função SECURITY DEFINER no schema public.
- O papel authenticated não possui UPDATE na coluna profiles.role.
- O papel anon não possui SELECT em profiles.

## Testes no banco hospedado

Foram executadas transações com usuários e registros temporários, seguidas de ROLLBACK. Não foram alteradas contas existentes nem mantidos usuários de teste.

Aprovados: criação automática do perfil MEMBER mesmo com role OWNER no metadata; bloqueio de alteração de cargo; criação atômica de equipe, capitã e dois canais privados; autoria de mensagens; bloqueio de edição por outro membro; isolamento de canal e ticket; fechamento por staff; bloqueio de respostas em ticket fechado; histórico do ticket; auditoria de canais, cargos, temporadas e moderação.

Contagem após os testes principais: zero usuários Auth, perfis, equipes, tickets e mensagens; os 10 canais iniciais permanecem.

## Realtime

A publicação supabase_realtime contém messages, message_reactions, tickets e ticket_messages, com INSERT/UPDATE/DELETE habilitados.

As policies foram testadas no banco real: broadcast/presença para membro autorizado, negação para usuário externo e tópico inválido. Todos os registros foram revertidos.

A primeira tentativa encontrou MissingPartition. Após a inicialização do serviço disponibilizar as partições, o teste transacional passou e a conexão WebSocket retornou Unauthorized para o acesso anônimo a tópico privado, conforme esperado. Não foi criada ou alterada manualmente nenhuma partição.

A entrega de mensagens entre duas contas autenticadas ainda não foi comprovada. Ela depende das contas reais solicitadas ao usuário.

## Autenticação

Validações reais com a chave pública: endpoint Auth HTTP 200; cadastro por e-mail habilitado; confirmação de e-mail obrigatória; credenciais inválidas rejeitadas com invalid_credentials; JWT inválido rejeitado; leitura anônima de profiles negada com 42501.

O trigger de perfil foi exercitado no banco. A tela de login configurada foi verificada na etapa anterior.

Ainda pendente: cadastro pela interface, recebimento e confirmação de e-mail, login válido, refresh/persistência de sessão, logout e recuperação por OTP com duas contas reais. Nenhuma dessas etapas ponta a ponta foi marcada como aprovada sem execução. O aplicativo espera o código {{ .Token }} no template Reset Password, cuja configuração e entrega precisam ser conferidas junto ao teste real.

## Qualidade e avisos

- npm run typecheck: aprovado.
- npm run lint: aprovado.
- npm run test: 21 testes aprovados, em três arquivos.
- Supabase Security Advisors: nenhum alerta retornado.
- Performance Advisors: avisos de policies permissivas sobrepostas em 7 tabelas e 6 chaves estrangeiras sem índice, além de índices ainda sem uso no banco novo. Nenhuma alteração adicional foi aplicada, respeitando o pedido de usar somente a migration inicial.

Referências para os avisos de performance:
- https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies
- https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys

## Escopo preservado

Somente o projeto tfjkinffnksmiqatdhnb foi alvo das operações desta validação. Nenhum outro projeto foi alterado. Dados do modo local foram preservados. Nenhum segredo privilegiado foi usado no renderer. Nenhum instalador foi gerado; o instalador anterior continua sendo o pacote antigo.

## Correção do chat com duas contas reais — 20/09/2026

- PostgREST PGRST201: `profiles(*)` tinha duas relações candidatas, o autor por `messages_author_id_fkey` e os participantes das reações por `message_reactions`. O histórico agora seleciona `profiles!messages_author_id_fkey(*)`.
- `reply_to` referencia `messages.id`. Não existem FKs de editor/deleted_by em messages; `edited_at` é somente um timestamp. Os embeds de ticket_messages e team_members foram consultados nas duas sessões sem erros.
- Um teste real de resposta revelou outra falha: a policy messages_insert resolvia `parent.id=reply_to` como `parent.id=parent.reply_to`. A nova migration `20260920180714_fix_message_reply_reference.sql` qualifica `messages.reply_to`, preservando autoria, permissão de escrita, canal de texto e resposta no mesmo canal.
- A migration inicial permaneceu intacta. O histórico remoto contém agora initial_arena e fix_message_reply_reference; somente arena lyc / tfjkinffnksmiqatdhnb foi alterado.
- Coronel → Naori: mensagem exibida em 245 ms. Naori → Coronel: resposta exibida em 896 ms. Tempos incluem automação da interface, não apenas latência de rede.
- Eventos WebSocket postgres_changes/INSERT capturados nas duas sessões; nenhuma navegação ou refresh durante os envios. Autores e reply_to exibidos corretamente; histórico e consulta paginada passaram nas duas contas.
- Seis mensagens identificadas de teste foram preservadas, incluindo tentativas anteriores ao teste final. Nenhum usuário ou dado foi apagado. Sessões/storage continuam separados; nenhum instalador foi gerado.
- Evidência detalhada local: `.cache/chat-realtime-validation.json` (sem credenciais).
- Testes locais acrescentados: resposta a outro autor no mesmo canal; rejeição de resposta entre canais, referência inexistente e autoria falsificada.
