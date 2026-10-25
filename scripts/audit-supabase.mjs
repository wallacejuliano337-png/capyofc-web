import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load .env
const envPath = path.resolve('.env');
const envConfig = dotenv.parse(fs.readFileSync(envPath));

const url = envConfig.VITE_SUPABASE_URL;
const key = envConfig.VITE_SUPABASE_PUBLISHABLE_KEY;

console.log('--- SUPABASE AUDIT ---');
console.log('Supabase URL:', url);
console.log('Publishable Key Present:', Boolean(key));
console.log('Key prefix:', key ? key.substring(0, 15) + '...' : 'none');

if (!url || !key) {
  console.error('ERROR: Missing Supabase credentials in .env');
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

async function runAudit() {
  // 1. Test basic connectivity
  console.log('\n1. Testing connectivity to Supabase backend...');
  try {
    const { data, error } = await supabase.from('roles').select('*');
    if (error) {
      console.log('Query roles returned error (expected RLS for unauthenticated):', error.message, error.code);
    } else {
      console.log('Query roles succeeded! Roles count:', data.length);
    }
  } catch (err) {
    console.error('Connection failure:', err);
  }

  // 2. Test SignUp with a test account
  const timestamp = Date.now().toString().slice(-6);
  const testEmail1 = `capy.tester.${timestamp}@gmail.com`;
  const testPass = 'CapyPass123!*';
  const testUsername = `user_${timestamp}`;
  const testDisplayName = `Capy Tester ${timestamp}`;

  console.log('\n2. Testing Public SignUp with account:', testEmail1);
  try {
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: testEmail1,
      password: testPass,
      options: {
        data: {
          username: testUsername,
          display_name: testDisplayName,
        },
      },
    });

    if (signUpError) {
      console.error('SignUp Error:', signUpError.message, 'Status:', signUpError.status);
      return { success: false, step: 'signup', error: signUpError };
    }

    console.log('SignUp Result:');
    console.log(' - User ID:', signUpData.user?.id);
    console.log(' - Email:', signUpData.user?.email);
    console.log(' - Confirmed At:', signUpData.user?.confirmed_at);
    console.log(' - Session returned immediately?:', Boolean(signUpData.session));

    const isConfirmed = Boolean(signUpData.user?.confirmed_at || signUpData.session);
    console.log(' - Email Confirmation Required:', !isConfirmed);

    // 3. If session returned, test Profile Creation & RLS
    if (signUpData.session) {
      console.log('\n3. Testing profile association and roles...');
      const authedClient = createClient(url, key, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
        global: {
          headers: {
            Authorization: `Bearer ${signUpData.session.access_token}`,
          },
        },
      });

      const { data: profile, error: profErr } = await authedClient
        .from('profiles')
        .select('*')
        .eq('id', signUpData.user.id)
        .single();

      if (profErr) {
        console.error('Profile fetch error:', profErr.message);
      } else {
        console.log('Profile created successfully:');
        console.log(' - Profile ID:', profile.id);
        console.log(' - Username:', profile.username);
        console.log(' - Display Name:', profile.display_name);
        console.log(' - Role:', profile.role);
        console.log(' - Is Admin?:', profile.role === 'ADMIN' || profile.role === 'OWNER');
      }

      // 4. Test updating profile
      console.log('\n4. Testing profile update...');
      const { data: updatedProf, error: updateErr } = await authedClient
        .from('profiles')
        .update({
          display_name: 'Capy Updated Name',
        })
        .eq('id', signUpData.user.id)
        .select()
        .single();

      if (updateErr) {
        console.error('Profile update error:', updateErr.message);
      } else {
        console.log('Profile update succeeded! New display_name:', updatedProf.display_name);
      }

      // 5. Test RLS protection (cannot update other profiles)
      console.log('\n5. Testing RLS protection on foreign profiles...');
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const { data: forbiddenUpdate, error: rlsErr } = await authedClient
        .from('profiles')
        .update({ display_name: 'Hacked' })
        .eq('id', fakeId)
        .select();

      console.log('RLS update on foreign ID returned:', forbiddenUpdate, 'Error:', rlsErr?.message);
    }

    // 6. Test SignIn with created account
    console.log('\n6. Testing SignIn with created account...');
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: testEmail1,
      password: testPass,
    });

    if (signInError) {
      console.log('SignIn result (might require email confirm):', signInError.message);
    } else {
      console.log('SignIn succeeded! Session user ID:', signInData.user?.id);
    }

    return { success: true, user: signUpData.user };
  } catch (err) {
    console.error('Audit execution error:', err);
    return { success: false, error: err };
  }
}

runAudit();
