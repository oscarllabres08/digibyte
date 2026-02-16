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
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    // Check if user manually logged out (stored in sessionStorage which clears on tab close)
    const wasLoggedOut = typeof window !== 'undefined' && sessionStorage.getItem('digibyte_manual_logout') === 'true';
    
    // Get current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      // If user manually logged out, don't restore session
      if (wasLoggedOut) {
        setUser(null);
        // Clear the flag
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('digibyte_manual_logout');
        }
      } else if (!isLoggingOut) {
        setUser(session?.user ?? null);
      }
      setLoading(false);
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // If we're logging out, ignore SIGNED_IN events to prevent auto-login
      if (isLoggingOut && event === 'SIGNED_IN') {
        return;
      }
      // Check if user manually logged out
      const wasLoggedOut = typeof window !== 'undefined' && sessionStorage.getItem('digibyte_manual_logout') === 'true';
      if (wasLoggedOut && event === 'SIGNED_IN') {
        // Prevent auto-login after manual logout
        return;
      }
      // Only update user if session is null (logout) or if we're not logging out
      if (!session || !isLoggingOut) {
        setUser(session?.user ?? null);
      }
    });

    return () => subscription.unsubscribe();
  }, [isLoggingOut]);

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
      // Set logging out flag to prevent auto-login
      setIsLoggingOut(true);
      
      // Mark that user manually logged out (stored in sessionStorage)
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('digibyte_manual_logout', 'true');
      }
      
      // Clear local auth state first
      setUser(null);
      
      // Sign out from Supabase first (this clears the session from storage)
      const { error } = await supabase.auth.signOut({ scope: 'global' });
      if (error) {
        console.warn('Supabase signOut error:', error.message);
      }
      
      // Clear any admin-related localStorage items
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem('digibyte_admin_active_page');
        window.localStorage.removeItem('digibyte_current_tournament_id');
        window.localStorage.removeItem('digibyte_bracket_type');
        
        // Clear all Supabase-related localStorage items
        const keys = Object.keys(window.localStorage);
        keys.forEach(key => {
          if (key.includes('supabase') || key.includes('sb-') || key.includes('auth-token')) {
            window.localStorage.removeItem(key);
          }
        });
      }
      
      // Wait a bit to ensure session is cleared
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Double-check session is cleared
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        // Force clear if session still exists
        await supabase.auth.signOut({ scope: 'global' });
        // Clear all localStorage again
        if (typeof window !== 'undefined') {
          const keys = Object.keys(window.localStorage);
          keys.forEach(key => {
            if (key.includes('supabase') || key.includes('sb-') || key.includes('auth')) {
              window.localStorage.removeItem(key);
            }
          });
        }
      }
    } catch (err: any) {
      console.warn('Unexpected signOut error:', err?.message ?? err);
      // Still clear local state even if there's an error
      setUser(null);
    } finally {
      // Reset logging out flag after a delay
      setTimeout(() => setIsLoggingOut(false), 1000);
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
