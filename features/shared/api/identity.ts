import type { User } from "@/domain/types";
import { requestJson, json } from "./transport";
export type AuthStatus = {
  user: User | null;
  initialSetup: boolean;
  registrationEnabled: boolean;
};

export function getAuthStatus(): Promise<AuthStatus> {
  return requestJson("/api/auth");
}

export function authenticate(input: {
  action: "login" | "register";
  username: string;
  password: string;
  displayName?: string;
  bootstrapToken?: string;
}): Promise<{ user: User }> {
  return requestJson("/api/auth", json("POST", input));
}

export function logout(): Promise<void> {
  return requestJson("/api/auth", json("POST", { action: "logout" }));
}

export async function updateAccount(
  input:
    | { action: "rename"; username: string; displayName?: string }
    | {
        action: "change-password";
        currentPassword: string;
        newPassword: string;
      },
): Promise<void> {
  await requestJson("/api/account", json("PATCH", input));
}
