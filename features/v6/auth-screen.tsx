"use client";

import { useState } from "react";
import { ShieldCheck, Swords } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authenticateV6 } from "./api-client";

export function V6AuthScreen({
  initialSetup,
  registrationEnabled,
  onAuthenticated,
}: {
  initialSetup: boolean;
  registrationEnabled: boolean;
  onAuthenticated: () => void;
}) {
  const [mode, setMode] = useState<"login" | "register">(
    initialSetup ? "register" : "login",
  );
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [bootstrapToken, setBootstrapToken] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const canRegister = initialSetup || registrationEnabled;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await authenticateV6({
        action: mode,
        username,
        password,
        displayName: mode === "register" ? displayName : undefined,
        bootstrapToken: initialSetup ? bootstrapToken : undefined,
      });
      onAuthenticated();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Authentication failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#0b0d12] p-4 text-[#f5f0e5]">
      <form
        onSubmit={submit}
        className="w-full max-w-md rounded-2xl border border-white/10 bg-[#11141b] p-6 shadow-2xl"
      >
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-xl bg-amber-300 text-black">
            <Swords />
          </span>
          <div>
            <h1 className="font-serif text-2xl">DM Command Table v6</h1>
            <p className="text-sm text-stone-500">Local campaign workspace</p>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-2 rounded-lg bg-black/20 p-1">
          <Button
            type="button"
            variant={mode === "login" ? "default" : "ghost"}
            onClick={() => setMode("login")}
          >
            Sign in
          </Button>
          <Button
            type="button"
            variant={mode === "register" ? "default" : "ghost"}
            disabled={!canRegister}
            onClick={() => setMode("register")}
          >
            Register
          </Button>
        </div>
        <div className="mt-5 space-y-4">
          {mode === "register" && (
            <Input
              aria-label="Display name"
              placeholder="Display name"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
            />
          )}
          <Input
            aria-label="Username"
            autoComplete="username"
            placeholder="Username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
          <Input
            aria-label="Password"
            autoComplete={
              mode === "login" ? "current-password" : "new-password"
            }
            type="password"
            placeholder="Password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          {mode === "register" && initialSetup && (
            <Input
              aria-label="Initial setup token"
              type="password"
              placeholder="Initial setup token"
              value={bootstrapToken}
              onChange={(event) => setBootstrapToken(event.target.value)}
            />
          )}
        </div>
        {error && (
          <p
            role="alert"
            className="mt-4 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200"
          >
            {error}
          </p>
        )}
        <Button
          className="mt-5 w-full bg-amber-300 text-black hover:bg-amber-200"
          disabled={busy}
        >
          <ShieldCheck />{" "}
          {busy
            ? "Please wait…"
            : mode === "login"
              ? "Sign in"
              : "Create account"}
        </Button>
      </form>
    </main>
  );
}
