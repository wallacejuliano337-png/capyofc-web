import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

const envConfig = dotenv.parse(fs.readFileSync('.env'));
const client = createClient(envConfig.VITE_SUPABASE_URL, envConfig.VITE_SUPABASE_PUBLISHABLE_KEY);

async function checkProcs() {
  const { data, error } = await client.rpc('get_service_status');
  console.log('get_service_status:', data, error);
}

checkProcs().catch(console.error);
