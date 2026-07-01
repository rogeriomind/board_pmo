import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";
import { ActivityCreateModal } from "./components/ActivityCreateModal";
import { ActivityDetailDrawer } from "./components/ActivityDetailDrawer";
import { AlertsPanel } from "./components/AlertsPanel";
import { AppLayout } from "./components/AppLayout";
import { CompletionModal } from "./components/CompletionModal";
import { KanbanBoard } from "./components/KanbanBoard";
import { Sidebar } from "./components/Sidebar";
import { Topbar } from "./components/Topbar";
import { useAlerts } from "./hooks/useAlerts";
import { authService } from "./services/authService";
import { AUTH_EXPIRED_EVENT, getToken } from "./services/api";
import type { Activity, ActivityFilters, ActivityStatus, AuthUser } from "./types";
import { LoginPage } from "./pages/LoginPage";

type View = "board" | "alerts";

export default function App() {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<AuthUser | null>(() => authService.getStoredUser());
  const [activeView, setActiveView] = useState<View>("board");
  const [filters, setFilters] = useState<ActivityFilters>({});
  const [createOpen, setCreateOpen] = useState(false);
  const [createStatus, setCreateStatus] = useState<ActivityStatus>("TODO");
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);
  const [completedActivity, setCompletedActivity] = useState<Activity | null>(null);
  const authenticated = Boolean(user && getToken());
  const alerts = useAlerts(authenticated);

  const resetSession = useCallback(() => {
    authService.logout();
    queryClient.clear();
    setUser(null);
    setActiveView("board");
    setSelectedActivityId(null);
  }, [queryClient]);

  useEffect(() => {
    window.addEventListener(AUTH_EXPIRED_EVENT, resetSession);

    return () => {
      window.removeEventListener(AUTH_EXPIRED_EVENT, resetSession);
    };
  }, [resetSession]);

  const alertCount = useMemo(() => {
    if (!alerts.data) return 0;
    const ids = new Set<string>();
    Object.values(alerts.data).forEach((items) => items.forEach((activity) => ids.add(activity.id)));
    return ids.size;
  }, [alerts.data]);

  function logout() {
    resetSession();
  }

  if (!authenticated || !user) {
    return (
      <>
        <LoginPage onLogin={setUser} />
        <Toaster position="top-right" />
      </>
    );
  }

  return (
    <>
      <AppLayout
        sidebar={
          <Sidebar activeView={activeView} alertCount={alertCount} onChangeView={setActiveView} onLogout={logout} />
        }
        topbar={
          <Topbar
            activeView={activeView}
            filters={filters}
            user={user}
            onChangeFilters={setFilters}
            onCreate={() => {
              setCreateStatus("TODO");
              setCreateOpen(true);
            }}
          />
        }
      >
        {activeView === "board" ? (
          <KanbanBoard
            filters={filters}
            onOpenActivity={setSelectedActivityId}
            onCreate={(status) => {
              setCreateStatus(status);
              setCreateOpen(true);
            }}
          />
        ) : (
          <AlertsPanel onOpenActivity={setSelectedActivityId} />
        )}
      </AppLayout>

      <ActivityCreateModal open={createOpen} initialStatus={createStatus} onClose={() => setCreateOpen(false)} />
      <ActivityDetailDrawer
        activityId={selectedActivityId}
        onClose={() => setSelectedActivityId(null)}
        onCompleted={setCompletedActivity}
      />
      <CompletionModal activity={completedActivity} user={user} onClose={() => setCompletedActivity(null)} />
      <Toaster position="top-right" toastOptions={{ className: "text-sm" }} />
    </>
  );
}
