-- ==============================================================================
-- CAPYCHAT OFICIAL — ETAPA 1: PRÉ-VISUALIZAÇÃO / DRY-RUN (SOMENTE LEITURA)
-- Executar no SQL Editor do painel Supabase (tfjkinffnksmiqatdhnb)
-- ESTE SCRIPT É ESTRITAMENTE SOMENTE LEITURA. NENHUM DADO É ALTERADO OU EXCLUÍDO.
-- ==============================================================================

WITH raw_candidates AS (
  SELECT unnest(ARRAY[
    'f724e836-be35-4d53-9fd9-4dc97ba1acb9'::uuid,
    '52f38d7d-666e-4f0f-99c2-7d150659bb39'::uuid,
    '95dbc856-1489-40f5-914d-3cbc90cbb4e6'::uuid,
    'a05e5ba0-f76a-4059-8d84-3721761ddd00'::uuid,
    '929794e5-2a05-4fd3-a72d-618e59d7dc25'::uuid,
    '53f5007d-a0ba-4cac-92ee-cf57992168f9'::uuid,
    'f44e2be3-03cd-43e7-995a-719a49f9b012'::uuid,
    '7b477a9a-8ab1-4ea5-9461-12efe1f67365'::uuid,
    'd77517df-6a3c-401d-ad3b-6922faa5992f'::uuid,
    'ed69d1a7-b06c-41f6-8c55-835a7ab28b0b'::uuid,
    'c542a680-42b2-413a-bf9c-83f967493cac'::uuid,
    '8a0274f6-731a-4da9-a97d-06343229dbf7'::uuid,
    '39d81d53-8d89-4f57-a65d-442a72d5e4ad'::uuid,
    'dc9adf11-5776-40f1-878e-abf05f472f06'::uuid,
    '6c0f8eef-3549-4efe-9004-c7e321784383'::uuid,
    '3cb43393-4cdc-4313-9ad5-79cb7605df2c'::uuid,
    '610a5033-2d02-48c0-8477-e45fba6c4a84'::uuid,
    '9b13a11b-0180-4f26-b665-23a28d58e387'::uuid,
    '91738f64-fb1e-464b-abac-a9d0bf45bf33'::uuid,
    '4cffba8e-9053-4147-8dde-05856a07c37f'::uuid,
    '3e014270-244b-499b-aa6d-1607fcba4519'::uuid,
    '2a4ae293-bb97-4e95-9f02-a44551f78fc4'::uuid,
    'cae45643-956a-4f75-a8fa-d7c279cebf5f'::uuid,
    'a58a003b-6df2-4dda-90f5-3f9c4dcd0043'::uuid,
    '06f17e89-d088-46ed-a254-cfc79217480c'::uuid,
    '3a607ed3-ec3c-49f4-89cd-2e37fc566bb9'::uuid,
    '811408b4-31cf-4b76-ad0b-d800acc9f157'::uuid,
    'caa4962e-b170-42ed-aafa-fa11544163de'::uuid,
    '857daae0-274a-46b3-86b5-86ccb5590d1f'::uuid,
    'd5f11ad9-d964-4ec7-9bc6-f38a3c9d5477'::uuid,
    'cb149b42-f4ff-450e-854b-5ee6bb72a161'::uuid,
    'ad9ffc6e-38a5-4ed3-a486-b6f6febd7a20'::uuid,
    '88b43829-8bdb-4594-b52e-25d14c6d4754'::uuid,
    '31022437-2bd6-43ec-9928-9c036d4c196d'::uuid,
    '40982cea-dd0f-47d7-8a86-963bac7d4f09'::uuid,
    '000fd306-9ad4-40dc-a04e-8e31dcdc77c2'::uuid,
    '1f3fdac8-67b6-4661-8ffc-5cdd5db73cb0'::uuid,
    '4ae28e23-67b8-4d11-8f73-bd6da4dd2c10'::uuid,
    '9a01d454-06df-48fc-8b2d-614af3778d98'::uuid,
    '5f9bbc35-e688-4e1f-b6c2-813dc3c4d14a'::uuid,
    'b230b2b6-f2b2-44af-810d-2a8aa44142d6'::uuid,
    '6df208d7-2872-434d-92c5-87124302269d'::uuid,
    'e6bdce18-9987-483a-9168-3fdfd0f64942'::uuid,
    '989cef9a-0649-4b21-b429-62d0c1716500'::uuid,
    '0d080b14-b714-4193-abbe-4ea3fd8c0b52'::uuid,
    'ff8fea75-591b-4b5b-ac5a-69990f4e07f4'::uuid,
    'd9bb15ae-30fa-4922-8ee7-0dca01b84a34'::uuid,
    '05063ba9-db4a-423e-8329-81701e8966ce'::uuid,
    '583edf45-058f-4292-b93e-d7ae4a07805d'::uuid,
    '4e0d30c0-bc2d-401f-8bbe-3f4bf1a66c7a'::uuid,
    'ff997b21-8be6-4acb-a980-ac28d8f8bb3b'::uuid,
    '82668c61-d66c-4160-84cf-6f59236a77b5'::uuid,
    'f2e463e2-a983-4511-bd16-397af49462cd'::uuid,
    'a8879b28-cca6-4a7b-b5c4-8e2741a0716a'::uuid,
    'be75df30-9abd-45d9-91b9-f13524b4919d'::uuid,
    '791164b0-1ca9-4e6b-9fa1-12040b1be515'::uuid
  ]) AS id
),
test_targets AS (
  SELECT DISTINCT id FROM raw_candidates
),
legitimate_guard AS (
  SELECT unnest(ARRAY[
    'f8fcd139-cf43-4873-bd7d-a807ecd73567'::uuid, -- Coronel (Fundador)
    '96dde735-f6d8-4aaf-abd7-0176e44888f2'::uuid, -- Naori
    '7a4901f2-d51f-4747-9c5a-6b3aa716ada6'::uuid, -- Kirito
    '73426b78-425e-486a-abb5-951bf7ca959d'::uuid, -- Everton
    '89ef8f98-37c5-4199-b598-88c90ae2db6e'::uuid, -- HERMAN BETA
    'eda43ba0-44ee-4565-a0e7-bad81800e715'::uuid, -- FOOX7
    '33e0a99f-c10b-4057-b23d-85cf5fc13ba9'::uuid  -- Moraex
  ]) AS legitimate_id
)
SELECT 
  1 AS ordem,
  '1. Contagem de UUIDs Candidatos Fornecidos' AS verificacao,
  (SELECT count(*)::text FROM raw_candidates) AS quantidade,
  CASE WHEN (SELECT count(*) FROM raw_candidates) = 56 THEN 'OK (56 IDs)' ELSE 'DIVERGÊNCIA' END AS status_validacao

UNION ALL

SELECT 
  2,
  '2. Contagem de IDs Repetidos ou Duplicados',
  ((SELECT count(*) FROM raw_candidates) - (SELECT count(*) FROM test_targets))::text,
  CASE WHEN (SELECT count(*) FROM raw_candidates) = (SELECT count(*) FROM test_targets) THEN 'OK (Zero duplicatas)' ELSE 'ALERTA: IDs duplicados' END

UNION ALL

SELECT 
  3,
  '3. Proteção de Segurança: IDs Legítimos Detectados na Lista',
  (SELECT count(*)::text FROM test_targets t JOIN legitimate_guard g ON t.id = g.legitimate_id),
  CASE WHEN (SELECT count(*) FROM test_targets t JOIN legitimate_guard g ON t.id = g.legitimate_id) = 0 THEN 'APROVADO (Zero contas legítimas em risco)' ELSE 'BLOQUEADO: ID LEGÍTIMO DETECTADO' END

UNION ALL

SELECT 
  4,
  '4. Existência em auth.users',
  (SELECT count(*)::text FROM auth.users WHERE id IN (SELECT id FROM test_targets)),
  '56 esperados'

UNION ALL

SELECT 
  5,
  '5. Existência em public.profiles',
  (SELECT count(*)::text FROM public.profiles WHERE id IN (SELECT id FROM test_targets)),
  '56 esperados'

UNION ALL

SELECT 
  6,
  '6. Registros em public.community_members (Associação de Membro)',
  (SELECT count(*)::text FROM public.community_members WHERE user_id IN (SELECT id FROM test_targets)),
  '56 esperados (1 por usuário na comunidade oficial)'

UNION ALL

SELECT 
  7,
  '7. Registros em public.server_templates (Modelos Criados em Testes)',
  (SELECT count(*)::text FROM public.server_templates WHERE creator_id IN (SELECT id FROM test_targets)),
  '8 esperados'

UNION ALL

SELECT 
  8,
  '8. Registros em public.user_presence (Presença Social)',
  (SELECT count(*)::text FROM public.user_presence WHERE user_id IN (SELECT id FROM test_targets)),
  '56 esperados'

UNION ALL

SELECT 
  9,
  '9. Registros em public.social_inbox (Caixa Social)',
  (SELECT count(*)::text FROM public.social_inbox WHERE user_id IN (SELECT id FROM test_targets)),
  '1 esperado'

UNION ALL

SELECT 
  10,
  '10. Referência Inesperada: Dono de Comunidade (public.communities)',
  (SELECT count(*)::text FROM public.communities WHERE owner_id IN (SELECT id FROM test_targets)),
  CASE WHEN (SELECT count(*) FROM public.communities WHERE owner_id IN (SELECT id FROM test_targets)) = 0 THEN 'OK (Zero comunidades fake)' ELSE 'BLOQUEADO: Candidato possui comunidade' END

UNION ALL

SELECT 
  11,
  '11. Referência Inesperada: Mensagens em Canais Públicos (public.messages)',
  (SELECT count(*)::text FROM public.messages WHERE author_id IN (SELECT id FROM test_targets)),
  CASE WHEN (SELECT count(*) FROM public.messages WHERE author_id IN (SELECT id FROM test_targets)) = 0 THEN 'OK (Zero mensagens públicas de teste)' ELSE 'BLOQUEADO: Mensagens públicas encontradas' END

UNION ALL

SELECT 
  12,
  '12. Referência Inesperada: Relações de Amizade Ativas (public.friendships)',
  (SELECT count(*)::text FROM public.friendships WHERE user_low IN (SELECT id FROM test_targets) OR user_high IN (SELECT id FROM test_targets)),
  CASE WHEN (SELECT count(*) FROM public.friendships WHERE user_low IN (SELECT id FROM test_targets) OR user_high IN (SELECT id FROM test_targets)) = 0 THEN 'OK (Zero amizades ativas)' ELSE 'BLOQUEADO: Amizades encontradas' END

UNION ALL

SELECT 
  13,
  '13. STATUS GERAL DO DRY-RUN',
  CASE 
    WHEN (SELECT count(*) FROM test_targets t JOIN legitimate_guard g ON t.id = g.legitimate_id) = 0
     AND (SELECT count(*) FROM public.communities WHERE owner_id IN (SELECT id FROM test_targets)) = 0
     AND (SELECT count(*) FROM public.messages WHERE author_id IN (SELECT id FROM test_targets)) = 0
    THEN 'APROVADO'
    ELSE 'BLOQUEADO'
  END,
  CASE 
    WHEN (SELECT count(*) FROM test_targets t JOIN legitimate_guard g ON t.id = g.legitimate_id) = 0
     AND (SELECT count(*) FROM public.communities WHERE owner_id IN (SELECT id FROM test_targets)) = 0
     AND (SELECT count(*) FROM public.messages WHERE author_id IN (SELECT id FROM test_targets)) = 0
    THEN 'Condições seguras atendidas. Pronto para execução controlada.'
    ELSE 'Inconsistências encontradas. Não execute a limpeza.'
  END
ORDER BY ordem;
