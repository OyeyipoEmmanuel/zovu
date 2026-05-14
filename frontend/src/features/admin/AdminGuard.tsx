/**
 * AdminGuard - Route protection component
 * Checks auth store for admin role and redirects if unauthorized
 */
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";

interface AdminGuardProps {
  children: React.ReactNode;
}

export const AdminGuard: React.FC<AdminGuardProps> = ({ children }) => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/login", { replace: true });
      return;
    }

    if (user?.role !== "admin") {
      // Toast notification would go here
      navigate("/dashboard", { replace: true });
      return;
    }
  }, [isAuthenticated, user?.role, navigate]);

  if (!isAuthenticated) {
    return null;
  }

  if (user?.role !== "admin") {
    return null;
  }

  return <>{children}</>;
};
