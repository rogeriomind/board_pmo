import type { ChecklistItem } from "../types";
import { apiRequest } from "./api";

export const checklistService = {
  add(activityId: string, title: string) {
    return apiRequest<ChecklistItem>(`/activities/${activityId}/checklist`, {
      method: "POST",
      body: JSON.stringify({ title })
    });
  },

  update(itemId: string, payload: Partial<Pick<ChecklistItem, "title" | "isDone">>) {
    return apiRequest<ChecklistItem>(`/checklist/${itemId}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    });
  },

  remove(itemId: string) {
    return apiRequest<void>(`/checklist/${itemId}`, {
      method: "DELETE"
    });
  }
};
