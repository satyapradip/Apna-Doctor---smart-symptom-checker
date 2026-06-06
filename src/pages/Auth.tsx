import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Heart, Mail, Lock, User, ArrowLeft } from "lucide-react";
import { z } from "zod";

const authSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  fullName: z.string().min(2, "Full name must be at least 2 characters").optional(),
});

type Mode = "login" | "signup" | "forgot";

const Auth = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("login");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    fullName: "",
  });

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === "forgot") {
        // ── Forgot Password ──────────────────────────────────────
        const emailParsed = z.string().email("Please enter a valid email address").safeParse(formData.email);
        if (!emailParsed.success) {
          toast.error(emailParsed.error.errors[0].message);
          setLoading(false);
          return;
        }
        const { error } = await supabase.auth.resetPasswordForEmail(formData.email, {
          redirectTo: `${window.location.origin}/auth`,
        });
        if (error) {
          toast.error(error.message);
        } else {
          toast.success("Password reset email sent! Check your inbox.");
          setMode("login");
        }
        return;
      }

      const validatedData = authSchema.parse({
        email: formData.email,
        password: formData.password,
        fullName: mode === "signup" ? formData.fullName : undefined,
      });

      if (mode === "login") {
        // ── Sign In ───────────────────────────────────────────────
        const { error } = await supabase.auth.signInWithPassword({
          email: validatedData.email,
          password: validatedData.password,
        });

        if (error) {
          if (error.message.includes("Invalid login credentials") || error.message.includes("invalid_credentials")) {
            toast.error("Incorrect email or password. Please try again.");
          } else if (error.message.includes("Email not confirmed")) {
            toast.error("Please verify your email before logging in. Check your inbox.");
          } else {
            toast.error(error.message);
          }
        } else {
          toast.success("Welcome back! 🎉");
          navigate("/dashboard");
        }
      } else {
        // ── Sign Up ───────────────────────────────────────────────
        const { data, error } = await supabase.auth.signUp({
          email: validatedData.email,
          password: validatedData.password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: {
              full_name: validatedData.fullName,
            },
          },
        });

        if (error) {
          if (error.message.includes("User already registered") || error.message.includes("already_registered")) {
            toast.error("An account with this email already exists. Try signing in.");
          } else {
            toast.error(error.message);
          }
        } else if (data.session) {
          // Auto-confirmed (email confirmation disabled in Supabase)
          toast.success("Account created! Welcome to Apna Doctor 🩺");
          navigate("/dashboard");
        } else {
          toast.success("Account created! Please check your email to confirm your account.");
        }
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error("An unexpected error occurred. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
        },
      });
      if (error) {
        toast.error("Google sign-in failed: " + error.message);
      }
      // On success, Supabase redirects the user — no manual navigate needed
    } catch {
      toast.error("Google sign-in is not configured. Please use email/password.");
    } finally {
      setGoogleLoading(false);
    }
  };

  const title = mode === "login" ? "Welcome Back" : mode === "signup" ? "Create Account" : "Reset Password";
  const description =
    mode === "login"
      ? "Sign in to access your personal health assistant"
      : mode === "signup"
      ? "Join Apna Doctor for AI-powered health guidance"
      : "Enter your email to receive a password reset link";

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/5 p-4 relative overflow-hidden">
      {/* Ambient background blobs */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 top-20 h-72 w-72 rounded-full bg-gradient-to-br from-primary/25 to-accent/20 blur-[120px] animate-floaty" />
        <div className="absolute -right-24 bottom-20 h-72 w-72 rounded-full bg-gradient-to-br from-secondary/25 to-primary/15 blur-[120px] animate-floaty" style={{ animationDelay: "-3s" }} />
      </div>

      <Card className="w-full max-w-md relative z-10 border border-white/40 bg-white/80 backdrop-blur-2xl shadow-[0_35px_120px_rgba(15,23,42,0.18)] dark:bg-white/10 dark:border-white/15">
        <CardHeader className="space-y-1 text-center pb-2">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-gradient-to-br from-primary/20 to-secondary/20 rounded-2xl flex items-center justify-center shadow-[0_8px_32px_rgba(10,26,56,0.2)]">
              <Heart className="w-8 h-8 text-primary" />
            </div>
          </div>
          <p className="text-xs uppercase tracking-[0.4em] text-foreground/50">Apna Doctor</p>
          <CardTitle className="text-2xl font-bold">{title}</CardTitle>
          <CardDescription className="text-foreground/60">{description}</CardDescription>
        </CardHeader>

        <CardContent className="space-y-5 pt-4">
          {/* Google Sign-In Button */}
          {mode !== "forgot" && (
            <>
              <Button
                type="button"
                variant="outline"
                className="w-full gap-3 border-border/60 bg-white/70 hover:bg-white/90 dark:bg-white/10 dark:hover:bg-white/15 transition-all"
                onClick={handleGoogleSignIn}
                disabled={googleLoading || loading}
                id="google-signin-btn"
              >
                {googleLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      fill="#EA4335"
                    />
                  </svg>
                )}
                Continue with Google
              </Button>

              <div className="relative flex items-center gap-3">
                <div className="flex-1 h-px bg-border/60" />
                <span className="text-xs text-foreground/40 uppercase tracking-widest">or</span>
                <div className="flex-1 h-px bg-border/60" />
              </div>
            </>
          )}

          {/* Email/Password Form */}
          <form onSubmit={handleAuth} className="space-y-4">
            {mode === "signup" && (
              <div className="space-y-2">
                <Label htmlFor="fullName" className="text-sm font-medium">Full Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/40" />
                  <Input
                    id="fullName"
                    placeholder="Your full name"
                    className="pl-10"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    required={mode === "signup"}
                    autoComplete="name"
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/40" />
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  className="pl-10"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            {mode !== "forgot" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                  {mode === "login" && (
                    <button
                      type="button"
                      onClick={() => setMode("forgot")}
                      className="text-xs text-primary hover:underline"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/40" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    className="pl-10"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                    autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  />
                </div>
                {mode === "signup" && (
                  <p className="text-xs text-foreground/50">Minimum 6 characters</p>
                )}
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={loading || googleLoading}
              id="auth-submit-btn"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Please wait...
                </>
              ) : mode === "login" ? (
                "Sign In"
              ) : mode === "signup" ? (
                "Create Account"
              ) : (
                "Send Reset Link"
              )}
            </Button>
          </form>

          {/* Footer Links */}
          <div className="text-center space-y-2">
            {mode === "forgot" ? (
              <button
                type="button"
                onClick={() => setMode("login")}
                className="flex items-center gap-1 text-sm text-primary hover:underline mx-auto"
              >
                <ArrowLeft className="h-3 w-3" />
                Back to Sign In
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setMode(mode === "login" ? "signup" : "login")}
                className="text-sm text-foreground/60 hover:text-foreground transition-colors"
              >
                {mode === "login" ? (
                  <>Don&apos;t have an account? <span className="text-primary font-medium hover:underline">Sign up</span></>
                ) : (
                  <>Already have an account? <span className="text-primary font-medium hover:underline">Sign in</span></>
                )}
              </button>
            )}
          </div>

          <p className="text-center text-xs text-foreground/40 pt-2">
            By continuing, you agree to our educational use disclaimer.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;