import Link from "next/link";

export default function LoginRequired({ what }: { what: string }) {
  return (
    <div className="card mx-auto mt-6 max-w-md p-8 text-center">
      <p className="text-5xl">🔒</p>
      <p className="mt-3 font-semibold">Log in to {what}</p>
      <p className="mt-1 text-sm text-muted">Note: logins are kept in memory, so refreshing the page logs you out.</p>
      <div className="mt-5 flex justify-center gap-3">
        <Link href="/login" className="btn-primary">Log in</Link>
        <Link href="/register" className="btn-outline">Sign up</Link>
      </div>
    </div>
  );
}
