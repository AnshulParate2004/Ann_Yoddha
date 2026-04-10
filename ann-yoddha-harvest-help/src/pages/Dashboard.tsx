import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Calendar, TrendingUp, MapPin } from "lucide-react";
import { format } from "date-fns";

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0 },
};

const Dashboard = () => {
  const { isAuthenticated, user } = useAuth();
  const profile = useQuery({
    queryKey: ["profile"],
    queryFn: () => api.getProfile(),
    enabled: isAuthenticated,
  });
  const history = useQuery({
    queryKey: ["history"],
    queryFn: () => api.getHistory(),
    enabled: isAuthenticated,
  });

  return (
    <div className="space-y-8">
      {/* Welcome */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">
            {profile.isLoading ? (
              <Skeleton className="h-9 w-48" />
            ) : (
              <>Welcome, {profile.data?.name || user?.email || "Farmer"}</>
            )}
          </h1>
          {profile.data?.region && (
            <p className="mt-1 flex items-center gap-1 text-muted-foreground">
              <MapPin className="h-4 w-4" />
              {profile.data.region}
            </p>
          )}
        </div>
        <Link to="/diagnosis">
          <Button size="lg" className="gap-2">
            <Search className="h-5 w-5" />
            New Diagnosis
          </Button>
        </Link>
      </div>

      {/* History */}
      <section>
        <h2 className="mb-4 font-display text-xl font-bold">Recent Diagnoses</h2>
        {history.isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-lg" />
            ))}
          </div>
        ) : !history.data?.history?.length ? (
          <Card className="border-dashed border-primary/20">
            <CardContent className="flex flex-col items-center py-12 text-center">
              <Search className="mb-3 h-10 w-10 text-muted-foreground/50" />
              <p className="text-muted-foreground">No diagnoses yet. Upload your first crop image!</p>
              <Link to="/diagnosis" className="mt-4">
                <Button size="sm">Start Diagnosis</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <motion.div
            className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
            variants={container}
            initial="hidden"
            animate="show"
          >
            {history.data.history.map((d) => (
              <motion.div key={d.id} variants={item}>
                <Card className="h-full border-primary/10 transition-shadow hover:shadow-md overflow-hidden">
                  {d.image_url && d.image_url.startsWith("http") && (
                    <div className="h-36 w-full overflow-hidden bg-muted/30">
                      <img
                        src={d.image_url}
                        alt={d.disease_name}
                        className="h-full w-full object-cover"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                      />
                    </div>
                  )}
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-lg font-semibold capitalize">{d.disease_name}</CardTitle>
                      <Badge className={d.disease_name.toLowerCase() === "healthy" ? "bg-primary text-white" : "bg-muted"}>
                        {d.disease_name.toLowerCase() === "healthy" ? "Healthy" : "Saved"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <TrendingUp className="h-4 w-4" />
                      Confidence: {(d.confidence * 100).toFixed(1)}%
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      {format(new Date(d.timestamp), "MMM d, yyyy")}
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">{d.treatment}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        )}
      </section>
    </div>
  );
};

export default Dashboard;
