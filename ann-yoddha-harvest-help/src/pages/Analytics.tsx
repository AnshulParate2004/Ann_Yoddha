import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  AlertTriangle, 
  CheckCircle2, 
  ShieldAlert, 
  TrendingUp, 
  Download, 
  Calendar,
  MapPin,
  Info,
  ArrowUpRight,
  Loader2,
  RefreshCw
} from "lucide-react";

import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend
} from "recharts";
import { motion } from "framer-motion";

type HistoryItem = {
  id: number;
  disease_name: string;
  confidence: number;
  treatment: string;
  image_url: string | null;
  timestamp: string;
};

// --- DATA PROCESSING HELPERS ---

function processChartData(history: HistoryItem[]) {
  const last14Days = Array.from({ length: 14 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (13 - i));
    return d.toISOString().split("T")[0];
  });

  const dailyMap = new Map();
  last14Days.forEach(date => dailyMap.set(date, { date, healthy: 0, diseased: 0 }));

  history.forEach(item => {
    const date = item.timestamp.split("T")[0];
    if (dailyMap.has(date)) {
      const entry = dailyMap.get(date);
      if (item.disease_name.toLowerCase() === "healthy") {
        entry.healthy += 1;
      } else if (item.disease_name.toLowerCase() !== "uncertain") {
        entry.diseased += 1;
      }
    }
  });

  return Array.from(dailyMap.values());
}

function processPieData(history: HistoryItem[]) {
  const total = history.length;
  if (total === 0) return [];
  
  const healthy = history.filter(h => h.disease_name.toLowerCase() === "healthy").length;
  const uncertain = history.filter(h => h.disease_name.toLowerCase() === "uncertain").length;
  const infected = total - healthy - uncertain;

  return [
    { name: "Healthy", value: healthy, color: "#10b981" },
    { name: "Infected", value: infected, color: "#ef4444" },
    { name: "Uncertain", value: uncertain, color: "#f59e0b" }
  ];
}

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
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));

  return { total, healthy, uncertain, diseased, avgConfidence, topDiseases };
}

// --- MAIN COMPONENT ---

const Analytics = () => {
  const [activeTab, setActiveTab] = useState("overview");

  const historyQuery = useQuery({
    queryKey: ["analytics-history"],
    queryFn: () => api.getHistory(500), // Load more for better trends
  });

  const hotspotsQuery = useQuery({
    queryKey: ["analytics-hotspots"],
    queryFn: () => api.getHotspots(),
  });

  const history = historyQuery.data?.history ?? [];
  const hotspots = hotspotsQuery.data ?? [];
  
  const metrics = useMemo(() => summarize(history), [history]);
  const trendData = useMemo(() => processChartData(history), [history]);
  const pieData = useMemo(() => processPieData(history), [history]);

  const handleDownloadPDF = async () => {
    const reportElement = document.getElementById("analytics-report");
    if (!reportElement) return;

    try {
      const canvas = await html2canvas(reportElement, { 
        scale: 2,
        useCORS: true,
        logging: false,
        ignoreElements: (el) => el.hasAttribute("data-html2canvas-ignore")
      });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save("Ann_Yoddha_Full_Analytics_Report.pdf");
    } catch (err) {
      console.error("Failed to generate PDF", err);
    }
  };

  if (historyQuery.isLoading) {
    return (
      <div className="space-y-8 p-1">
        <div className="flex justify-between items-center">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, idx) => <Skeleton key={idx} className="h-32 rounded-xl" />)}
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-[400px] rounded-2xl" />
          <Skeleton className="h-[400px] rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8" id="analytics-report">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
        <div className="space-y-2">
          <h1 className="font-display text-4xl font-bold tracking-tight">Agricultural Intelligence</h1>
          <p className="text-muted-foreground max-w-lg">
            Real-time health analytics and disease mapping based on your farm's historical diagnostic data.
          </p>
        </div>
        
        <div className="flex items-center gap-3" data-html2canvas-ignore>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => historyQuery.refetch()}
            className="hidden md:flex gap-2"
          >
            <RefreshCw className={historyQuery.isFetching ? "animate-spin h-4 w-4" : "h-4 w-4"} />
            Sync Data
          </Button>
          <Button onClick={handleDownloadPDF} className="bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-500/20 gap-2">
            <Download className="h-4 w-4" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Top Level Metric Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {[
          { label: "Total Scans", value: metrics.total, icon: Calendar, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Healthy Rate", value: `${Math.round((metrics.healthy / (metrics.total || 1)) * 100)}%`, icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "Disease Alerts", value: metrics.diseased, icon: ShieldAlert, color: "text-red-600", bg: "bg-red-50" }
        ].map((m, i) => (
          <motion.div
            key={m.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <Card className="border-none shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-6 flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">{m.label}</p>
                  <p className="text-2xl font-bold tracking-tight">{m.value}</p>
                </div>
                <div className={`p-3 rounded-xl ${m.bg}`}>
                  <m.icon className={`h-6 w-6 ${m.color}`} />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Main Insights Grid */}
      <Tabs defaultValue="overview" onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-muted/50 p-1 border" data-html2canvas-ignore>
          <TabsTrigger value="overview" className="gap-2">Overview</TabsTrigger>
          <TabsTrigger value="trends" className="gap-2">Deep Insights</TabsTrigger>
          <TabsTrigger value="hotspots" className="gap-2">Regional Map</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Daily Scan Trend */}
            <Card className="border-primary/5 shadow-sm overflow-hidden">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  14-Day Health Trend
                </CardTitle>
                <CardDescription>Daily volume of healthy vs. infected scans.</CardDescription>
              </CardHeader>
              <CardContent className="h-[320px] pt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData}>
                    <defs>
                      <linearGradient id="colorHealthy" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorDiseased" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis 
                      dataKey="date" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{fontSize: 12, fill: '#64748B'}}
                      tickFormatter={(str) => {
                        const d = new Date(str);
                        return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
                      }}
                    />
                    <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748B'}} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      labelClassName="font-medium text-slate-800"
                    />
                    <Area type="monotone" dataKey="healthy" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorHealthy)" name="Healthy" />
                    <Area type="monotone" dataKey="diseased" stroke="#ef4444" strokeWidth={2} fillOpacity={1} fill="url(#colorDiseased)" name="Infected" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Pie Chart Distribution */}
            <Card className="border-primary/5 shadow-sm overflow-hidden">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Info className="h-5 w-5 text-primary" />
                  Health Distribution
                </CardTitle>
                <CardDescription>Composition of all your crop inspections.</CardDescription>
              </CardHeader>
              <CardContent className="h-[320px] flex flex-col items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      innerRadius={80}
                      outerRadius={100}
                      paddingAngle={8}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend verticalAlign="bottom" height={36}/>
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="trends" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Common Diseases Bar Chart */}
            <Card className="border-primary/5 shadow-sm">
              <CardHeader>
                <CardTitle>Disease Popularity</CardTitle>
                <CardDescription>Total occurrences per type of detection.</CardDescription>
              </CardHeader>
              <CardContent className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={metrics.topDiseases}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{fontSize: 10}} height={60} interval={0} angle={-15} textAnchor="end" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} name="Occurrences" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* List for Detail */}
            <Card className="border-primary/5 shadow-sm">
              <CardHeader>
                <CardTitle>Top Pathogens</CardTitle>
                <CardDescription>Ranking of detections with recommendation coverage.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {metrics.topDiseases.map((d, i) => (
                    <div key={d.name} className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-transparent hover:border-primary/20 transition-all">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 font-bold text-xs">
                          {i + 1}
                        </div>
                        <p className="font-semibold capitalize text-sm">{d.name}</p>
                      </div>
                      <Badge variant="outline" className="bg-white">{d.count} Instances</Badge>
                    </div>
                  ))}
                  {metrics.topDiseases.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                      <Info className="h-8 w-8 mb-2 opacity-20" />
                      <p className="text-sm">No positive detections recorded yet.</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="hotspots" className="space-y-6">
          <Card className="border-primary/5 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-red-500" />
                  Regional Disease Hotspots
                </CardTitle>
                <CardDescription>Aggregated data from farmers in your nearby regions.</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {hotspots.length > 0 ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {hotspots.map((h, i) => (
                    <div key={i} className="group relative overflow-hidden rounded-2xl border p-5 hover:bg-muted/30 transition-all">
                      <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60 mb-1">{h.region}</p>
                      <h4 className="text-xl font-bold capitalize mb-4">{h.disease}</h4>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-sm">
                          <Badge variant="destructive" className="px-2 py-0 h-5 text-[10px] uppercase">{h.severity}</Badge>
                        </div>
                        <p className="text-xs font-semibold">{h.count} active reports</p>
                      </div>
                      <ArrowUpRight className="absolute right-3 top-3 h-4 w-4 opacity-0 group-hover:opacity-40 transition-opacity" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                  <div className="p-4 rounded-full bg-muted mb-4">
                    <MapPin className="h-10 w-10 opacity-20" />
                  </div>
                  <h3 className="text-lg font-medium text-foreground">No Hotspots Tracked</h3>
                  <p className="text-sm max-w-[300px] text-center mt-1">When more data is collected across your region, high-risk areas will appear here.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Analytics;
