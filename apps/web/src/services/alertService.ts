import type { AlertGroups } from "../types";
import { apiRequest } from "./api";

export const alertService = {
  list() {
    return apiRequest<AlertGroups>("/alerts");
  }
};
