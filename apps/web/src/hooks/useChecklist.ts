import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { checklistService } from "../services/checklistService";

export function useAddChecklistItem(activityId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (title: string) => checklistService.add(activityId, title),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activity", activityId] });
      queryClient.invalidateQueries({ queryKey: ["activities"] });
    },
    onError: (error) => toast.error(error.message)
  });
}

export function useUpdateChecklistItem(activityId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ itemId, isDone }: { itemId: string; isDone: boolean }) =>
      checklistService.update(itemId, { isDone }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activity", activityId] });
      queryClient.invalidateQueries({ queryKey: ["activities"] });
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
    },
    onError: (error) => toast.error(error.message)
  });
}

export function useRemoveChecklistItem(activityId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: checklistService.remove,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activity", activityId] });
      queryClient.invalidateQueries({ queryKey: ["activities"] });
    },
    onError: (error) => toast.error(error.message)
  });
}
