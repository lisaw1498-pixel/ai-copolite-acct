export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen w-full grid lg:grid-cols-2 bg-white">
      <div className="hidden lg:flex flex-col justify-between p-12 bg-midnight text-white">
        <div className="flex items-center gap-2 text-lg font-semibold">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-brand-blue text-white text-sm font-bold">
            AI
          </span>
          Interview Copilot
        </div>
        <div className="max-w-md">
          <h1 className="text-4xl font-semibold leading-tight tracking-tight">
            Ace Your Next Interview With AI
          </h1>
          <p className="mt-4 text-base text-white/70">
            Turn your real experience and the job description into personalized interview
            preparation and real-time interview support.
          </p>
          <div className="mt-10 flex items-center gap-2 text-sm text-white/50">
            <span className="h-2 w-2 rounded-full bg-brand-teal" />
            Every answer is grounded in your verified experience — never invented.
          </div>
        </div>
        <p className="text-xs text-white/40">
          &copy; {new Date().getFullYear()} AI Interview Copilot
        </p>
      </div>
      <div className="flex items-center justify-center p-8">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
