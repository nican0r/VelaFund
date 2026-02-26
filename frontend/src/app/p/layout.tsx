/**
 * Public profile layout — minimal chrome, no sidebar, no auth required.
 * Used for the /p/[slug] public company profile pages.
 */
export default function PublicProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      {children}
    </div>
  );
}
