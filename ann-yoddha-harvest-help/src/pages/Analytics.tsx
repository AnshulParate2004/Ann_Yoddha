import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, ShieldAlert, TrendingUp } from "lucide-react";

import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

type HistoryItem = {
  id: number;
  disease_name: string;
  confidence: number;
  treatment: string;
  image_url: string | null;
  timestamp: string;
};

function summarize(history: HistoryItem[]) {
  const total = history.length;
  const healthy = history.filter((item) => item.disease_name.toLowerCase() === "healthy").length;
  const uncertain = history.filter((item) => item.disease_name.toLowerCase() === "uncertain").length;
  const diseased = total - healthy - uncertain;
  const avgConfidence = total > 0 ? Math.round((history.reduce((acc, item) => acc + item.confidence, 0) / total) * 100) : 0;

  const counts = new Map<string, number>();
  history
    .filter((item) => item.disease_name.toLowerCase() !== "healthy" && item.disease_name.toLowerCase() !== "uncertain")
    .forEach((item) => counts.set(item.disease_name, (counts.get(item.disease_name) ?? 0) + 1));

  const topDiseases = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return { total, healthy, uncertain, diseased, avgConfidence, topDiseases };
}

const Analytics = () => {
  const historyQuery = useQuery({
    queryKey: ["analytics-history"],
    queryFn: () => api.getHistory(100),
  });

  const history = historyQuery.data?.history ?? [];
  const metrics = useMemo(() => summarize(history), [history]);

  if (historyQuery.isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, idx) => (
            <Skeleton key={idx} className="h-28 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (historyQuery.isError) {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-3xl font-bold">Analytics</h1>
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
          Could not load analytics. Check backend connection and try again.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <h1 className="font-display text-3xl font-bold">Analytics</h1>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-700" />
            <p>
              This page shows real history-based insights from your saved scans. Advanced hotspot forecasting is not enabled yet.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="border-primary/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Total Scans</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{metrics.total}</p>
          </CardContent>
        </Card>

        <Card className="border-primary/10">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              Healthy
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{metrics.healthy}</p>
          </CardContent>
        </Card>

        <Card className="border-primary/10">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldAlert className="h-4 w-4 text-amber-600" />
              Disease Detected
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{metrics.diseased}</p>
          </CardContent>
        </Card>

        <Card className="border-primary/10">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4 text-primary" />
              Avg Confidence
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{metrics.avgConfidence}%</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-primary/10">
        <CardHeader>
          <CardTitle>Top Detected Diseases</CardTitle>
        </CardHeader>
        <CardContent>
          {metrics.topDiseases.length === 0 ? (
            <p className="text-sm text-muted-foreground">No disease-positive scans yet.</p>
          ) : (
            <div className="space-y-3">
              {metrics.topDiseases.map(([name, count]) => (
                <div key={name} className="flex items-center justify-between rounded-lg border p-3">
                  <p className="font-medium capitalize">{name}</p>
                  <Badge variant="secondary">
                    {count} scan{count === 1 ? "" : "s"}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Analytics;
