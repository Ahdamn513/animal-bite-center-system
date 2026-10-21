"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Profile } from "@/lib/helpers";

type State = {
  loading: boolean;
  userId: string | null;
  profile: Profile | null;
};

export function useProfile(): State {
  const [state, setState] = useState<State>({
    loading: true,
    userId: null,
    profile: null,
  });

  useEffect(() => {
    let active = true;

    async function load(userId: string | null) {
      if (!userId) {
        if (active) setState({ loading: false, userId: null, profile: null });
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, contact, role")
        .eq("id", userId)
        .maybeSingle();
      if (active) {
        setState({ loading: false, userId, profile: data as Profile | null });
      }
    }

    supabase.auth.getSession().then(({ data }) => {
      load(data.session?.user.id ?? null);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      // Do not call Supabase directly inside this callback; defer it.
      setTimeout(() => load(session?.user.id ?? null), 0);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return state;
}
