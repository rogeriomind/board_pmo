import type { User } from "../types";
import { apiRequest } from "./api";

export const userService = {
  list() {
    return apiRequest<User[]>("/users");
  }
};
