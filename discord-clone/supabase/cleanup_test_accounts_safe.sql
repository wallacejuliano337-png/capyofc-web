-- ==============================================================================
-- CAPYCHAT OFICIAL — ETAPA 2: EXECUÇÃO CONTROLADA DA LIMPEZA DE TESTES
-- Executar no SQL Editor do painel Supabase (tfjkinffnksmiqatdhnb)
-- SOMENTE EXECUTAR APÓS REVISÃO E APROVAÇÃO EXPLÍCITA
-- ==============================================================================

DO $$
DECLARE
  v_test_ids uuid[] := ARRAY[
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
  ];

  v_legitimate_ids uuid[] := ARRAY[
    'f8fcd139-cf43-4873-bd7d-a807ecd73567'::uuid, -- Coronel (Fundador)
    '96dde735-f6d8-4aaf-abd7-0176e44888f2'::uuid, -- Naori
    '7a4901f2-d51f-4747-9c5a-6b3aa716ada6'::uuid, -- Kirito
    '73426b78-425e-486a-abb5-951bf7ca959d'::uuid, -- Everton
    '89ef8f98-37c5-4199-b598-88c90ae2db6e'::uuid, -- HERMAN BETA
    'eda43ba0-44ee-4565-a0e7-bad81800e715'::uuid, -- FOOX7
    '33e0a99f-c10b-4057-b23d-85cf5fc13ba9'::uuid  -- Moraex
  ];

  -- TRAVA DE CONFIRMAÇÃO OBRIGATÓRIA:
  -- O script NÃO executará enquanto o valor for 'PENDENTE'.
  -- Para autorizar a exclusão, altere explicitamente a linha abaixo para:
  -- v_confirmacao text := 'CONFIRMO_EXCLUSAO_56_CONTAS_TESTE';
  v_confirmacao text := 'PENDENTE';

  v_in_danger_count integer;
  v_unexpected_count integer;
  v_initial_test_users integer;
  v_del_members integer;
  v_del_presence integer;
  v_del_inbox integer;
  v_del_templates integer;
  v_del_users integer;
  v_remaining_legit integer;
  v_remaining_test integer;
  v_official_community_count integer;
BEGIN
  -- ============================================================================
  -- 1. TRAVAS DE SEGURANÇA MANDATÓRIAS (PRÉ-CONDIÇÕES E CONFIRMAÇÃO EXPLÍCITA)
  -- ============================================================================

  -- 1.1 Confirmação intencional exigida do operador
  IF v_confirmacao <> 'CONFIRMO_EXCLUSAO_56_CONTAS_TESTE' THEN
    RAISE EXCEPTION 'EXECUÇÃO BLOQUEADA: Confirmação obrigatória ausente. Para autorizar, altere v_confirmacao para ''CONFIRMO_EXCLUSAO_56_CONTAS_TESTE''.';
  END IF;

  -- 1.2 Conferência estrita da quantidade de candidatos (esperado: 56)
  IF array_length(v_test_ids, 1) <> 56 THEN
    RAISE EXCEPTION 'ABORTADO: O array de candidatos possui % itens, esperado exatamente 56.', array_length(v_test_ids, 1);
  END IF;

  -- 1.3 Interrupção imediata se houver qualquer UUID legítimo na lista
  SELECT count(*) INTO v_in_danger_count
  FROM unnest(v_test_ids) tid
  WHERE tid = ANY(v_legitimate_ids);

  IF v_in_danger_count > 0 THEN
    RAISE EXCEPTION 'ABORTADO COM ERRO CRÍTICO: % conta(s) legítima(s) detectada(s) na lista de exclusão!', v_in_danger_count;
  END IF;

  -- 1.4 Verificação de referências inesperadas (nenhum candidato pode ser dono de comunidade)
  SELECT count(*) INTO v_unexpected_count
  FROM public.communities
  WHERE owner_id = ANY(v_test_ids);

  IF v_unexpected_count > 0 THEN
    RAISE EXCEPTION 'ABORTADO: % candidato(s) é proprietário de comunidade!', v_unexpected_count;
  END IF;

  -- 1.5 Verificação de mensagens em canais públicos
  SELECT count(*) INTO v_unexpected_count
  FROM public.messages
  WHERE author_id = ANY(v_test_ids);

  IF v_unexpected_count > 0 THEN
    RAISE EXCEPTION 'ABORTADO: % mensagem(ns) pública(s) de candidatos encontradas em canais!', v_unexpected_count;
  END IF;

  -- 1.6 Verificação de amizades ativas com contas legítimas
  SELECT count(*) INTO v_unexpected_count
  FROM public.friendships
  WHERE (user_low = ANY(v_test_ids) OR user_high = ANY(v_test_ids))
    AND (user_low = ANY(v_legitimate_ids) OR user_high = ANY(v_legitimate_ids));

  IF v_unexpected_count > 0 THEN
    RAISE EXCEPTION 'ABORTADO: % relação(ões) de amizade com usuários legítimos detectada(s)!', v_unexpected_count;
  END IF;

  -- 1.7 Verificação de existência inicial dos candidatos (impede falso positivo na repetição)
  SELECT count(*) INTO v_initial_test_users
  FROM auth.users
  WHERE id = ANY(v_test_ids);

  IF v_initial_test_users = 0 THEN
    RAISE EXCEPTION 'OPERAÇÃO JÁ CONCLUÍDA ANTERIORMENTE: Nenhuma das 56 contas de teste existe em auth.users. O banco já está higienizado.';
  END IF;

  IF v_initial_test_users <> 56 THEN
    RAISE EXCEPTION 'DIVERGÊNCIA DE CANDIDATOS: Encontradas % contas de teste em auth.users (esperado: exatamente 56). Operação abortada por precaução.', v_initial_test_users;
  END IF;

  -- ============================================================================
  -- 2. REMOÇÃO DE DEPENDÊNCIAS FILHAS SEM CASCADE (ORDEM ESTRITA DE CHAVES FK)
  -- ============================================================================

  -- 2.1 Membros da comunidade
  WITH deleted AS (
    DELETE FROM public.community_members
    WHERE user_id = ANY(v_test_ids)
    RETURNING 1
  )
  SELECT count(*) INTO v_del_members FROM deleted;

  -- 2.2 Modelos de servidor criados em testes
  WITH deleted AS (
    DELETE FROM public.server_templates
    WHERE creator_id = ANY(v_test_ids)
    RETURNING 1
  )
  SELECT count(*) INTO v_del_templates FROM deleted;

  -- 2.3 Registros de presença pública e privada
  WITH deleted AS (
    DELETE FROM public.user_presence
    WHERE user_id = ANY(v_test_ids)
    RETURNING 1
  )
  SELECT count(*) INTO v_del_presence FROM deleted;

  DELETE FROM private.presence_preferences WHERE user_id = ANY(v_test_ids);
  DELETE FROM private.presence_sessions WHERE user_id = ANY(v_test_ids);

  -- 2.4 Caixa de entrada social e dados relacionais
  WITH deleted AS (
    DELETE FROM public.social_inbox
    WHERE user_id = ANY(v_test_ids)
    RETURNING 1
  )
  SELECT count(*) INTO v_del_inbox FROM deleted;

  DELETE FROM public.friendships 
  WHERE user_low = ANY(v_test_ids) OR user_high = ANY(v_test_ids) OR requester_id = ANY(v_test_ids);

  DELETE FROM public.dm_messages WHERE author_id = ANY(v_test_ids);
  DELETE FROM public.dm_conversations WHERE user_low = ANY(v_test_ids) OR user_high = ANY(v_test_ids);
  DELETE FROM public.messages WHERE author_id = ANY(v_test_ids);
  DELETE FROM public.channel_members WHERE user_id = ANY(v_test_ids);

  -- ============================================================================
  -- 3. REMOÇÃO CONTROLADA DOS USUÁRIOS EM AUTH.USERS (DISPARA CASCADE EM PROFILES)
  -- ============================================================================
  WITH deleted AS (
    DELETE FROM auth.users
    WHERE id = ANY(v_test_ids)
    RETURNING 1
  )
  SELECT count(*) INTO v_del_users FROM deleted;

  IF v_del_users <> 56 THEN
    RAISE EXCEPTION 'FALHA DE ATOMICIDADE: Esperava remover exatamente 56 contas em auth.users, mas foram removidas %!', v_del_users;
  END IF;

  -- ============================================================================
  -- 4. VERIFICAÇÃO PÓS-LIMPEZA E CONFIRMAÇÃO DE INTEGRIDADE DOS DADOS LEGÍTIMOS
  -- ============================================================================
  -- 4.1 Confirma que todas as 7 contas legítimas continuam existindo
  SELECT count(*) INTO v_remaining_legit
  FROM public.profiles
  WHERE id = ANY(v_legitimate_ids);

  IF v_remaining_legit <> 7 THEN
    RAISE EXCEPTION 'FALHA DE INTEGRIDADE: Esperava 7 perfis legítimos restantes, mas encontrou %!', v_remaining_legit;
  END IF;

  -- 4.2 Confirma que nenhum perfil de teste permaneceu
  SELECT count(*) INTO v_remaining_test
  FROM public.profiles
  WHERE id = ANY(v_test_ids);

  IF v_remaining_test > 0 THEN
    RAISE EXCEPTION 'FALHA DE INTEGRIDADE: % perfil(is) de teste ainda permanece(m) na tabela profiles!', v_remaining_test;
  END IF;

  -- 4.3 Confirma que a comunidade oficial LYC++ permanece intacta
  SELECT count(*) INTO v_official_community_count
  FROM public.communities
  WHERE is_official = true;

  IF v_official_community_count <> 1 THEN
    RAISE EXCEPTION 'FALHA DE INTEGRIDADE: Comunidade oficial ausente ou duplicada (% encontradas)!', v_official_community_count;
  END IF;

  RAISE NOTICE '=======================================================';
  RAISE NOTICE '   CAPYCHAT OFICIAL — LIMPEZA CONCLUÍDA COM SUCESSO!   ';
  RAISE NOTICE '=======================================================';
  RAISE NOTICE '• Contas de teste removidas em auth.users: % (esperado: 56)', v_del_users;
  RAISE NOTICE '• Associações em community_members removidas: %', v_del_members;
  RAISE NOTICE '• Modelos de servidor removidos: %', v_del_templates;
  RAISE NOTICE '• Registros de presença removidos: %', v_del_presence;
  RAISE NOTICE '• Registros de social_inbox removidos: %', v_del_inbox;
  RAISE NOTICE '• Perfis legítimos preservados intactos: % de 7', v_remaining_legit;
  RAISE NOTICE '• Perfis de teste restantes: % (esperado: 0)', v_remaining_test;
  RAISE NOTICE '• Comunidade oficial LYC++ preservada e intacta.';
END $$;
