import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ConsentFormProps {
  onConsentGiven: () => void;
}

const ConsentForm = ({ onConsentGiven }: ConsentFormProps) => {
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);

  const consentText = `I understand and acknowledge that:

1. This AI Health Assistant is a DEMONSTRATION TOOL for educational purposes only
2. This tool does NOT provide medical advice, diagnosis, or treatment
3. I should NOT use this tool for emergencies - call emergency services immediately
4. All information provided is for educational purposes and should not replace professional medical consultation
5. I will consult with qualified healthcare professionals for any medical concerns
6. The developers and operators of this tool are not liable for any decisions made based on its output
7. This is a hackathon project and not approved for clinical use
8. My data will be stored securely for the purpose of providing this service`;

  const handleSubmit = async () => {
    if (!agreed) {
      toast.error("Please agree to the terms to continue");
      return;
    }

    setLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        toast.error("Session expired. Please sign in again.");
        setLoading(false);
        return;
      }

      // Try to save consent to DB — but don't block if DB isn't set up yet
      const { error } = await supabase.from("consent_records").insert({
        user_id: user.id,
        consent_given: true,
        consent_text: consentText,
        ip_address: null,
        user_agent: navigator.userAgent,
      });

      if (error) {
        // Log the real error for debugging
        console.error("Consent DB error (non-blocking):", error.message, error.details, error.hint);
        // Store consent locally as fallback so the user isn't blocked
        localStorage.setItem(`apna-consent-${user.id}`, "true");
        // Still proceed — don't block the user for a DB setup issue
        toast.success("Consent recorded. Welcome to Apna Doctor! 🩺");
        onConsentGiven();
        return;
      }

      // Also store locally so we can check without extra DB calls
      localStorage.setItem(`apna-consent-${user.id}`, "true");
      toast.success("Consent recorded successfully! Let's get started.");
      onConsentGiven();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error("Consent submission failed:", msg);
      // Still let user proceed with local-only consent
      toast.info("Proceeding with local consent record.");
      onConsentGiven();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <Card className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-destructive/5 via-transparent to-transparent" />
        <CardHeader className="relative">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/20 text-destructive">
              <AlertCircle className="h-7 w-7" />
            </div>
            <div>
              <CardTitle className="text-3xl">Consent &amp; Safety</CardTitle>
              <CardDescription>
                Ultra-important reminder: this is a playful educational demo, not medical advice.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="relative space-y-6">
          <Alert variant="destructive" className="border-destructive/40 bg-destructive/10">
            <AlertCircle className="h-5 w-5" />
            <AlertDescription>
              <strong>Emergency?</strong> Skip the app and contact emergency services immediately.
              This experience cannot diagnose or treat urgent conditions.
            </AlertDescription>
          </Alert>

          <div className="rounded-3xl border border-white/15 bg-white/5 p-5">
            <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground/80">
              {consentText}
            </pre>
          </div>

          <div className="flex items-start gap-3 rounded-3xl border border-white/15 bg-white/5 p-4">
            <Checkbox
              id="consent"
              checked={agreed}
              onCheckedChange={(checked) => setAgreed(checked === true)}
              className="mt-1"
            />
            <label
              htmlFor="consent"
              className="cursor-pointer text-sm leading-relaxed text-foreground/80"
            >
              I have read and agree to the clinical terms above. I understand this is an educational
              demonstration tool only and not a substitute for professional medical advice.
            </label>
          </div>

          <Button
            onClick={handleSubmit}
            disabled={!agreed || loading}
            className="w-full text-base gap-2"
          >
            {loading ? (
              "Recording Consent..."
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                I Agree — Continue to Assessment Lab
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default ConsentForm;