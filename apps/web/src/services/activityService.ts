import type { Activity, ActivityFilters, ActivityGroups, ActivityStatus, Priority } from "../types";
import { apiRequest } from "./api";

export type ActivityPayload = {
  tenantId?: string | null;
  projectId?: string | null;
  title: string;
  description?: string | null;
  status?: ActivityStatus;
  priority?: Priority;
  assigneeId?: string | null;
  dueDate?: string | null;
  tags?: string[];
  checklist?: string[];
};

function toQuery(filters: ActivityFilters) {
  const params = new URLSearchParams();

  if (filters.search) params.set("search", filters.search);
  if (filters.tenantId) params.set("tenantId", filters.tenantId);
  if (filters.projectId) params.set("projectId", filters.projectId);
  if (filters.assigneeId) params.set("assigneeId", filters.assigneeId);
  if (filters.priority) params.set("priority", filters.priority);
  if (filters.status) params.set("status", filters.status);

  return params.toString() ? `?${params.toString()}` : "";
}

export const activityService = {
  list(filters: ActivityFilters) {
    return apiRequest<ActivityGroups>(`/activities${toQuery(filters)}`);
  },

  get(id: string) {
    return apiRequest<Activity>(`/activities/${id}`);
  },

  create(payload: ActivityPayload) {
    return apiRequest<Activity>("/activities", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },

  update(id: string, payload: Partial<ActivityPayload>) {
    return apiRequest<Activity>(`/activities/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    });
  },

  move(id: string, status: ActivityStatus, reason?: string) {
    return apiRequest<Activity>(`/activities/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status, reason })
    });
  },

  remove(id: string) {
    return apiRequest<Activity>(`/activities/${id}`, {
      method: "DELETE"
    });
  }
};
