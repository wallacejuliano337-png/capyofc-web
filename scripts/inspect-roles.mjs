import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

const envConfig = dotenv.parse(fs.readFileSync('.env'));
const supabase = createClient(envConfig.VITE_SUPABASE_URL, envConfig.VITE_SUPABASE_PUBLISHABLE_KEY);

async function inspect() {
  const { data: comms, error: commError } = await supabase.from('communities').select('*');
  console.log('COMMUNITIES:', comms?.length, commError || '');
  if (comms) {
    for (const c of comms) {
      console.log(` - ID: ${c.id} | Name: "${c.name}" | Owner: ${c.owner_id} | Official: ${c.is_official}`);
    }
  }

  const { data: roles, error: rolesError } = await supabase.from('community_roles').select('*');
  console.log('\nROLES:', roles?.length, rolesError || '');
  if (roles) {
    for (const r of roles) {
      console.log(` - Role ID: ${r.id} | Name: "${r.name}" | Base: ${r.base_role} | Pos: ${r.position} | CommID: ${r.community_id}`);
    }
  }

  const { data: members, error: memError } = await supabase.from('community_members').select('*');
  console.log('\nMEMBERS:', members?.length, memError || '');
  if (members) {
    for (const m of members) {
      console.log(` - CommID: ${m.community_id} | User: ${m.user_id} | RoleID: ${m.role_id}`);
    }
  }

  const { data: memberRoles, error: mrError } = await supabase.from('community_member_roles').select('*');
  console.log('\nMEMBER ROLES:', memberRoles?.length, mrError || '');
  if (memberRoles) {
    for (const mr of memberRoles) {
      console.log(` - CommID: ${mr.community_id} | User: ${mr.user_id} | RoleID: ${mr.role_id}`);
    }
  }

  const { data: invites, error: invError } = await supabase.from('community_invites').select('*');
  console.log('\nINVITES:', invites?.length, invError || '');
  if (invites) {
    for (const inv of invites) {
      console.log(` - Code: ${inv.code} | CommID: ${inv.community_id} | Uses: ${inv.uses} | Creator: ${inv.created_by}`);
    }
  }
}

inspect().catch(console.error);
