import type { Comment } from "../types";
import { apiRequest } from "./api";

export const commentService = {
  list(activityId: string) {
    return apiRequest<Comment[]>(`/activities/${activityId}/comments`);
  },

  add(activityId: string, message: string) {
    return apiRequest<Comment>(`/activities/${activityId}/comments`, {
      method: "POST",
      body: JSON.stringify({ message })
    });
  }
};
