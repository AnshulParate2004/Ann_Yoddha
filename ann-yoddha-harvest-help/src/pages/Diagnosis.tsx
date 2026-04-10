import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Upload, Camera, Loader2, ArrowLeft, RotateCcw, ShieldCheck, CloudOff, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Step = "upload" | "result";

const Diagnosis = () => {
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [result, setResult] = useState<{
    disease_name: string;
    confidence: number;
    treatment: string;
    timestamp: string;
    status: string;
    image_url?: string | null;
  } | null>(null);
  const [streamedTreatment, setStreamedTreatment] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const { toast } = useToast();

  const startStreaming = async (disease: string) => {
    setIsStreaming(true);
    setStreamedTreatment("Connecting to agronomy expert...");
    try {
      const response = await api.streamRecommendation(disease);
      const reader = response.body?.getReader();
      const decoder = new TextDecoder("utf-8");
      if (!reader) return;

      let done = false;
      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const dataStr = line.slice(6);
              if (dataStr.trim()) {
                try {
                  const data = JSON.parse(dataStr);
                  if (data.event === "status") {
                    setStreamedTreatment(`⏳ ${data.message}`);
                  } else if (data.event === "final_result") {
                    setStreamedTreatment(data.data.answer);
                  } else if (data.event === "error") {
                    setStreamedTreatment(`❌ Error: ${data.message}`);
                  }
                } catch (e) {
                  // Ignore JSON parse errors for incomplete chunks
                }
              }
            }
          }
        }
      }
    } catch (err) {
      console.error(err);
      setStreamedTreatment(null);
    } finally {
      setIsStreaming(false);
    }
  };

  const upload = useMutation({
    mutationFn: (f: File) => api.uploadDiagnosis(f),
    onSuccess: (data) => {
      setResult(data);
      setStep("result");
      setStreamedTreatment(null);
      if (data.disease_name.toLowerCase() !== "healthy" && data.disease_name.toLowerCase() !== "uncertain") {
        startStreaming(data.disease_name);
      }
    },
    onError: (err: any) => {
      toast({ title: "Analysis failed", description: err.message, variant: "destructive" });
    },
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
    setStreamedTreatment(null);
    setIsStreaming(false);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        {step !== "upload" && (
          <Button variant="ghost" size="icon" onClick={reset}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
        )}
        <h1 className="font-display text-3xl font-bold">
          {step === "upload" ? "Upload Crop Image" : "Diagnosis Result"}
        </h1>
      </div>

      <AnimatePresence mode="wait">
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
                      <p className="text-muted-foreground">Drag and drop or click to upload</p>
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
                      {upload.isPending ? "Analyzing crop image..." : "Analyze Image"}
                    </Button>
                    <Button variant="outline" onClick={reset}>Clear</Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {step === "result" && result && (
          <motion.div key="result" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} className="space-y-4">
            {preview && (
              <Card className="overflow-hidden border-primary/10">
                <img
                  src={result.image_url || preview || ""}
                  alt="Analyzed"
                  className="mx-auto max-h-[300px] object-contain p-4"
                />
              </Card>
            )}
            <Card className="border-primary/10">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xl capitalize">
                    {result.disease_name === "uncertain" ? "Uncertain" : result.disease_name}
                  </CardTitle>
                  <Badge className={result.status === "saved_to_cloud" ? "bg-primary text-white" : "bg-muted"}>
                    {result.status === "saved_to_cloud" ? "Saved to cloud" : result.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="rounded-lg border bg-muted/30 p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-muted-foreground">Expert Recommendation</p>
                    {isStreaming && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                  </div>
                  <p className="mt-1 whitespace-pre-wrap">{streamedTreatment || result.treatment}</p>
                </div>

                {result.disease_name === "healthy" && (
                  <div className="flex items-start gap-3 rounded-lg bg-primary/10 p-4 text-sm">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 text-primary" />
                    <p>No urgent treatment needed. Continue scouting and preventive care.</p>
                  </div>
                )}

                {result.disease_name === "uncertain" && (
                  <div className="flex items-start gap-3 rounded-lg bg-amber-50 p-4 text-sm text-amber-950">
                    <CloudOff className="mt-0.5 h-5 w-5 text-amber-700" />
                    <p>Retake the image in better lighting and focus on one leaf or wheat head before acting on this result.</p>
                  </div>
                )}

                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <ShieldCheck className="h-4 w-4" />
                  Diagnosis generated at {new Date(result.timestamp).toLocaleString()}
                </div>
              </CardContent>
            </Card>
            <div className="flex gap-3">
              <Button variant="outline" onClick={reset} className="flex-1 gap-2">
                <RotateCcw className="h-4 w-4" />
                Scan Again
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Diagnosis;
