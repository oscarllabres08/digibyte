-- Create admin user with default credentials
-- This script should be run in Supabase SQL Editor after setting up the project
-- Default credentials:
-- Email: adminoscar@digibyte.com
-- Password: mypassword00

-- Note: This uses Supabase's auth.admin API which requires service role key
-- For security, run this from a server-side script or Supabase dashboard

-- Create the admin user
-- You can also create this user manually through Supabase Dashboard > Authentication > Users > Add User
-- Or use the Supabase CLI: supabase auth admin create-user --email adminoscar@digibyte.com --password mypassword00

-- If running via SQL, you'll need to use the auth.users table directly (requires service role)
-- For most cases, it's better to create the user through the Supabase Dashboard or CLI

-- Alternative: Use Supabase Management API or Dashboard to create user
-- Then this migration ensures the user has proper permissions

-- After creating the user, you can verify with:
-- SELECT id, email, email_confirmed_at FROM auth.users WHERE email = 'adminoscar@digibyte.com';
