import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface Profile {
  id: string;
  user_id: string;
  callsign: string;
  name: string;
  rank: string;
  xp: number;
  money: number;
  total_hours: number;
  total_flights: number;
  base_airport: string;
  active_aircraft_family: string;
  is_approved: boolean;
  simbrief_pid: string | null;
  ifc_username: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  isAdmin: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, name: string, callsign: string, baseAirport?: string, simbriefPid?: string, ifcUsername?: string) => Promise<{ error: Error | null; user: User | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching profile:', error);
      setProfile(null);
      return;
    }

    setProfile((data as Profile) ?? null);
  };

  const checkAdminRole = async (userId: string) => {
    const { data } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('role', 'admin')
      .single();
    
    setIsAdmin(!!data);
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        // Clear previously cached user data immediately to prevent showing another user's stats.
        setProfile(null);
        setIsAdmin(false);
        
        if (session?.user) {
          // Defer calls with setTimeout to avoid deadlock
          setTimeout(() => {
            fetchProfile(session.user.id);
            checkAdminRole(session.user.id);
          }, 0);
        }
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        fetchProfile(session.user.id);
        checkAdminRole(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return { error };
    } catch (err) {
      return { error: new Error('Network error — please check your connection and try again.') };
    }
  };

  const signUp = async (email: string, password: string, name: string, callsign: string, baseAirport: string = 'UUEE', simbriefPid?: string, ifcUsername?: string) => {
    // Auto-approve these emails (pre-approved users)
    const PRE_APPROVED_EMAILS = ['admin@aflv.ru', 'admin@aeroflotvirtual.com'];
    const isPreApproved = PRE_APPROVED_EMAILS.includes(email.toLowerCase());
    
    const redirectUrl = `${window.location.origin}/`;
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
      },
    });

    if (error) return { error, user: null };

    // Create profile for new user - auto-approve if pre-approved
    if (data.user) {
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          user_id: data.user.id,
          name,
          callsign: callsign.toUpperCase(),
          base_airport: baseAirport,
          is_approved: isPreApproved, // Auto-approve pre-defined emails
          simbrief_pid: simbriefPid || null,
          ifc_username: ifcUsername || null,
        });

      if (profileError) {
        return { error: new Error(profileError.message), user: null };
      }

      // Create registration approval record for admin to review
      const { error: regError } = await supabase
        .from('registration_approvals')
        .insert({
          user_id: data.user.id,
          email: email,
          name,
          callsign: callsign.toUpperCase(),
          base_airport: baseAirport,
          simbrief_pid: simbriefPid || null,
          ifc_username: ifcUsername || null,
          status: isPreApproved ? 'approved' : 'pending', // Auto-approve status
        });

      if (regError) {
        console.error('Error creating registration approval:', regError);
      }

      // Assign pilot role
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: data.user.id,
          role: isPreApproved ? 'admin' : 'pilot',
        });

      if (roleError) {
        console.error('Error assigning role:', roleError);
      }

      // Grant default A320 type rating
      const { data: aircraft } = await supabase
        .from('aircraft')
        .select('id')
        .eq('type_code', 'A320')
        .single();

      if (aircraft) {
        await supabase
          .from('type_ratings')
          .insert({
            user_id: data.user.id,
            aircraft_id: aircraft.id,
            is_active: true,
          });
      }
    }

    return { error: null, user: data.user };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setIsAdmin(false);
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      profile,
      isAdmin,
      loading,
      signIn,
      signUp,
      signOut,
      refreshProfile,
    }}>
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