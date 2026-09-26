-- Explicit rollback of commands. Keep additive column/index and all data.
begin;
do $$ declare definition text; begin
 select value #>> '{}' into definition from private.community_upgrade_backup where key='administration:community_command';
 if definition is null then raise exception 'Administration backup missing';end if;
 -- Archived roles remain unavailable even after rolling back the command surface.
 definition=replace(definition,'where id=rid and community_id=cid and base_role is distinct from','where id=rid and community_id=cid and deleted_at is null and base_role is distinct from');
 execute definition;
end $$;
commit;
