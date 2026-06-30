import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { activityService, type ActivityPayload } from "../services/activityService";
import type { Activity, ActivityFilters, ActivityGroups, ActivityStatus } from "../types";
import { STATUSES } from "../types";

function emptyGroups(): ActivityGroups {
  return STATUSES.reduce((groups, status) => {
    groups[status] = [];
    return groups;
  }, {} as ActivityGroups);
}

function moveInGroups(groups: ActivityGroups | undefined, activityId: string, status: ActivityStatus) {
  if (!groups) return groups;

  const next = emptyGroups();
  let moved: Activity | undefined;

  for (const column of STATUSES) {
    for (const activity of groups[column] ?? []) {
      if (activity.id === activityId) {
        moved = { ...activity, status };
      } else {
        next[column].push(activity);
      }
    }
  }

  if (moved) {
    next[status].push(moved);
  }

  return next;
}

export function useActivities(filters: ActivityFilters) {
  return useQuery({
    queryKey: ["activities", filters],
    queryFn: () => activityService.list(filters)
  });
}

export function useActivityDetail(id?: string | null) {
  return useQuery({
    queryKey: ["activity", id],
    queryFn: () => activityService.get(id as string),
    enabled: Boolean(id)
  });
}

export function useCreateActivity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: ActivityPayload) => activityService.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activities"] });
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
      toast.success("Atividade criada com sucesso.");
    },
    onError: (error) => {
      toast.error(error.message);
    }
  });
}

export function useUpdateActivity(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: Partial<ActivityPayload>) => activityService.update(id, payload),
    onSuccess: (activity) => {
      queryClient.invalidateQueries({ queryKey: ["activities"] });
      queryClient.setQueryData(["activity", id], activity);
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
      toast.success("Atividade atualizada.");
    },
    onError: (error) => {
      toast.error(error.message);
    }
  });
}

export function useMoveActivity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ activityId, status, reason }: { activityId: string; status: ActivityStatus; reason?: string }) =>
      activityService.move(activityId, status, reason),
    onMutate: async ({ activityId, status }) => {
      await queryClient.cancelQueries({ queryKey: ["activities"] });
      const previous = queryClient.getQueriesData<ActivityGroups>({ queryKey: ["activities"] });

      queryClient.setQueriesData<ActivityGroups>({ queryKey: ["activities"] }, (old) =>
        moveInGroups(old, activityId, status)
      );

      return { previous };
    },
    onError: (error, _variables, context) => {
      context?.previous.forEach(([key, value]) => queryClient.setQueryData(key, value));
      toast.error(error.message);
    },
    onSuccess: (activity) => {
      queryClient.invalidateQueries({ queryKey: ["activities"] });
      queryClient.setQueryData(["activity", activity.id], activity);
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
      toast.success(activity.status === "DONE" ? "Atividade concluída." : "Status atualizado.");
    }
  });
}

export function useDeleteActivity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (activityId: string) => activityService.remove(activityId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activities"] });
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
      toast.success("Atividade cancelada.");
    },
    onError: (error) => {
      toast.error(error.message);
    }
  });
}
