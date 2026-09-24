"use client";

import { useState, type FormEvent } from "react";
import { Swords } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authenticate } from "@/lib/api/auth-client";

export function AuthScreen({
  onAuthenticated,
}: {
  onAuthenticated: () => void;
}) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await authenticate({ action: mode, username, password, displayName });
      onAuthenticated();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "The local server could not be reached.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#0b0d12] p-6 text-[#f5f0e5]">
      <div className="w-full max-w-md rounded-2xl border border-amber-300/20 bg-[#12161e] p-8">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-amber-300/10 text-amber-300">
          <Swords />
        </span>
        <h1 className="mt-5 text-center font-serif text-3xl">
          DM Command Table
        </h1>
        <p className="mt-3 text-center leading-relaxed text-stone-400">
          {mode === "login"
            ? "Sign in with your local account."
            : "Create an account stored only on this server."}
        </p>
        <div className="mt-6 grid grid-cols-2 rounded-lg border border-white/10 bg-black/20 p-1">
          <button
            type="button"
            onClick={() => {
              setMode("login");
              setError("");
            }}
            className={`rounded-md px-3 py-2 text-sm ${mode === "login" ? "bg-amber-300 text-black" : "text-stone-400"}`}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("register");
              setError("");
            }}
            className={`rounded-md px-3 py-2 text-sm ${mode === "register" ? "bg-amber-300 text-black" : "text-stone-400"}`}
          >
            Register
          </button>
        </div>
        <form onSubmit={submit} className="mt-5 space-y-4">
          {mode === "register" && (
            <label className="block text-sm text-stone-300">
              Display name
              <Input
                autoComplete="name"
                className="mt-2 border-white/10 bg-black/20"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="Dungeon Master"
                maxLength={80}
              />
            </label>
          )}
          <label className="block text-sm text-stone-300">
            Username
            <Input
              autoFocus
              autoComplete="username"
              className="mt-2 border-white/10 bg-black/20"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="dungeon_master"
              minLength={3}
              maxLength={32}
              required
            />
          </label>
          <label className="block text-sm text-stone-300">
            Password
            <Input
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              className="mt-2 border-white/10 bg-black/20"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={8}
              maxLength={128}
              required
            />
          </label>
          {error && (
            <p className="rounded-lg border border-red-400/20 bg-red-400/5 p-3 text-sm text-red-200">
              {error}
            </p>
          )}
          <Button
            type="submit"
            disabled={submitting}
            className="w-full bg-amber-300 text-black hover:bg-amber-200"
          >
            {submitting
              ? "Please wait…"
              : mode === "login"
                ? "Sign in"
                : "Create local account"}
          </Button>
        </form>
        <p className="mt-5 text-center text-xs leading-relaxed text-stone-500">
          Accounts, passwords, sessions, and campaign data remain on this
          server.
        </p>
      </div>
    </main>
  );
}
