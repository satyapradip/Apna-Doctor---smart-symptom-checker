import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";
import ResultsDisplay from "./ResultsDisplay";
import type { Tables } from "@/integrations/supabase/types";

type SymptomSession = Tables<"symptom_sessions">;

const SessionHistory = () => {
  const [sessions, setSessions] = useState<SymptomSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const { data, error } = await supabase
      .from("symptom_sessions")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching sessions:", error);
    } else {
      setSessions(data || []);
    }
    setLoading(false);
  };

  if (selectedSessionId) {
    return (
      <ResultsDisplay
        sessionId={selectedSessionId}
        onNewAssessment={() => setSelectedSessionId(null)}
      />
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-14 w-14 animate-spin rounded-full border-4 border-white/20 border-t-primary" />
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <Card className="text-center">
        <CardContent className="flex flex-col items-center justify-center gap-4 py-16">
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-white/10 text-primary">
            <FileText className="h-10 w-10" />
          </div>
          <p className="max-w-sm text-foreground/70">
            No assessment history yet. Complete your first assessment to unlock the journey log.
          </p>
        </CardContent>
      </Card>
    );
  }

  const getTriageBadgeVariant = (level: string) => {
    switch (level) {
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

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-white/15 bg-white/5 p-6">
        <p className="text-sm uppercase tracking-[0.35em] text-foreground/60">History</p>
        <h2 className="font-display text-3xl">Assessment Memory</h2>
        <p className="mt-2 text-foreground/70">Tap any card for a full holographic replay.</p>
      </div>

      {sessions.map((session) => (
        <Card
          key={session.id}
          className="relative overflow-hidden border-white/10 bg-white/5 transition duration-300 hover:-translate-y-1"
        >
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-white/5 to-transparent" />
          <CardHeader className="relative">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <CardTitle className="text-2xl">
                  {new Date(session.created_at).toLocaleDateString()}
                </CardTitle>
                <CardDescription>
                  {new Date(session.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </CardDescription>
              </div>
              {session.triage_level && (
                <Badge variant={getTriageBadgeVariant(session.triage_level)} className="rounded-full px-4 py-1 tracking-[0.3em]">
                  {session.triage_level.replace(/-/g, " ").toUpperCase()}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="relative space-y-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.35em] text-foreground/60">Symptoms</p>
              <p className="mt-2 text-sm text-foreground/90 line-clamp-3">{session.symptoms_text}</p>
            </div>

            {session.triage_reason && (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.35em] text-foreground/60">Assessment</p>
                <p className="mt-2 text-sm text-foreground/90 line-clamp-3">{session.triage_reason}</p>
              </div>
            )}

            <Button
              variant="outline"
              size="lg"
              className="w-full"
              onClick={() => setSelectedSessionId(session.id)}
            >
              <FileText className="mr-2 h-4 w-4" />
              View Full Results
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default SessionHistory;