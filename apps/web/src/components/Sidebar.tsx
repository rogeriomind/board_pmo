import clsx from "clsx";
import {
  BarChart3,
  Bell,
  CalendarDays,
  CheckSquare,
  HelpCircle,
  KanbanSquare,
  LogOut,
  Menu,
  Settings
} from "lucide-react";

type View = "board" | "alerts";

const navItems = [
  { key: "board", label: "Board", icon: KanbanSquare, enabled: true },
  { key: "activities", label: "Atividades", icon: CheckSquare, enabled: false },
  { key: "calendar", label: "Calendário", icon: CalendarDays, enabled: false },
  { key: "reports", label: "Relatórios", icon: BarChart3, enabled: false },
  { key: "alerts", label: "Alertas", icon: Bell, enabled: true },
  { key: "settings", label: "Configurações", icon: Settings, enabled: false }
];

export function Sidebar({
  activeView,
  alertCount,
  onChangeView,
  onLogout
}: {
  activeView: View;
  alertCount: number;
  onChangeView: (view: View) => void;
  onLogout: () => void;
}) {
  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-20 flex-col border-r border-white/10 bg-[#071536] p-3 text-white md:flex">
        <div className="mb-5 flex h-11 items-center justify-center rounded-lg bg-white/10">
          <Menu className="h-5 w-5" />
        </div>
        <nav className="flex flex-1 flex-col gap-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.key === activeView;
            return (
              <button
                key={item.key}
                type="button"
                disabled={!item.enabled}
                onClick={() => item.enabled && onChangeView(item.key as View)}
                className={clsx(
                  "group relative flex h-12 items-center justify-center rounded-lg text-white/70 transition",
                  isActive && "bg-brand text-white shadow-lg shadow-brand/20",
                  item.enabled ? "hover:bg-white/10 hover:text-white" : "cursor-not-allowed opacity-45"
                )}
                aria-label={item.label}
                title={item.label}
              >
                <Icon className="h-5 w-5" />
                {item.key === "alerts" && alertCount > 0 ? (
                  <span className="absolute right-1 top-1 min-w-5 rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                    {alertCount}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>
        <div className="space-y-2">
          <button
            type="button"
            className="flex h-12 w-full items-center justify-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white"
            aria-label="Ajuda"
            title="Ajuda"
          >
            <HelpCircle className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={onLogout}
            className="flex h-12 w-full items-center justify-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white"
            aria-label="Sair"
            title="Sair"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </aside>

      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-3 border-t border-slate-200 bg-white p-2 shadow-panel md:hidden">
        <MobileItem
          active={activeView === "board"}
          label="Board"
          icon={KanbanSquare}
          onClick={() => onChangeView("board")}
        />
        <MobileItem
          active={activeView === "alerts"}
          label="Alertas"
          icon={Bell}
          badge={alertCount}
          onClick={() => onChangeView("alerts")}
        />
        <MobileItem active={false} label="Sair" icon={LogOut} onClick={onLogout} />
      </nav>
    </>
  );
}

function MobileItem({
  active,
  label,
  badge,
  icon: Icon,
  onClick
}: {
  active: boolean;
  label: string;
  badge?: number;
  icon: typeof Bell;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "relative flex h-12 flex-col items-center justify-center gap-1 rounded-md text-xs font-semibold",
        active ? "bg-violet-50 text-brand" : "text-muted"
      )}
    >
      <Icon className="h-5 w-5" />
      {label}
      {badge ? (
        <span className="absolute right-5 top-1 min-w-5 rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
          {badge}
        </span>
      ) : null}
    </button>
  );
}
