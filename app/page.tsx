"use client";

import { useState, useCallback, useRef } from "react";
import { convertPdf, mergePdfs, type ConvertFormat } from "@/lib/api";

const CONVERT_FORMATS: { value: ConvertFormat; label: string; description: string }[] = [
  { value: "pdf-to-word", label: "PDF → Word", description: "Convert PDF to editable .docx" },
  { value: "pdf-to-image", label: "PDF → Image", description: "Export pages as PNG images" },
  { value: "pdf-to-text", label: "PDF → Text", description: "Extract plain text content" },
  { value: "compress", label: "Compress PDF", description: "Reduce file size" },
];

type AppMode = "convert" | "merge";
type JobStatus = "idle" | "uploading" | "processing" | "done" | "error";

interface JobResult {
  downloadUrl: string;
  filename: string;
  message?: string;
}

export default function HomePage() {
  const [mode, setMode] = useState<AppMode>("convert");
  const [selectedFormat, setSelectedFormat] = useState<ConvertFormat>("pdf-to-word");
  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState<JobStatus>("idle");
  const [result, setResult] = useState<JobResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const acceptedTypes = "application/pdf";
  const maxFiles = mode === "merge" ? 10 : 1;

  const handleFiles = useCallback(
    (incoming: FileList | File[]) => {
      const arr = Array.from(incoming).filter((f) => f.type === "application/pdf");
      if (arr.length === 0) {
        setErrorMsg("Please select valid PDF files.");
        return;
      }
      setFiles((prev) => {
        const combined = mode === "merge" ? [...prev, ...arr] : arr;
        return combined.slice(0, maxFiles);
      });
      setErrorMsg("");
      setResult(null);
      setStatus("idle");
    },
    [mode, maxFiles]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setResult(null);
    setStatus("idle");
  };

  const handleSubmit = async () => {
    if (files.length === 0) {
      setErrorMsg("Please select at least one PDF file.");
      return;
    }
    if (mode === "merge" && files.length < 2) {
      setErrorMsg("Please select at least 2 PDF files to merge.");
      return;
    }

    setStatus("uploading");
    setErrorMsg("");
    setResult(null);

    try {
      setStatus("processing");
      let data: JobResult;

      if (mode === "merge") {
        data = await mergePdfs(files);
      } else {
        data = await convertPdf(files[0], selectedFormat);
      }

      setResult(data);
      setStatus("done");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "An unexpected error occurred.";
      setErrorMsg(message);
      setStatus("error");
    }
  };

  const reset = () => {
    setFiles([]);
    setResult(null);
    setStatus("idle");
    setErrorMsg("");
  };

  const switchMode = (m: AppMode) => {
    setMode(m);
    reset();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      {/* Header */}
      <header className="border-b border-border bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">📄</span>
            <span className="text-xl font-bold tracking-tight">PDFOasis</span>
          </div>
          <span className="text-sm text-muted-foreground hidden sm:block">
            Free PDF tools — no sign-up required
          </span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-10 space-y-8">
        {/* Hero */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-extrabold tracking-tight">
            PDF Tools, Simplified
          </h1>
          <p className="text-muted-foreground text-lg">
            Convert or merge your PDFs in seconds — no account, no watermarks.
          </p>
        </div>

        {/* Mode tabs */}
        <div className="flex gap-2 p-1 bg-muted rounded-xl w-fit mx-auto">
          {(["convert", "merge"] as AppMode[]).map((m) => (
            <button
              key={m}
              onClick={() => switchMode(m)}
              className={`px-6 py-2 rounded-lg text-sm font-medium transition-all capitalize ${
                mode === m
                  ? "bg-white dark:bg-slate-800 shadow text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {m === "convert" ? "🔄 Convert" : "🔗 Merge"}
            </button>
          ))}
        </div>

        {/* Format selector (convert mode only) */}
        {mode === "convert" && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {CONVERT_FORMATS.map((fmt) => (
              <button
                key={fmt.value}
                onClick={() => setSelectedFormat(fmt.value)}
                className={`p-3 rounded-xl border text-left transition-all ${
                  selectedFormat === fmt.value
                    ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                    : "border-border bg-white dark:bg-slate-800 hover:border-primary/50"
                }`}
              >
                <div className="font-semibold text-sm">{fmt.label}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{fmt.description}</div>
              </button>
            ))}
          </div>
        )}

        {/* Drop zone */}
        <div
          onDrop={onDrop}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onClick={() => fileInputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all ${
            dragOver
              ? "border-primary bg-primary/5 scale-[1.01]"
              : "border-border bg-white dark:bg-slate-800 hover:border-primary/60 hover:bg-primary/5"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={acceptedTypes}
            multiple={mode === "merge"}
            className="hidden"
            onChange={(e) => e.target.files && handleFiles(e.target.files)}
          />
          <div className="text-4xl mb-3">📂</div>
          <p className="font-semibold text-lg">
            {dragOver ? "Drop your PDF here" : "Drag & drop or click to upload"}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {mode === "merge"
              ? `Select up to ${maxFiles} PDF files to merge`
              : "Select a single PDF file to convert"}
          </p>
        </div>

        {/* File list */}
        {files.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">
              {files.length} file{files.length > 1 ? "s" : ""} selected
            </p>
            {files.map((file, i) => (
              <div
                key={i}
                className="flex items-center justify-between bg-white dark:bg-slate-800 border border-border rounded-xl px-4 py-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-xl">📄</span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => removeFile(i)}
                  className="text-muted-foreground hover:text-destructive transition-colors ml-4 text-lg leading-none"
                  aria-label="Remove file"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Error message */}
        {errorMsg && (
          <div className="bg-destructive/10 border border-destructive/30 text-destructive rounded-xl px-4 py-3 text-sm">
            ⚠️ {errorMsg}
          </div>
        )}

        {/* Action button */}
        {status !== "done" && (
          <button
            onClick={handleSubmit}
            disabled={files.length === 0 || status === "processing" || status === "uploading"}
            className="w-full py-4 rounded-xl bg-primary text-primary-foreground font-semibold text-base transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {status === "uploading" || status === "processing" ? (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full" />
                {status === "uploading" ? "Uploading…" : "Processing…"}
              </span>
            ) : mode === "merge" ? (
              "🔗 Merge PDFs"
            ) : (
              `🔄 Convert to ${CONVERT_FORMATS.find((f) => f.value === selectedFormat)?.label.split("→")[1]?.trim() ?? "output"}`
            )}
          </button>
        )}

        {/* Result */}
        {status === "done" && result && (
          <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-2xl p-6 text-center space-y-4">
            <div className="text-4xl">✅</div>
            <p className="font-semibold text-green-800 dark:text-green-300">
              {result.message ?? "Your file is ready!"}
            </p>
            <div className="flex gap-3 justify-center flex-wrap">
              <a
                href={result.downloadUrl}
                download={result.filename}
                className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium transition-colors"
              >
                ⬇️ Download {result.filename}
              </a>
              <button
                onClick={reset}
                className="inline-flex items-center gap-2 px-6 py-3 bg-white dark:bg-slate-800 border border-border rounded-xl font-medium hover:bg-muted transition-colors"
              >
                🔁 Convert another
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border mt-16 py-6 text-center text-sm text-muted-foreground">
        <p>PDFOasis — Free PDF tools. Your files are processed securely and deleted after download.</p>
      </footer>
    </div>
  );
}
