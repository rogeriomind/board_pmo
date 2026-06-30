import type { AuthUser } from "../types";
import { apiRequest, clearToken, setToken } from "./api";

type LoginResponse = {
  token: string;
  user: AuthUser;
};

export const authService = {
  async login(email: string, password: string) {
    const response = await apiRequest<LoginResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password })
    });

    setToken(response.token);
    localStorage.setItem("pmo-board-user", JSON.stringify(response.user));
    return response;
  },

  getStoredUser() {
    const value = localStorage.getItem("pmo-board-user");
    return value ? (JSON.parse(value) as AuthUser) : null;
  },

  logout() {
    clearToken();
    localStorage.removeItem("pmo-board-user");
  }
};
