import { useState } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart";

const severityColor: Record<string, string> = {
  low: "bg-severity-low text-white",
  medium: "bg-severity-medium text-white",
  high: "bg-severity-high text-white",
  critical: "bg-severity-critical text-white",
};

const chartConfig = {
  predicted_cases: { label: "Predicted Cases", color: "hsl(var(--primary))" },
};

const Analytics = () => {
  const [region, setRegion] = useState<string>("");

  const hotspots = useQuery({
    queryKey: ["hotspots", region],
    queryFn: () => api.getHotspots(region || undefined),
  });

  const predictive = useQuery({
    queryKey: ["predictive"],
    queryFn: () => api.getPredictive(),
  });

  const regions = [...new Set(hotspots.data?.map((h) => h.region) || [])];

  return (
    <div className="space-y-8">
      <h1 className="font-display text-3xl font-bold">Analytics</h1>

      {/* Hotspots */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="border-primary/10">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Disease Hotspots</CardTitle>
            <Select value={region} onValueChange={setRegion}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="All Regions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Regions</SelectItem>
                {regions.map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            {hotspots.isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : !hotspots.data?.length ? (
              <p className="py-8 text-center text-muted-foreground">No hotspot data available.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Region</TableHead>
                      <TableHead>Disease</TableHead>
                      <TableHead>Cases</TableHead>
                      <TableHead>Severity</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {hotspots.data.map((h, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{h.region}</TableCell>
                        <TableCell>{h.disease}</TableCell>
                        <TableCell>{h.count}</TableCell>
                        <TableCell>
                          <Badge className={severityColor[h.severity?.toLowerCase()] || "bg-muted"}>
                            {h.severity}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Predictive */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
        <Card className="border-primary/10">
          <CardHeader>
            <CardTitle>Predictive Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            {predictive.isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : !predictive.data?.length ? (
              <p className="py-8 text-center text-muted-foreground">No predictive data available.</p>
            ) : (
              <ChartContainer config={chartConfig} className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={predictive.data}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="month" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip content={<ChartTooltipContent />} />
                    <Legend />
                    <Bar dataKey="predicted_cases" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default Analytics;
