import { createSignal, createEffect } from "solid-js";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

const [session, setSession] = createSignal<Session | null>(null);
const [loading, setLoading] = createSignal(true);

// Initialize auth state listener
createEffect(() => {
  // Get initial session
  supabase.auth.getSession().then(({ data: { session: s } }) => {
    setSession(s);
    setLoading(false);
  });

  // Listen for auth changes
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (_event, s) => setSession(s)
  );

  return () => subscription.unsubscribe();
});

export { session, loading };

/** Sign in with email/password */
export async function signIn(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

/** Sign out */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
