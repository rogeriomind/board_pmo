import type { ReactNode } from "react";

export function AppLayout({
  sidebar,
  topbar,
  children
}: {
  sidebar: ReactNode;
  topbar: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-transparent md:flex">
      {sidebar}
      <div className="min-w-0 flex-1 md:pl-20">
        {topbar}
        <main className="px-4 pb-24 pt-4 md:px-6 md:pb-6">{children}</main>
      </div>
    </div>
  );
}
