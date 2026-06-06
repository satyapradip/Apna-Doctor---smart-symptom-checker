import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Activity, FileText, Heart, LogOut, Moon, SunMedium } from "lucide-react";
import { toast } from "sonner";
import { Session, User } from "@supabase/supabase-js";
import ConsentForm from "@/components/ConsentForm";
import SymptomForm from "@/components/SymptomForm";
import SessionHistory from "@/components/SessionHistory";
import { cn } from "@/lib/utils";
import UserProfileCard, { type UserProfile } from "@/components/UserProfileCard";

const Dashboard = () => {
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true); // ✅ Prevent race-condition redirect
  const [hasConsent, setHasConsent] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<"new" | "history">("new");
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window === "undefined") return "light";
    return (localStorage.getItem("apna-theme") as "light" | "dark") || "light";
  });
  const [profile, setProfile] = useState<UserProfile>(() => {
    if (typeof window === "undefined") {
      return { name: "", age: "", gender: "", location: "" };
    }
    const stored = localStorage.getItem("apna-user-profile");
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (error) {
        console.warn("Failed to parse stored profile", error);
      }
    }
    return { name: "", age: "", gender: "", location: "" };
  });
  const tabs = [
    { id: "new", label: "Symptom Lab", description: "New Assessment Flow", Icon: Activity },
    { id: "history", label: "Session Memory", description: "Previous AI Triage", Icon: FileText },
  ] as const;

  const userIdentifier = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "";
  const greetingInitials = (userIdentifier.slice(0, 2) || "TR").toUpperCase();

  useEffect(() => {
    // ✅ Get session FIRST before listening for changes (prevents flash-redirect)
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setSessionLoading(false);
      if (!session) {
        navigate("/auth");
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (!session) {
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (user) {
      checkConsent();
    }
  }, [user]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("apna-theme", theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem("apna-user-profile", JSON.stringify(profile));
  }, [profile]);

  useEffect(() => {
    if (!profile.name && userIdentifier) {
      setProfile((prev) => ({ ...prev, name: userIdentifier }));
    }
  }, [profile.name, userIdentifier]);

  const checkConsent = async () => {
    if (!user) return;

    // First check localStorage for instant response (also works if DB not set up)
    const localConsent = localStorage.getItem(`apna-consent-${user.id}`);
    if (localConsent === "true") {
      setHasConsent(true);
      return;
    }

    // Then check the DB
    try {
      const { data, error } = await supabase
        .from("consent_records")
        .select("id")
        .eq("user_id", user.id)
        .eq("consent_given", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        // Table might not exist yet — default to no consent so the form shows
        console.warn("Consent check DB error (non-blocking):", error.message);
        setHasConsent(false);
        return;
      }

      if (data) {
        // Cache it locally for next time
        localStorage.setItem(`apna-consent-${user.id}`, "true");
      }
      setHasConsent(!!data);
    } catch {
      setHasConsent(false);
    }
  };

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error("Error signing out");
    } else {
      toast.success("Signed out successfully");
      navigate("/auth");
    }
  };

  // ✅ Show spinner while checking session — prevents flash-redirect to /auth
  if (sessionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background/85 to-background/65">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="text-foreground/60 text-sm">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    navigate("/auth");
    return null;
  }

  if (hasConsent === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-background via-background/85 to-background/65">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_hsla(var(--glow-primary)/0.2),_transparent_55%)] blur-[220px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,_hsla(var(--glow-secondary)/0.18),_transparent_45%)] blur-[220px]" />
      </div>

      <header className="sticky top-0 z-20 border-b border-white/60 bg-white/80 backdrop-blur-3xl dark:border-white/15 dark:bg-white/10">
        <div className="mx-auto max-w-6xl space-y-6 px-4 py-6">
          <div className="flex flex-col gap-4 rounded-[2rem] border border-white/60 bg-white/85 px-6 py-5 shadow-[0_25px_70px_rgba(15,23,42,0.12)] backdrop-blur-2xl dark:border-white/15 dark:bg-white/10 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-secondary text-white shadow-[0_15px_40px_rgba(10,26,56,0.35)]">
                <Heart className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.45em] text-foreground/55">
                  APNA DOCTOR
                </p>
                <p className="font-display text-xl uppercase tracking-[0.35em] text-foreground">
                  Symptom Companion
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="rounded-full border border-white/60 bg-white/70 px-5 py-2 text-sm font-medium text-foreground/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
                Hello, {greetingInitials}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setTheme(theme === "light" ? "dark" : "light")}
                className="rounded-full border border-white/60 bg-white/70 px-4 py-2 text-foreground/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] dark:border-white/20 dark:bg-white/10"
                aria-label="Toggle theme"
              >
                {theme === "light" ? <Moon className="h-4 w-4" /> : <SunMedium className="h-4 w-4" />}
              </Button>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </Button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {tabs.map(({ id, label, description, Icon }) => {
              const active = activeTab === id;
              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setActiveTab(id)}
                  className={cn(
                    "lift-on-hover flex w-full items-center justify-between rounded-[1.75rem] border px-6 py-5 text-left transition-all duration-300",
                    active
                      ? "border-transparent bg-gradient-to-r from-primary/12 to-secondary/12 shadow-[0_25px_60px_rgba(15,23,42,0.18)]"
                      : "border-white/60 bg-white/65 text-foreground/70 shadow-[0_15px_45px_rgba(15,23,42,0.08)] dark:border-white/15 dark:bg-white/10",
                  )}
                >
                  <div className="flex items-center gap-4">
                    <span
                      className={cn(
                        "flex h-12 w-12 items-center justify-center rounded-2xl border border-white/60 bg-white/80 text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] dark:border-white/15 dark:bg-white/10",
                        active && "bg-gradient-to-br from-primary/85 to-secondary/80 text-white",
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="font-display text-lg text-foreground">{label}</p>
                      <p className="text-xs uppercase tracking-[0.35em] text-foreground/60">{description}</p>
                    </div>
                  </div>
                  <div
                    className={cn(
                      "h-2 w-2 rounded-full transition-colors",
                      active ? "bg-primary" : "bg-foreground/25",
                    )}
                  />
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-6xl px-4 py-12">
        <div className="space-y-8">
          <UserProfileCard profile={profile} onProfileChange={setProfile} />
          <div className="rounded-[2.75rem] border border-white/60 bg-white/85 p-10 shadow-[0_35px_120px_rgba(12,23,44,0.18)] backdrop-blur-3xl dark:border-white/15 dark:bg-white/10">
          {!hasConsent ? (
            <ConsentForm onConsentGiven={() => setHasConsent(true)} />
          ) : (
            <div className="animate-fade-up">
              {activeTab === "new" ? <SymptomForm /> : <SessionHistory />}
            </div>
          )}
          </div>
        </div>
      </main>

      <footer className="relative z-10 border-t border-white/50 bg-white/70 py-8 text-center backdrop-blur-2xl dark:border-white/15 dark:bg-white/10">
        <div className="mx-auto max-w-4xl text-sm text-foreground/70">
          <p className="font-display text-destructive">⚠️ IMPORTANT DISCLAIMER</p>
          <p className="mt-2">
            This interface is an educational demonstration. It does not provide medical advice. For urgent needs,
            contact licensed healthcare professionals immediately.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Dashboard;