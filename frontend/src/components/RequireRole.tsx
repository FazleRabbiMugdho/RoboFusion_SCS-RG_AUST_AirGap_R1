import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore, type UserRole } from "../store/authStore";

interface RequireRoleProps {
  role: UserRole;
}

export function RequireRole({ role }: RequireRoleProps) {
  const userRole = useAuthStore((state) => state.role);

  if (userRole !== role) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
