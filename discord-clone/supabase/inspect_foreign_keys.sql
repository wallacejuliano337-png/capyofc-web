-- ==============================================================================
-- CAPYCHAT OFICIAL — CONSULTA AO CATÁLOGO DE CHAVES ESTRANGEIRAS (SOMENTE LEITURA)
-- Executar no SQL Editor do painel Supabase (tfjkinffnksmiqatdhnb)
-- ESTE SCRIPT É ESTRITAMENTE SOMENTE LEITURA. NENHUM DADO É ALTERADO OU EXCLUÍDO.
-- ==============================================================================

SELECT 
    tc.table_schema AS esquema_origem, 
    tc.table_name AS tabela_origem, 
    kcu.column_name AS coluna_origem, 
    ccu.table_schema AS esquema_destino,
    ccu.table_name AS tabela_destino,
    ccu.column_name AS coluna_destino,
    rc.delete_rule AS regra_on_delete,
    rc.update_rule AS regra_on_update,
    tc.constraint_name AS nome_chave_estrangeira
FROM 
    information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    JOIN information_schema.referential_constraints AS rc
      ON rc.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND (
    ccu.table_name IN ('profiles', 'users')
    OR tc.table_name IN ('profiles', 'users', 'community_members', 'server_templates')
  )
ORDER BY 
    tc.table_schema, 
    tc.table_name,
    kcu.column_name;
