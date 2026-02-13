# Deployment Guide: Digibyte Tournament System

This guide will walk you through deploying your Digibyte Tournament System to Vercel with Supabase backend.

## Prerequisites
- ✅ Supabase project created (named "digibyte")
- GitHub account
- Vercel account (can sign up with GitHub)

---

## Step 1: Set Up Supabase Database

### 1.1 Get Your Supabase Credentials

1. Go to your Supabase project dashboard: https://supabase.com/dashboard
2. Select your "digibyte" project
3. Go to **Settings** > **API**
4. Copy these values (you'll need them later):
   - **Project URL** (looks like: `https://xxxxx.supabase.co`)
   - **anon/public key** (long string starting with `eyJ...`)

### 1.2 Run Database Migrations

1. In Supabase Dashboard, go to **SQL Editor**
2. Click **New Query**
3. Copy and paste the contents of `supabase/migrations/20260213015854_create_digibyte_schema.sql`
4. Click **Run** (or press Ctrl+Enter)
5. Wait for success message
6. Now run `supabase/migrations/20260214000000_fix_admin_rls.sql`
7. Click **Run** again

### 1.3 Create Admin User

1. Go to **Authentication** > **Users** in Supabase Dashboard
2. Click **Add User** (or **Invite User**)
3. Fill in:
   - **Email**: `adminoscar@digibyte.com`
   - **Password**: `mypassword00`
   - ✅ Check **Auto Confirm User** (important!)
4. Click **Create User**
5. Verify the user was created successfully

---

## Step 2: Set Up GitHub Repository

### 2.1 Initialize Git (if not already done)

```bash
# In your project directory
git init
git add .
git commit -m "Initial commit: Digibyte Tournament System"
```

### 2.2 Create GitHub Repository

1. Go to https://github.com/new
2. Repository name: `digibyte-tournament` (or your preferred name)
3. Choose **Public** or **Private**
4. **Don't** initialize with README (you already have files)
5. Click **Create repository**

### 2.3 Push to GitHub

```bash
# Add your GitHub repository as remote
git remote add origin https://github.com/YOUR_USERNAME/digibyte-tournament.git

# Push your code
git branch -M main
git push -u origin main
```

Replace `YOUR_USERNAME` with your GitHub username.

---

## Step 3: Deploy to Vercel

### 3.1 Connect GitHub to Vercel

1. Go to https://vercel.com
2. Sign up/Login with your GitHub account
3. Click **Add New Project**
4. Import your GitHub repository (`digibyte-tournament`)
5. Vercel will auto-detect it's a Vite project

### 3.2 Configure Environment Variables

**Before clicking Deploy**, add your environment variables:

1. In the **Environment Variables** section, add:

   **Variable 1:**
   - Name: `VITE_SUPABASE_URL`
   - Value: Your Supabase Project URL (from Step 1.1)
   - Environment: Production, Preview, Development (check all)

   **Variable 2:**
   - Name: `VITE_SUPABASE_ANON_KEY`
   - Value: Your Supabase anon key (from Step 1.1)
   - Environment: Production, Preview, Development (check all)

2. Click **Deploy**

### 3.3 Wait for Deployment

- Vercel will build and deploy your project
- This usually takes 1-2 minutes
- You'll get a live URL like: `https://digibyte-tournament.vercel.app`

---

## Step 4: Verify Deployment

### 4.1 Test the Live Site

1. Visit your Vercel deployment URL
2. Test team registration
3. Test admin login with:
   - Email: `adminoscar@digibyte.com`
   - Password: `mypassword00`
4. Verify you can:
   - Mark teams as paid
   - Edit/delete teams
   - Add champions
   - Generate brackets

### 4.2 Set Up Custom Domain (Optional)

1. In Vercel project settings, go to **Domains**
2. Add your custom domain
3. Follow DNS configuration instructions

---

## Step 5: Local Development Setup

### 5.1 Clone and Set Up Locally

```bash
# Clone your repository
git clone https://github.com/YOUR_USERNAME/digibyte-tournament.git
cd digibyte-tournament

# Install dependencies
npm install

# Create .env file
cp .env.example .env

# Edit .env and add your Supabase credentials
# VITE_SUPABASE_URL=your_supabase_project_url
# VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Run development server
npm run dev
```

---

## Troubleshooting

### Issue: "Invalid API key" or "Failed to fetch"
- ✅ Check environment variables are set correctly in Vercel
- ✅ Verify Supabase URL and key are correct
- ✅ Make sure variables start with `VITE_` prefix

### Issue: "Permission denied" when updating teams
- ✅ Verify admin user was created in Supabase
- ✅ Check that RLS migrations were run
- ✅ Ensure admin user is confirmed (Auto Confirm was checked)

### Issue: Build fails on Vercel
- ✅ Check build logs in Vercel dashboard
- ✅ Ensure all dependencies are in `package.json`
- ✅ Verify Node.js version compatibility

### Issue: Can't login as admin
- ✅ Verify admin user exists in Supabase Authentication > Users
- ✅ Check email is exactly: `adminoscar@digibyte.com`
- ✅ Verify password is: `mypassword00`
- ✅ Ensure user is confirmed (has email_confirmed_at timestamp)

---

## Security Notes

⚠️ **Important for Production:**

1. **Change default admin password** after first login
2. **Enable MFA** for admin account in Supabase
3. **Review RLS policies** - ensure they're secure
4. **Monitor API usage** in Supabase dashboard
5. **Set up rate limiting** if needed
6. **Regular backups** - Supabase handles this automatically

---

## Next Steps

- ✅ Customize the design/branding
- ✅ Add more tournament features
- ✅ Set up email notifications (Supabase has built-in email)
- ✅ Add analytics (Vercel Analytics is free)
- ✅ Set up monitoring and error tracking

---

## Support

If you encounter issues:
1. Check Vercel deployment logs
2. Check Supabase logs (Dashboard > Logs)
3. Review browser console for errors
4. Verify all environment variables are set correctly

---

**Congratulations! Your Digibyte Tournament System is now live! 🎉**
