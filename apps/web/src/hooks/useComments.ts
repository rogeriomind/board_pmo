import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { commentService } from "../services/commentService";

export function useAddComment(activityId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (message: string) => commentService.add(activityId, message),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activity", activityId] });
      toast.success("Comentário registrado.");
    },
    onError: (error) => toast.error(error.message)
  });
}
