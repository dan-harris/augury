import { actions } from "astro:actions";
import { useEffect, useState } from "preact/hooks";
import { Input } from "../Input";

interface AuthMenuProps {
  userEmail?: string | null;
}

export function AuthMenu({ userEmail }: AuthMenuProps) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    const form = e.currentTarget as HTMLFormElement;
    const formData = new FormData(form);
    const emailVal = ((formData.get("email") as string) || email).trim();
    if (!emailVal) return;

    setLoading(true);
    setErrorMsg(null);

    try {
      const result = await actions.requestMagicLink({
        email: emailVal,
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

        <form action="/auth/signout" method="POST">
          <button
            type="submit"
            className="border-button border-2 border-ink-primary/60 bg-transparent px-3 py-1 text-xs font-label uppercase tracking-wider text-ink-primary hover:border-ink-primary hover:bg-ink-primary hover:text-parchment-base"
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
    <form
      onSubmit={handleSubmit}
      data-testid="auth-menu-form"
      data-hydrated={mounted ? "true" : "false"}
      className="flex flex-col gap-1 sm:flex-row sm:items-center"
    >
      <div className="relative flex items-center gap-2">
        <Input
          type="email"
          name="email"
          required
          placeholder="keeper@example.com"
          value={email}
          onInput={(e) => setEmail((e.target as HTMLInputElement).value)}
          className="w-44 px-2 py-1 text-xs font-serif placeholder:text-ink-primary/40"
        />
        <button
          type="submit"
          disabled={loading}
          className="border-button border-2 border-ink-primary bg-ink-primary px-3 py-1 text-xs font-label uppercase tracking-wider text-parchment-base hover:bg-parchment-secondary hover:text-ink-primary disabled:opacity-50"
        >
          {loading ? "Sending..." : "Sign In"}
        </button>
      </div>
      {errorMsg && <span className="text-[10px] text-rust-ink font-serif italic">{errorMsg}</span>}
    </form>
  );
}
