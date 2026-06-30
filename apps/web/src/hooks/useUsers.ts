import { useQuery } from "@tanstack/react-query";
import { userService } from "../services/userService";

export function useUsers() {
  return useQuery({
    queryKey: ["users"],
    queryFn: userService.list
  });
}
