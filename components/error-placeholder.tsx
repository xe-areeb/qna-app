import type { ReactNode } from "react";

export function ErrorPlaceholder({
  title = "Something went wrong",
  children,
}: {
  title?: string;
  children?: ReactNode;
}) {
  return (
    <div
      className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-100"
      role="alert"
    >
      <p className="font-medium">{title}</p>
      {children ? <div className="mt-2 text-red-800 dark:text-red-200">{children}</div> : null}
    </div>
  );
}
