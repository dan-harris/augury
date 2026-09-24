import { useState } from "preact/hooks";
import { actions } from "astro:actions";

interface AuthMenuProps {
  userEmail?: string | null;
}

export function AuthMenu({ userEmail }: AuthMenuProps) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    setErrorMsg(null);

    try {
      const result = await actions.requestMagicLink({
        email,
        next: window.location.pathname,
      });

      if (result.error) {
        setErrorMsg(result.error.message);
      } else if (result.data && !result.data.success && result.data.error) {
        setErrorMsg(result.data.error);
      } else {
        setSubmitted(true);
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to send magic link.");
    } finally {
      setLoading(false);
    }
  };

  if (userEmail) {
    return (
      <div className="flex items-center gap-3">
        <a
          href="/admin"
          className="text-xs font-serif text-ink-primary transition-opacity hover:opacity-80 focus:outline-none"
        >
          <span className="hidden sm:inline font-label uppercase tracking-wider text-[11px] opacity-70 me-1">
            Keeper:
          </span>
          <span className="font-semibold underline underline-offset-4 decoration-ink-primary/40">
            {userEmail}
          </span>
        </a>

        <a
          href="/admin"
          className="btn-frame border-2 border-ink-primary bg-parchment-secondary px-3 py-1 text-xs font-label uppercase tracking-wider text-ink-primary hover:bg-ink-primary hover:text-parchment-base"
        >
          Admin
        </a>

        <form action="/auth/signout" method="POST">
          <button
            type="submit"
            className="btn-frame border-2 border-ink-primary/60 bg-transparent px-3 py-1 text-xs font-label uppercase tracking-wider text-ink-primary hover:border-ink-primary hover:bg-ink-primary hover:text-parchment-base"
          >
            Sign Out
          </button>
        </form>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="flex items-center gap-2 rounded border border-ink-primary/40 bg-parchment-secondary px-3 py-1.5 text-xs font-serif text-ink-primary">
        <span>✓ Check your ledger inbox for the magic link!</span>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-1 sm:flex-row sm:items-center">
      <div className="relative flex items-center gap-2">
        <input
          type="email"
          required
          placeholder="keeper@example.com"
          value={email}
          onInput={(e) => setEmail((e.target as HTMLInputElement).value)}
          className="underline-input w-44 px-2 py-1 text-xs font-serif text-ink-primary placeholder:text-ink-primary/40"
        />
        <button
          type="submit"
          disabled={loading}
          className="btn-frame border-2 border-ink-primary bg-ink-primary px-3 py-1 text-xs font-label uppercase tracking-wider text-parchment-base hover:bg-parchment-secondary hover:text-ink-primary disabled:opacity-50"
        >
          {loading ? "Sending..." : "Sign In"}
        </button>
      </div>
      {errorMsg && <span className="text-[10px] text-rust-ink font-serif italic">{errorMsg}</span>}
    </form>
  );
}
