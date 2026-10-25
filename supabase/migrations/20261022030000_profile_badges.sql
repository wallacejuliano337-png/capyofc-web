-- CapyChat Oficial - Migração Aditiva e Segura para Insígnias de Perfil
-- Preserva todas as contas existentes, permissões e políticas RLS.

-- 1. Coluna de preferências de exibição de insígnias no perfil público
alter table public.profiles
  add column if not exists displayed_badges text[] default null;

-- 2. Conceder permissão de leitura e atualização para usuários autenticados
-- A política RLS profiles_edit já garante que auth.uid() = id,
-- portanto cada usuário só pode atualizar as próprias preferências.
grant update (displayed_badges) on public.profiles to authenticated;
grant select (displayed_badges) on public.profiles to authenticated;

-- 3. Comentário descritivo da coluna
comment on column public.profiles.displayed_badges is
  'Lista de identificadores de insígnias oficiais que o usuário optou por exibir em seu perfil público. O frontend e o backend garantem que apenas insígnias efetivamente conquistadas/desbloqueadas sejam exibidas.';
