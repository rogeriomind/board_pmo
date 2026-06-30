import type { HistoryItem } from "../types";
import { apiRequest } from "./api";

export const historyService = {
  list(activityId: string) {
    return apiRequest<HistoryItem[]>(`/activities/${activityId}/history`);
  }
};
