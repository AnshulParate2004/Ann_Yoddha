import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Leaf } from "lucide-react";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="flex max-w-sm flex-col items-center gap-4 rounded-2xl border border-primary/15 bg-card p-8 text-center shadow-sm">
          <Leaf className="h-8 w-8 text-primary" />
          <div>
            <p className="font-semibold text-foreground">Restoring your session...</p>
            <p className="mt-1 text-sm text-muted-foreground">If this takes too long, refresh the page.</p>
          </div>
          <div className="h-7 w-7 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
