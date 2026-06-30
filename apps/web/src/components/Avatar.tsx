import { initials } from "../utils/format";
import type { User } from "../types";

export function Avatar({ user, size = "md" }: { user?: User | null; size?: "sm" | "md" | "lg" }) {
  const sizes = {
    sm: "h-7 w-7 text-[11px]",
    md: "h-9 w-9 text-xs",
    lg: "h-11 w-11 text-sm"
  };

  if (user?.avatarUrl) {
    return (
      <img
        src={user.avatarUrl}
        alt={user.name}
        className={`${sizes[size]} rounded-full border border-white bg-slate-100 object-cover shadow-sm`}
      />
    );
  }

  return (
    <span
      className={`${sizes[size]} inline-flex items-center justify-center rounded-full bg-ink text-white shadow-sm`}
      title={user?.name}
    >
      {initials(user?.name)}
    </span>
  );
}
