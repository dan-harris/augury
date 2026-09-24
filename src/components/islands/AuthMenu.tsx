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
          className="text-xs font-medium text-gray-300 transition-colors hover:text-indigo-400 focus:outline-none"
        >
          <span className="hidden sm:inline text-gray-400 me-1">Signed in as</span>
          <span className="font-semibold text-white underline decoration-indigo-500/40 underline-offset-4">
            {userEmail}
          </span>
        </a>

        <a
          href="/admin"
          className="rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-3 py-1.5 text-xs font-medium text-indigo-300 transition-all hover:bg-indigo-500/20"
        >
          Admin
        </a>

        <form action="/auth/signout" method="POST">
          <button
            type="submit"
            className="rounded-lg border border-gray-700/60 bg-gray-800/40 px-3 py-1.5 text-xs font-medium text-gray-400 transition-all hover:border-red-500/40 hover:bg-red-950/20 hover:text-red-300"
          >
            Sign Out
          </button>
        </form>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-950/30 px-3.5 py-1.5 text-xs text-emerald-300 shadow-sm">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4 shrink-0 text-emerald-400"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
            clipRule="evenodd"
          />
        </svg>
        <span>Check your email for the magic link!</span>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-1 sm:flex-row sm:items-center">
      <div className="relative flex items-center">
        <input
          type="email"
          required
          placeholder="admin@example.com"
          value={email}
          onInput={(e) => setEmail((e.target as HTMLInputElement).value)}
          className="w-48 rounded-lg border border-gray-700/80 bg-gray-900/80 px-3 py-1.5 text-xs text-gray-100 placeholder-gray-500 transition-all focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
        <button
          type="submit"
          disabled={loading}
          className="ms-2 rounded-lg border border-indigo-500/40 bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition-all hover:bg-indigo-500 disabled:opacity-50"
        >
          {loading ? "Sending..." : "Sign In"}
        </button>
      </div>
      {errorMsg && <span className="text-[10px] text-red-400">{errorMsg}</span>}
    </form>
  );
}
