"use client";

import { useEffect, useState } from "react";
import { getInsForgeClient } from "@/lib/insforge/client";
import type { UserSchema } from "@insforge/sdk";

type State =
  | { status: "loading" }
  | { status: "ok"; user: UserSchema }
  | { status: "error" };

export function useCurrentUser(): State {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    getInsForgeClient()
      .auth.getCurrentUser()
      .then(({ data, error }) => {
        if (error || !data.user) {
          setState({ status: "error" });
        } else {
          setState({ status: "ok", user: data.user });
        }
      })
      .catch(() => setState({ status: "error" }));
  }, []);

  return state;
}
