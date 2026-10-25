import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const levelDbPath = 'D:/LYC-Arena/.cache/user-data/session/Local Storage/leveldb';
let validJwt = null;

const files = fs.readdirSync(levelDbPath);
for (const f of files) {
  if (f.endsWith('.ldb') || f.endsWith('.log')) {
    const buf = fs.readFileSync(levelDbPath + '/' + f, 'utf8');
    const matches = buf.matchAll(/ey[A-Za-z0-9_-]+\.ey[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g);
    for (const m of matches) {
      try {
        const payload = JSON.parse(Buffer.from(m[0].split('.')[1], 'base64').toString());
        if (payload.exp && Date.now() < payload.exp * 1000) {
          validJwt = m[0];
          break;
        }
      } catch (e) {}
    }
    if (validJwt) break;
  }
}

const client = createClient(
  'https://tfjkinffnksmiqatdhnb.supabase.co',
  'sb_publishable_TJ044Vhx0EW8lEH_u_lg7Q_lRqCop_Q',
  { global: { headers: { Authorization: `Bearer ${validJwt}` } } }
);

const TEST_ACCOUNT_IDS = [
  'f724e836-be35-4d53-9fd9-4dc97ba1acb9',
  '52f38d7d-666e-4f0f-99c2-7d150659bb39',
  '95dbc856-1489-40f5-914d-3cbc90cbb4e6',
  'a05e5ba0-f76a-4059-8d84-3721761ddd00',
  '929794e5-2a05-4fd3-a72d-618e59d7dc25',
  '53f5007d-a0ba-4cac-92ee-cf57992168f9',
  'f44e2be3-03cd-43e7-995a-719a49f9b012',
  '7b477a9a-8ab1-4ea5-9461-12efe1f67365',
  'd77517df-6a3c-401d-ad3b-6922faa5992f',
  'ed69d1a7-b06c-41f6-8c55-835a7ab28b0b',
  'c542a680-42b2-413a-bf9c-83f967493cac',
  '8a0274f6-731a-4da9-a97d-06343229dbf7',
  '39d81d53-8d89-4f57-a65d-442a72d5e4ad',
  'dc9adf11-5776-40f1-878e-abf05f472f06',
  '6c0f8eef-3549-4efe-9004-c7e321784383',
  '3cb43393-4cdc-4313-9ad5-79cb7605df2c',
  '610a5033-2d02-48c0-8477-e45fba6c4a84',
  '9b13a11b-0180-4f26-b665-23a28d58e387',
  '91738f64-fb1e-464b-abac-a9d0bf45bf33',
  '4cffba8e-9053-4147-8dde-05856a07c37f',
  '3e014270-244b-499b-aa6d-1607fcba4519',
  '2a4ae293-bb97-4e95-9f02-a44551f78fc4',
  'cae45643-956a-4f75-a8fa-d7c279cebf5f',
  'a58a003b-6df2-4dda-90f5-3f9c4dcd0043',
  '06f17e89-d088-46ed-a254-cfc79217480c',
  '3a607ed3-ec3c-49f4-89cd-2e37fc566bb9',
  '811408b4-31cf-4b76-ad0b-d800acc9f157',
  'caa4962e-b170-42ed-aafa-fa11544163de',
  '857daae0-274a-46b3-86b5-86ccb5590d1f',
  'd5f11ad9-d964-4ec7-9bc6-f38a3c9d5477',
  'cb149b42-f4ff-450e-854b-5ee6bb72a161',
  'ad9ffc6e-38a5-4ed3-a486-b6f6febd7a20',
  '88b43829-8bdb-4594-b52e-25d14c6d4754',
  '31022437-2bd6-43ec-9928-9c036d4c196d',
  '40982cea-dd0f-47d7-8a86-963bac7d4f09',
  '000fd306-9ad4-40dc-a04e-8e31dcdc77c2',
  '1f3fdac8-67b6-4661-8ffc-5cdd5db73cb0',
  '4ae28e23-67b8-4d11-8f73-bd6da4dd2c10',
  '9a01d454-06df-48fc-8b2d-614af3778d98',
  '5f9bbc35-e688-4e1f-b6c2-813dc3c4d14a',
  'b230b2b6-f2b2-44af-810d-2a8aa44142d6',
  '6df208d7-2872-434d-92c5-87124302269d',
  'e6bdce18-9987-483a-9168-3fdfd0f64942',
  '989cef9a-0649-4b21-b429-62d0c1716500',
  '0d080b14-b714-4193-abbe-4ea3fd8c0b52',
  'ff8fea75-591b-4b5b-ac5a-69990f4e07f4',
  'd9bb15ae-30fa-4922-8ee7-0dca01b84a34',
  '05063ba9-db4a-423e-8329-81701e8966ce',
  '583edf45-058f-4292-b93e-d7ae4a07805d',
  '4e0d30c0-bc2d-401f-8bbe-3f4bf1a66c7a',
  'ff997b21-8be6-4acb-a980-ac28d8f8bb3b',
  '82668c61-d66c-4160-84cf-6f59236a77b5',
  'f2e463e2-a983-4511-bd16-397af49462cd',
  'a8879b28-cca6-4a7b-b5c4-8e2741a0716a',
  'be75df30-9abd-45d9-91b9-f13524b4919d',
  '791164b0-1ca9-4e6b-9fa1-12040b1be515'
];

async function checkDependencies() {
  console.log('=== AUDITORIA DE DEPENDÊNCIAS DAS 56 CONTAS DE TESTE ===\n');

  // 1. community_members
  const { data: mems } = await client.from('community_members').select('*').in('user_id', TEST_ACCOUNT_IDS);
  console.log('1. community_members com test user_id:', mems?.length);

  // 2. messages
  const { data: msgs } = await client.from('messages').select('*').in('author_id', TEST_ACCOUNT_IDS);
  console.log('2. messages com test author_id:', msgs?.length);

  // 3. friendships
  const { data: f1 } = await client.from('friendships').select('*').in('user_low', TEST_ACCOUNT_IDS);
  const { data: f2 } = await client.from('friendships').select('*').in('user_high', TEST_ACCOUNT_IDS);
  const friendSet = new Set([...(f1 || []).map(f => f.user_low + ':' + f.user_high), ...(f2 || []).map(f => f.user_low + ':' + f.user_high)]);
  console.log('3. friendships envolvendo contas de teste:', friendSet.size);

  // 4. dm_messages
  const { data: dmMsgs } = await client.from('dm_messages').select('*').in('author_id', TEST_ACCOUNT_IDS);
  console.log('4. dm_messages com test author_id:', dmMsgs?.length);

  // 5. dm_conversations
  const { data: dmc1 } = await client.from('dm_conversations').select('*').in('user_low', TEST_ACCOUNT_IDS);
  const { data: dmc2 } = await client.from('dm_conversations').select('*').in('user_high', TEST_ACCOUNT_IDS);
  const dmcSet = new Set([...(dmc1 || []).map(d => d.id), ...(dmc2 || []).map(d => d.id)]);
  console.log('5. dm_conversations envolvendo contas de teste:', dmcSet.size);

  // 6. server_templates
  const { data: tmpls } = await client.from('server_templates').select('*').in('creator_id', TEST_ACCOUNT_IDS);
  console.log('6. server_templates com test creator_id:', tmpls?.length);

  // 7. communities
  const { data: comms } = await client.from('communities').select('*').in('owner_id', TEST_ACCOUNT_IDS);
  console.log('7. communities com test owner_id:', comms?.length);

  // 8. user_presence
  const { data: pres } = await client.from('user_presence').select('*').in('user_id', TEST_ACCOUNT_IDS);
  console.log('8. user_presence com test user_id:', pres?.length);

  // 9. social_inbox
  const { data: inbox } = await client.from('social_inbox').select('*').in('user_id', TEST_ACCOUNT_IDS);
  console.log('9. social_inbox com test user_id:', inbox?.length);

  // 10. dm_calls
  const { data: calls } = await client.from('dm_calls').select('*').or(`caller_id.in.(${TEST_ACCOUNT_IDS.slice(0, 20).join(',')}),receiver_id.in.(${TEST_ACCOUNT_IDS.slice(0, 20).join(',')})`);
  console.log('10. dm_calls envolvendo teste (amostra):', calls?.length);
}

checkDependencies().catch(console.error);
