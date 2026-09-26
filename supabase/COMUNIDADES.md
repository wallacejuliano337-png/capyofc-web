# Comunidades — implementação incremental

Projeto exclusivo: arena lyc (`tfjkinffnksmiqatdhnb`).

## Estado desta etapa

Migration aplicada anteriormente: `20260920231745_communities_permissions`. Coronel é OWNER e Naori é MEMBER somente na Comunidade LYC, por autorização explícita do usuário. Os dois profiles.role continuam MEMBER. Nesta retomada, nenhuma migration foi reaplicada, recriada ou adicionada.

## Modelo

- Reutiliza profiles, roles (catálogo global de cargos-base), channels, channel_members, messages, replies, reactions e a autorização de canais já existente.
- Adiciona communities, community_members, community_roles, permissions, community_role_permissions, channel_categories e community_invites.
- Cada canal mantém seu UUID e recebe community_id, category_id e deleted_at. A categoria legada é mantida por compatibilidade. IDs de lobby/treino e nomes de sala LiveKit `lyc-<UUID do canal>` não mudam.
- Cargos de comunidade não modificam profiles.role nem conferem poderes globais sobre liga/tickets.
- O proprietário pode atribuir cargos e transferir a propriedade a um membro ativo antes de sair. Administradores gerenciam canais e convites. Cargos personalizados e múltiplas ações de moderação podem evoluir a partir do catálogo de permissões; a interface de criação de cargos personalizados não faz parte desta etapa.
- Exclusão de canais/categorias é lógica. Categorias com canais ativos não podem ser excluídas.
- Convites são códigos aleatórios de 128 bits com expiração opcional, limite de usos, contagem e revogação. A aceitação usa bloqueio transacional do convite; uma segunda aceitação pelo mesmo membro não consome outro uso. Entrada/saída não apaga o registro de associação.
- Todas as tabelas novas têm RLS e grants explícitos. Mutação sensível passa pelo RPC security invoker e por uma função privada com verificação de ator, comunidade e permissão; permissões nunca vêm do corpo do cliente.
- Revisões de comunidade invalidam as listas via Postgres Changes inclusive quando um canal arquivado deixa de ser legível. Presença privada é somente indicação de disponibilidade.
- O token LiveKit continua autenticado pelo Supabase e passa a conceder microfone/tela apenas conforme as permissões da comunidade. Esse endpoint só deve ser publicado DEPOIS da migration.

## Aplicação

1. Confirmar a conta proprietária com o usuário e obter seu username único já existente no projeto. Não criar conta, não editar profiles.role.
2. Aplicar somente `20260920231745_communities_permissions.sql`, na mesma transação de `select set_config('arena.owner_username', '<username aprovado>', true)`.
3. Publicar a versão local de livekit-token mantendo verify_jwt=false no gateway: a função valida o usuário explicitamente com auth.getUser() antes de conceder acesso.
4. Conferir os 10 canais e 13 mensagens existentes no baseline desta etapa, além dos UUIDs e perfis; qualquer mensagem nova legítima deve ser preservada.
5. Validar Coronel/Naori, permissões, convite, criação e atualização Realtime. O frontend tem compatibilidade de leitura com o schema antigo enquanto a migration não existe.

## Reversão

`rollback/communities_permissions.sql` é um procedimento manual protegido, NÃO uma migration a aplicar automaticamente. Deve ser acompanhado da versão anterior do frontend/Edge Function. Restaura as funções/policies antigas e arquiva os metadados novos em schema sem acesso do cliente, sem excluir perfis, canais ou mensagens.

O script recusa a reversão se já existirem novas comunidades ou novos canais: o schema antigo não consegue representá-los com isolamento equivalente. Nesse caso, usar uma correção incremental à frente, preservando dados. A migration inicial e a correção de replies nunca são reaplicadas. O rollback foi testado em PostgreSQL local isolado, não no projeto real.

## Validação local

Typecheck e lint aprovados. 36 testes aprovados, incluindo regressão do schema anterior, isolamento entre comunidades, rejeição de criação por membro e administrador global externo, movimentação inválida de categoria, convites, atribuição indevida de cargos, exclusão lógica com preservação de mensagens, tokens LiveKit com publicação negada e reversão protegida.

A validação real foi concluída em 21/09/2026, conforme os resultados abaixo. Os secrets LiveKit não foram lidos nem registrados.

## Validação real concluída — 21/09/2026

- Corrigido o payload: o ID vazio do formulário de criação é omitido; IDs de edição são preservados. Backend e RLS não foram afrouxados.
- Corrigida a assinatura de comunidades: removido listener de profiles, tabela fora da publicação Realtime, que fazia o servidor rejeitar a assinatura inteira. A conexão agora autentica antes de assinar e mantém o listener estável durante mudanças de seleção. Chat permanece intacto.
- Coronel criou e editou canal e categoria pela interface. Atualizações chegaram à outra sessão sem refresh, com eventos UPDATE de communities capturados nas duas conexões.
- Naori: criação por RPC, inserção direta via Data API e edição por RPC rejeitadas com 42501. UPDATE direto afetou zero linhas e o nome permaneceu inalterado. Nenhum canal denied foi criado.
- Chat #geral: Coronel → Naori e Naori → Coronel recebidos na interface via INSERT Realtime, sem navegação/refresh durante o teste.
- Voz: ambos no lobby; Naori trocou para treino e voltou, desaparecendo da sala anterior. Canal de voz recém-criado também aceitou ambos usando seu UUID estável.
- Microfone: publicação visível na outra conta e pacotes RTP de áudio recebidos nos dois sentidos, sem gravação do áudio. Qualidade sonora subjetiva depende de confirmação humana.
- Tela: transmissão de uma janela do próprio LYC Arena nos dois sentidos; vídeo remoto decodificado a 1102×720 com frames reproduzidos. Cada transmissão foi encerrada após a validação.
- Estado final: ambas as sessões no lobby, com microfones desligados e sem transmissão de tela.
- Preservação: 10 canais originais intactos; 2 canais de teste adicionados (teste-permissoes-validado e voz-validacao), 1 categoria de teste (VALIDAÇÃO 366942 OK), 2 mensagens de teste adicionadas às 13 anteriores. Nada foi apagado. 26 tabelas públicas com RLS; histórico continua com apenas 3 migrations.
- Typecheck e lint aprovados; 38/38 testes em 6 arquivos aprovados.
- Evidências locais sem credenciais: .cache/communities-live-validation.json, .cache/screen-live-validation.json e .cache/voice-community-validation.json.
- Nenhum instalador gerado e nenhuma reformulação visual realizada.
