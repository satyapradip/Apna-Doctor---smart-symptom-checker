import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, AlertTriangle, Info, CheckCircle, PhoneCall, Stethoscope, Phone } from "lucide-react";

interface EmergencyContact {
  service: string;
  number: string;
  description: string;
}

interface SessionData {
  id: string;
  created_at: string;
  triage_level: string;
  triage_reason: string;
  confidence_score: number;
  recommendations: {
    medicines: Medicine[];
    home_remedies: string[];
    what_to_do: string[];
    what_not_to_do: string[];
    doctor_specialization?: string;
    indian_emergency_contacts?: EmergencyContact[];
    follow_up?: Record<string, unknown>;
    disclaimer?: string;
  };
}

interface ReportFile {
  id: string;
  file_name: string;
  ocr_status: string;
  ocr_text: string | null;
  parsed_data: Record<string, unknown> | null;
  created_at: string;
}

interface Medicine {
  name: string;
  dose?: string;
  notes?: string;
}

interface ResultsDisplayProps {
  sessionId: string;
  onNewAssessment: () => void;
}

const ResultsDisplay = ({ sessionId, onNewAssessment }: ResultsDisplayProps) => {
  const [session, setSession] = useState<SessionData | null>(null);
  const [reportFiles, setReportFiles] = useState<ReportFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSession = async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from("symptom_sessions")
        .select("*")
        .eq("id", sessionId)
        .single();

      if (fetchError) {
        console.error("❌ Error fetching session:", fetchError);
        setError(fetchError.message);
        setLoading(false);
        return;
      }

      if (!data) {
        console.warn("⚠️ No session data found");
        setError("Session not found");
        setLoading(false);
        return;
      }

      // Check if recommendations are available
      if (data.triage_level && data.recommendations) {
        const recs = data.recommendations as Record<string, unknown>;
        console.log("✅ Session data with recommendations found:", {
          triage_level: data.triage_level,
          confidence_score: data.confidence_score,
          recommendations: {
            medicines: Array.isArray(recs.medicines) ? recs.medicines.length : 0,
            home_remedies: Array.isArray(recs.home_remedies) ? recs.home_remedies.length : 0,
            what_to_do: Array.isArray(recs.what_to_do) ? recs.what_to_do.length : 0,
            what_not_to_do: Array.isArray(recs.what_not_to_do) ? recs.what_not_to_do.length : 0,
          },
        });
      } else {
        console.log("⏳ Session data not yet ready - still waiting for AI analysis");
        console.log("📊 Current session state:", {
          id: data.id,
          triage_level: data.triage_level,
          has_recommendations: !!data.recommendations,
          recommendations_type: typeof data.recommendations,
          full_data: data,
        });
      }

      setSession(data as unknown as SessionData);

      // Fetch associated report files
      const { data: files, error: filesError } = await supabase
        .from("report_files")
        .select("*")
        .eq("session_id", sessionId);

      if (!filesError && files) {
        setReportFiles(files as unknown as ReportFile[]);
        console.log("📄 Report files found:", files.length);
      }

      setLoading(false);
    } catch (err) {
      console.error("❌ Fetch session error:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch session");
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSession();
    // Poll every 1.5s to catch real-time updates, but stop once data is fully loaded
    const interval = setInterval(() => {
      // If we already have complete data, stop polling
      if (session?.triage_level && session?.recommendations) {
        clearInterval(interval);
        return;
      }
      fetchSession();
    }, 1500);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        <p className="text-foreground/70">Analyzing your symptoms...</p>
      </div>
    );
  }

  if (error || !session) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error || "Failed to load session results. Please try again."}</AlertDescription>
      </Alert>
    );
  }

  // If session exists but no triage level, analysis is still pending
  if (!session.triage_level) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        <p className="text-foreground/70">AI analysis in progress...</p>
        <p className="text-sm text-foreground/50">This may take a few moments</p>
      </div>
    );
  }

  const getTriageIcon = () => {
    switch (session.triage_level) {
      case "emergency":
        return <PhoneCall className="w-6 h-6 text-emergency" />;
      case "urgent-visit":
        return <AlertTriangle className="w-6 h-6 text-urgent" />;
      case "see-doctor":
        return <AlertCircle className="w-6 h-6 text-warning" />;
      case "self-care":
        return <CheckCircle className="w-6 h-6 text-success" />;
      default:
        return <Info className="w-6 h-6 text-primary" />;
    }
  };

  const getTriageBadgeVariant = () => {
    switch (session.triage_level) {
      case "emergency":
        return "destructive";
      case "urgent-visit":
      case "see-doctor":
        return "default";
      case "self-care":
        return "secondary";
      default:
        return "outline";
    }
  };

  const recommendations = (session.recommendations as unknown as {
    medicines?: Medicine[];
    home_remedies?: string[];
    what_to_do?: string[];
    what_not_to_do?: string[];
    doctor_specialization?: string;
    indian_emergency_contacts?: EmergencyContact[];
    follow_up?: Record<string, unknown>;
    disclaimer?: string;
  }) || {};
  const confidenceScore = typeof session.confidence_score === "number" ? session.confidence_score : null;
  const createdAt = new Date(session.created_at).toLocaleString();
  
  console.log("Rendering results with:", {
    triage_level: session.triage_level,
    triage_reason: session.triage_reason,
    recommendations,
    confidenceScore,
  });
  const triageMeta: Record<string, { gradient: string; accent: string; headline: string }> = {
    emergency: {
      gradient: "from-destructive/30 via-destructive/10 to-transparent",
      accent: "text-destructive",
      headline: "EMERGENCY — seek immediate help",
    },
    "urgent-visit": {
      gradient: "from-warning/30 via-warning/10 to-transparent",
      accent: "text-warning",
      headline: "Urgent clinic visit recommended",
    },
    "see-doctor": {
      gradient: "from-secondary/30 via-secondary/10 to-transparent",
      accent: "text-secondary",
      headline: "Schedule a doctor appointment",
    },
    "self-care": {
      gradient: "from-success/30 via-success/10 to-transparent",
      accent: "text-success",
      headline: "Self-care guidance provided",
    },
  };
  const tone = triageMeta[session.triage_level] || {
    gradient: "from-primary/25 via-accent/10 to-transparent",
    accent: "text-primary",
    headline: "Assessment ready",
  };
  
  // Always show recommendations (even for emergency, show what NOT to do)
  const hasRecommendations = recommendations && (
    (Array.isArray(recommendations.medicines) && recommendations.medicines.length > 0) ||
    (Array.isArray(recommendations.home_remedies) && recommendations.home_remedies.length > 0) ||
    (Array.isArray(recommendations.what_to_do) && recommendations.what_to_do.length > 0) ||
    (Array.isArray(recommendations.what_not_to_do) && recommendations.what_not_to_do.length > 0)
  );

  return (
    <div className="space-y-10">
      {session.triage_level === "emergency" && (
        <Alert variant="destructive" className="border-2 border-destructive/40 bg-destructive/10 text-destructive">
          <PhoneCall className="h-5 w-5" />
          <AlertDescription className="text-sm">
            🚨 EMERGENCY: call emergency services immediately. This UI is educational only and cannot
            replace urgent care.
          </AlertDescription>
        </Alert>
      )}

      <Card className="relative overflow-hidden">
        <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${tone.gradient} opacity-70`} />
        <CardHeader className="relative">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 text-white">
                {getTriageIcon()}
              </div>
              <div>
                <p className="text-sm uppercase tracking-[0.35em] text-foreground/60">Triage Output</p>
                <CardTitle>Assessment Results</CardTitle>
                <CardDescription>{createdAt}</CardDescription>
              </div>
            </div>
            <Badge variant={getTriageBadgeVariant()} className="rounded-full px-4 py-2 text-xs tracking-[0.35em]">
              {session.triage_level?.replace(/-/g, " ").toUpperCase() || "PENDING"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="relative space-y-8">
          <div className={`rounded-3xl border border-white/15 bg-white/10 p-5 backdrop-blur-xl ${tone.accent}`}>
            <p className="text-xs uppercase tracking-[0.35em] opacity-80">Priority</p>
            <p className="mt-2 font-display text-2xl text-foreground">{tone.headline}</p>
            <p className="mt-3 text-sm text-foreground/80">{session.triage_reason}</p>
          </div>

          {confidenceScore !== null && (
            <div className="rounded-3xl border border-white/15 bg-white/5 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="font-display text-xl">Confidence Aura</h3>
                <span className="text-sm text-foreground/70">
                  {(confidenceScore * 100).toFixed(0)}% certainty
                </span>
              </div>
              <div className="mt-4 h-3 overflow-hidden rounded-full border border-white/15 bg-white/10">
                <div
                  className="h-full bg-gradient-to-r from-primary via-accent to-secondary transition-all duration-500"
                  style={{ width: `${confidenceScore * 100}%` }}
                />
              </div>
            </div>
          )}

          {recommendations.medicines && recommendations.medicines.length > 0 && (
            <div className="rounded-3xl border border-white/15 bg-white/5 p-5">
              <h3 className="font-display text-lg">Over-the-Counter Suggestions</h3>
              <div className="mt-4 space-y-3">
                {recommendations.medicines.map((med: Medicine, idx: number) => (
                  <div key={idx} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                    <p className="font-semibold">{med.name}</p>
                    {med.dose && <p className="text-sm text-foreground/70">Dose: {med.dose}</p>}
                    {med.notes && <p className="text-xs text-foreground/60">{med.notes}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {recommendations.home_remedies && recommendations.home_remedies.length > 0 && (
            <div className="rounded-3xl border border-white/15 bg-white/5 p-5">
              <h3 className="font-display text-lg">🏠 Indian Home Remedies for Temporary Relief</h3>
              <p className="text-xs text-foreground/60 mt-1 mb-3">Traditional home remedies to help manage symptoms at home</p>
              <ul className="mt-4 space-y-2 text-sm text-foreground/80">
                {recommendations.home_remedies.map((remedy: string, idx: number) => (
                  <li key={idx} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                    {remedy}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {recommendations.doctor_specialization && (
            <div className="rounded-3xl border border-primary/30 bg-primary/5 p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20">
                  <Stethoscope className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-display text-lg text-primary">Recommended Doctor Consultation</h3>
              </div>
              <p className="text-sm text-foreground/80 bg-white/5 rounded-2xl border border-white/10 p-3">
                <strong>Consult:</strong> {recommendations.doctor_specialization}
              </p>
            </div>
          )}

          {recommendations.indian_emergency_contacts && recommendations.indian_emergency_contacts.length > 0 && (
            <div className="rounded-3xl border border-destructive/30 bg-destructive/5 p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/20">
                  <Phone className="h-5 w-5 text-destructive" />
                </div>
                <h3 className="font-display text-lg text-destructive">🇮🇳 Indian Emergency Contacts</h3>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {recommendations.indian_emergency_contacts.map((contact: EmergencyContact, idx: number) => (
                  <div key={idx} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-semibold text-foreground">{contact.service}</p>
                      <a 
                        href={`tel:${contact.number}`} 
                        className="text-destructive font-bold text-lg hover:underline"
                      >
                        {contact.number}
                      </a>
                    </div>
                    <p className="text-xs text-foreground/60">{contact.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {hasRecommendations && (
            <div className="grid gap-6 lg:grid-cols-2">
              {recommendations.what_to_do && recommendations.what_to_do.length > 0 && (
                <div className="rounded-3xl border border-success/30 bg-success/5 p-5">
                  <h3 className="font-display text-lg text-success">What To Do</h3>
                  <ul className="mt-3 space-y-2 text-sm text-foreground/80">
                    {recommendations.what_to_do.map((item: string, idx: number) => (
                      <li key={idx} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {recommendations.what_not_to_do && recommendations.what_not_to_do.length > 0 && (
                <div className="rounded-3xl border border-destructive/30 bg-destructive/5 p-5">
                  <h3 className="font-display text-lg text-destructive">What Not To Do</h3>
                  <ul className="mt-3 space-y-2 text-sm text-foreground/80">
                    {recommendations.what_not_to_do.map((item: string, idx: number) => (
                      <li key={idx} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {recommendations.follow_up && (
            <div className="rounded-3xl border border-white/15 bg-white/5 p-5">
              <h3 className="font-display text-lg">Follow-Up Guidance</h3>
              {(recommendations.follow_up as Record<string, unknown>).when_to_see_provider && (
                <p className="mt-2 text-sm text-foreground/80">
                  <strong>When to see a provider:</strong> {(recommendations.follow_up as Record<string, unknown>).when_to_see_provider as React.ReactNode}
                </p>
              )}
              {(recommendations.follow_up as Record<string, unknown>).suggested_doctor_type && (
                <p className="mt-2 text-sm text-foreground/80">
                  <strong>Suggested provider:</strong> {(recommendations.follow_up as Record<string, unknown>).suggested_doctor_type as React.ReactNode}
                </p>
              )}
            </div>
          )}

          {reportFiles.length > 0 && (
            <div className="rounded-3xl border border-white/15 bg-white/5 p-5">
              <h3 className="font-display text-lg">📄 Uploaded Medical Reports</h3>
              <div className="mt-4 space-y-4">
                {reportFiles.map((file) => (
                  <div key={file.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-foreground">{file.file_name}</p>
                      <Badge variant={file.ocr_status === "completed" ? "secondary" : "outline"}>
                        {file.ocr_status}
                      </Badge>
                    </div>
                    {file.ocr_status === "completed" && file.ocr_text && (
                      <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-3">
                        <p className="text-xs uppercase tracking-[0.35em] text-foreground/60 mb-2">
                          Transcribed Content
                        </p>
                        <p className="text-sm text-foreground/80 whitespace-pre-wrap">{file.ocr_text}</p>
                      </div>
                    )}
                    {file.ocr_status === "completed" && file.parsed_data && (
                      <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-3">
                        <p className="text-xs uppercase tracking-[0.35em] text-foreground/60 mb-2">
                          Structured Data
                        </p>
                        <pre className="text-xs text-foreground/70 overflow-x-auto">
                          {JSON.stringify(file.parsed_data, null, 2)}
                        </pre>
                      </div>
                    )}
                    {file.ocr_status === "pending" && (
                      <p className="mt-2 text-sm text-foreground/60">Processing OCR...</p>
                    )}
                    {file.ocr_status === "failed" && (
                      <p className="mt-2 text-sm text-destructive">OCR processing failed</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <Alert className="border-white/20 bg-white/10">
            <Info className="h-4 w-4" />
            <AlertDescription className="text-xs text-foreground/70">
              <strong>Disclaimer:</strong>{" "}
              {recommendations.disclaimer ||
                "This colorful assessment is for educational purposes only and does not replace professional medical advice."}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      <Button onClick={onNewAssessment} className="w-full" size="lg">
        Start New Assessment
      </Button>
    </div>
  );
};

export default ResultsDisplay;