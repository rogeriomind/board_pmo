import { useQuery } from "@tanstack/react-query";
import { alertService } from "../services/alertService";

export function useAlerts(enabled = true) {
  return useQuery({
    queryKey: ["alerts"],
    queryFn: alertService.list,
    enabled
  });
}
