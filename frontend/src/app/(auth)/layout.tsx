export default function AuthGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-[420px]">
        {/* Logo */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-navy-900">Navia</h1>
          <p className="mt-1 text-sm text-gray-500">
            Investor-readiness for Brazilian startups
          </p>
        </div>

        {/* Auth card */}
        <div className="rounded-xl bg-white p-8 shadow-lg">
          {children}
        </div>
      </div>
    </div>
  );
}
