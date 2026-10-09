import { Input } from "@/components/ui/input";
export function Section({
  title,
  description,
  query,
  setQuery,
  actions,
  children,
}: {
  title: string;
  description: string;
  query: string;
  setQuery: (value: string) => void;
  actions: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-5">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">
            Campaign workspace
          </p>
          <h1 className="mt-1 font-serif text-3xl">{title}</h1>
          <p className="mt-1 text-sm text-stone-400">{description}</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            className="sm:w-72"
            type="search"
            placeholder={`Search ${title.toLowerCase()}…`}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          {actions}
        </div>
      </header>
      <div className="space-y-3">{children}</div>
    </div>
  );
}
export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-white/10 p-10 text-center text-sm text-stone-400">
      {children}
    </p>
  );
}

export const sessionTabClass =
  "rounded-md px-3 py-2 text-sm text-stone-400 outline-none focus-visible:ring-2 focus-visible:ring-amber-300 data-[state=active]:bg-white/10 data-[state=active]:text-amber-200";
