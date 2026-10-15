"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { requestJson } from "../shared/api";
import type { UpdateState } from "@/domain/updates";

const labels: Record<string, string> = {
  prerequisites: "Check update prerequisites",
  current: "Verify installed runtime",
  stage: "Prepare verified immutable release",
  fetch: "Download the approved release",
  install: "Install locked dependencies",
  test: "Run unit and API tests",
  build: "Build application",
  browser: "Run browser regression tests",
  verify: "Verify release and source checks",
  package: "Prepare local release",
  backup: "Stop application and back up local data",
  switch: "Switch to the new release",
  health: "Restart application and check readiness",
  cleanup: "Retain packages and backups",
  rollback: "Recover previous release",
};

export function UpdatePanel() {
  const [state, setState] = useState<UpdateState | null>(null);
  const [message, setMessage] = useState("");
  const [starting, setStarting] = useState(false);
  const refresh = useRef<() => Promise<void>>(async () => {});
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const value = await requestJson<UpdateState>("/api/admin/updates");
        if (!active) return;
        setState(value);
        setMessage("");
      } catch (error) {
        if (active)
          setMessage(
            error instanceof Error
              ? error.message + " Retrying; the application may be restarting."
              : "Unable to refresh update status. Retrying…",
          );
      } finally {
        if (active) {
          clearTimeout(timer);
          timer = setTimeout(poll, 3000);
        }
      }
    }
    refresh.current = poll;
    void poll();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, []);

  async function start() {
    if (
      !confirm(
        `Update the server from ${state?.target}? Save all open work first. The application will briefly be unavailable while data is backed up and the service restarts.`,
      )
    )
      return;
    setStarting(true);
    try {
      setState(
        await requestJson<UpdateState>("/api/admin/updates", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "start" }),
        }),
      );
      setMessage("");
    } catch (error) {
      setMessage(
        (error instanceof Error
          ? error.message
          : "Could not start the update.") +
          " Check the latest status before retrying.",
      );
    } finally {
      setStarting(false);
      void refresh.current();
    }
  }
  const job = state?.job;
  return (
    <section
      aria-labelledby="application-updates-heading"
      className="rounded-xl border border-white/10 bg-[#13161d] p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2
            id="application-updates-heading"
            className="font-serif text-xl text-amber-200"
          >
            Application updates
          </h2>
          <p className="mt-1 text-sm text-stone-400">
            {state?.target === "staged"
              ? "Install the host-staged offline package, back up local data and restart."
              : "Download, build and test the approved release, back up local data, then restart. No manual build or staging is required."}
          </p>
          {state?.available && (
            <p className="mt-1 text-sm text-stone-400">
              Update source:{" "}
              {state.target === "latest"
                ? "Latest approved stable release"
                : state.target === "staged"
                  ? "Host-staged offline package"
                  : state.target}
            </p>
          )}
        </div>
        <Button
          disabled={
            !state?.available ||
            Boolean(message) ||
            starting ||
            job?.status === "running"
          }
          onClick={start}
        >
          {starting
            ? "Starting…"
            : job?.status === "running"
              ? "Update running…"
              : "Update application"}
        </Button>
      </div>
      {!state && !message && (
        <p className="mt-3 text-sm text-stone-400">
          Checking update availability…
        </p>
      )}
      {state && !state.available && (
        <p className="mt-3 text-sm text-stone-400">
          GUI updates require the Debian LXC update service. Ask the server
          administrator to enable it using the deployment guide. For Docker,
          update the container on its host.
        </p>
      )}
      {message && (
        <p className="mt-3 text-sm text-amber-200" role="status">
          {message}
        </p>
      )}
      {job && (
        <div className="mt-4 space-y-3">
          <p className="text-sm" role="status">
            {job.status === "succeeded"
              ? "Update completed successfully."
              : job.status === "failed"
                ? "Update failed. Review the logs for recovery status before retrying."
                : job.status === "interrupted"
                  ? "Update service was interrupted. Check the server before retrying."
                  : "Update in progress. This page reconnects after the application restarts."}
          </p>
          <p className="text-xs text-stone-400">
            Started {new Date(job.startedAt).toLocaleString()}
            {job.finishedAt
              ? ` · Finished ${new Date(job.finishedAt).toLocaleString()}`
              : ""}
          </p>
          <ol className="grid gap-2 text-sm md:grid-cols-2">
            {(job.steps ?? []).map((step) => (
              <li
                key={step.id}
                className="flex justify-between gap-3 rounded border border-white/10 p-2"
              >
                <span>{labels[step.id] ?? step.id}</span>
                <span
                  className={
                    step.status === "failed"
                      ? "text-red-300"
                      : step.status === "succeeded"
                        ? "text-green-300"
                        : "text-amber-200"
                  }
                >
                  {step.status === "succeeded"
                    ? "Completed"
                    : step.status === "failed"
                      ? "Failed"
                      : "Running"}
                </span>
              </li>
            ))}
          </ol>
          <details>
            <summary className="cursor-pointer text-sm text-amber-200">
              Update log (latest 64 KB)
            </summary>
            <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap break-all rounded bg-black/30 p-3 text-xs text-stone-300">
              {job.log || "Waiting for updater output…"}
            </pre>
          </details>
          {job.status === "succeeded" && (
            <Button variant="outline" onClick={() => window.location.reload()}>
              Reload application
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
