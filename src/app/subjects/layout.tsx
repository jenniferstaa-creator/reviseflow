import Link from "next/link";

export default function SubjectsSectionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/80 bg-card/60 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 md:px-8">
          <Link
            href="/subjects"
            className="font-heading text-sm font-semibold tracking-tight text-foreground hover:text-primary"
          >
            ReviseFlow
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link
              href="/subjects"
              className="font-medium text-foreground hover:text-primary"
            >
              Subjects
            </Link>
          </nav>
        </div>
      </header>
      {children}
    </div>
  );
}
