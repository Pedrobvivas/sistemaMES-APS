"use client";
import { adminClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

// Usa o mesmo domínio do site; não precisa de URL.
export const authClient = createAuthClient({
  plugins: [adminClient()],
});
