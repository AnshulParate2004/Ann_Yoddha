import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Upload, Camera, Loader2, ArrowLeft, RotateCcw, Sprout, FlaskConical, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const severityColor: Record<string, string> = {
  low: "bg-severity-low text-white",
  medium: "bg-severity-medium text-white",
  high: "bg-severity-high text-white",
  critical: "bg-severity-critical text-white",
};

const treatmentIcon: Record<string, typeof Sprout> = {
  chemical: FlaskConical,
  organic: Sprout,
  preventive: ShieldCheck,
};

type Step = "upload" | "result" | "recommendations";

const Diagnosis = () => {
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [result, setResult] = useState<any>(null);
  const { toast } = useToast();

  const upload = useMutation({
    mutationFn: (f: File) => api.uploadDiagnosis(f),
    onSuccess: (data) => {
      setResult(data);
      setStep("result");
    },
    onError: (err: any) => {
      toast({ title: "Analysis failed", description: err.message, variant: "destructive" });
    },
  });

  const topDetection = result?.detections?.[0];
  const recs = useQuery({
    queryKey: ["recommendations", topDetection?.disease, topDetection?.severity],
    queryFn: () => api.getRecommendations(topDetection.disease, topDetection.severity),
    enabled: step === "recommendations" && !!topDetection,
  });

  const handleFile = (f: File) => {
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const f = e.dataTransfer.files[0];
    if (f && f.type.startsWith("image/")) handleFile(f);
  }, []);

  const reset = () => {
    setStep("upload");
    setFile(null);
    setPreview(null);
    setResult(null);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        {step !== "upload" && (
          <Button variant="ghost" size="icon" onClick={() => step === "recommendations" ? setStep("result") : reset()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
        )}
        <h1 className="font-display text-3xl font-bold">
          {step === "upload" ? "Upload Crop Image" : step === "result" ? "Diagnosis Result" : "Recommendations"}
        </h1>
      </div>

      <AnimatePresence mode="wait">
        {/* Step 1: Upload */}
        {step === "upload" && (
          <motion.div key="upload" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}>
            <Card className="border-primary/10">
              <CardContent className="p-6">
                <div
                  className={`relative flex min-h-[240px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed transition-colors ${
                    dragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                  }`}
                  onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                  onDragLeave={() => setDragActive(false)}
                  onDrop={handleDrop}
                  onClick={() => document.getElementById("file-input")?.click()}
                >
                  <input
                    id="file-input"
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                  />
                  {preview ? (
                    <motion.img
                      src={preview}
                      alt="Preview"
                      className="max-h-[300px] rounded-lg object-contain"
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                    />
                  ) : (
                    <>
                      <Upload className="mb-3 h-10 w-10 text-muted-foreground/50" />
                      <p className="text-muted-foreground">Drag & drop or click to upload</p>
                      <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                        <Camera className="h-4 w-4" />
                        Or use your camera
                      </div>
                    </>
                  )}
                </div>
                {file && (
                  <div className="mt-4 flex items-center gap-3">
                    <Button className="flex-1 gap-2" onClick={() => upload.mutate(file)} disabled={upload.isPending}>
                      {upload.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                      {upload.isPending ? "Analyzing…" : "Analyze Image"}
                    </Button>
                    <Button variant="outline" onClick={reset}>Clear</Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Step 2: Result */}
        {step === "result" && result && (
          <motion.div key="result" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} className="space-y-4">
            {preview && (
              <Card className="overflow-hidden border-primary/10">
                <img src={preview} alt="Analyzed" className="mx-auto max-h-[300px] object-contain p-4" />
              </Card>
            )}
            {result.detections?.map((d: any, i: number) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <Card className="border-primary/10">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-xl">{d.disease}</CardTitle>
                      {d.severity && (
                        <Badge className={severityColor[d.severity?.toLowerCase()] || "bg-muted"}>
                          {d.severity}
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Confidence</span>
                        <span className="font-semibold">{(d.confidence * 100).toFixed(1)}%</span>
                      </div>
                      <Progress value={d.confidence * 100} className="h-2" />
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
            <div className="flex gap-3">
              <Button className="flex-1" onClick={() => setStep("recommendations")}>
                View Recommendations
              </Button>
              <Button variant="outline" onClick={reset} className="gap-2">
                <RotateCcw className="h-4 w-4" />
                New Scan
              </Button>
            </div>
          </motion.div>
        )}

        {/* Step 3: Recommendations */}
        {step === "recommendations" && (
          <motion.div key="recs" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} className="space-y-4">
            {recs.isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <Card key={i} className="border-primary/10">
                  <CardContent className="p-6">
                    <div className="h-6 w-1/3 animate-pulse rounded bg-muted" />
                    <div className="mt-3 h-4 w-full animate-pulse rounded bg-muted" />
                    <div className="mt-2 h-4 w-2/3 animate-pulse rounded bg-muted" />
                  </CardContent>
                </Card>
              ))
            ) : !recs.data?.treatments?.length ? (
              <Card className="border-dashed border-primary/20">
                <CardContent className="py-10 text-center text-muted-foreground">
                  No recommendations available for this disease.
                </CardContent>
              </Card>
            ) : (
              recs.data.treatments.map((t, i) => {
                const Icon = treatmentIcon[t.type?.toLowerCase()] || Sprout;
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.08 }}
                  >
                    <Card className="border-primary/10">
                      <CardContent className="flex gap-4 p-6">
                        <div className="flex-shrink-0 rounded-lg bg-primary/10 p-3">
                          <Icon className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-semibold">{t.name}</h3>
                          <Badge variant="outline" className="mb-2 mt-1 text-xs capitalize">{t.type}</Badge>
                          <p className="text-sm text-muted-foreground">{t.description}</p>
                          {t.dosage && (
                            <p className="mt-1 text-sm font-medium text-accent-foreground">Dosage: {t.dosage}</p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })
            )}
            <Button variant="outline" onClick={reset} className="w-full gap-2">
              <RotateCcw className="h-4 w-4" />
              Start New Diagnosis
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Diagnosis;
