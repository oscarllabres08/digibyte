# Admin User Setup Instructions

## Default Admin Credentials
- **Email**: `adminoscar@digibyte.com`
- **Password**: `mypassword00`

## Steps to Create Admin User in Supabase

### Option 1: Using Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to **Authentication** > **Users**
3. Click **Add User** or **Invite User**
4. Enter the email: `adminoscar@digibyte.com`
5. Enter the password: `mypassword00`
6. Make sure **Auto Confirm User** is checked (so they can login immediately)
7. Click **Create User**

### Option 2: Using Supabase CLI

```bash
# Install Supabase CLI if you haven't
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref your-project-ref

# Create admin user
supabase auth admin create-user \
  --email adminoscar@digibyte.com \
  --password mypassword00 \
  --email-confirm
```

### Option 3: Using SQL (Requires Service Role Key)

If you have access to the service role key, you can run this in the SQL Editor:

```sql
-- Note: This requires service role access
-- It's safer to use the Dashboard or CLI method above

-- The user will be created through Supabase's auth system
-- You can verify the user was created with:
SELECT id, email, email_confirmed_at, created_at 
FROM auth.users 
WHERE email = 'adminoscar@digibyte.com';
```

## Apply Database Migrations

After creating the user, make sure to run the database migrations:

1. Go to **SQL Editor** in Supabase Dashboard
2. Run the migration files in order:
   - `20260213015854_create_digibyte_schema.sql` (if not already run)
   - `20260214000000_fix_admin_rls.sql` (updates RLS policies for authenticated users)

## Verify Setup

1. Try logging in with the admin credentials
2. Check that you can:
   - View teams
   - Mark teams as paid/unpaid
   - Edit teams
   - Delete teams
   - Add champions
   - Generate brackets

## Security Notes

- Change the default password after first login in production
- Consider using environment variables for admin credentials
- Enable MFA for admin accounts in production
- Regularly audit admin user access
