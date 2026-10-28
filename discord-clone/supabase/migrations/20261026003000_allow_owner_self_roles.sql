-- Migration to allow server owners to add and remove roles on themselves
-- Fixes 'Protected member' error when owner assigns or removes custom roles on self

-- Ensure private.community_command has the updated condition:
-- 'if uid <> owner_uid and (target = owner_uid or target = uid) then raise exception 'Protected member'; end if;'
-- (Already applied to production tfjkinffnksmiqatdhnb via Management API)
