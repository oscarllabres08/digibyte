import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { User } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    // Use Supabase authentication
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    
    if (error) {
      throw error;
    }
    
    // User is automatically set via onAuthStateChange
    if (data?.user) {
      setUser(data.user);
    }
  };

  const signOut = async () => {
    try {
      // If there's no active session, skip calling signOut on Supabase to avoid 403 noise
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData.session) {
        const { error } = await supabase.auth.signOut();
        if (error) {
          // Optional: you can log this in development if needed
          // console.warn('Supabase signOut error (ignored):', error.message);
        }
      }
    } catch (err: any) {
      // Swallow unexpected errors; we still clear local auth state below
      // console.warn('Unexpected signOut error (ignored):', err?.message ?? err);
    } finally {
      // Ensure local auth state is cleared so UI updates correctly
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
