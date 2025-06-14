
import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/use-toast";
import { useNavigate } from "react-router-dom";
import AuthGraphic from "@/components/AuthGraphic";
import Logo from "@/components/Logo";
import AuthPageContent from "@/components/AuthPageContent";

type AuthView = "login" | "signup";

const AuthPage: React.FC = () => {
  const [authView, setAuthView] = useState<AuthView>("login");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    return () => { listener.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (session) {
      navigate("/");
    }
  }, [session, navigate]);

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    if (authView === "login") {
      const { error } = await supabase.auth.signInWithPassword({
        email: form.email,
        password: form.password,
      });
      if (error) setError(error.message);
      else toast({ title: "Login successful!" });
    } else {
      const redirectUrl = `${window.location.origin}/`;
      const { error } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: { emailRedirectTo: redirectUrl }
      });
      if (error) setError(error.message);
      else toast({ title: "Check your email to confirm registration!" });
    }
    setLoading(false);
  };

  // Placeholder functions for SSO
  const handleSocialLogin = (provider: "google" | "azure") => {
    toast({ title: `SSO with ${provider.charAt(0).toUpperCase() + provider.slice(1)} will be available when configured.` });
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Logo at the top left, always visible */}
      <div className="fixed left-0 top-0 w-full md:static md:w-auto z-20 bg-background bg-opacity-90">
        <Logo />
      </div>
      <div className="flex flex-1 flex-col md:flex-row items-stretch mt-20 md:mt-0">
        {/* Left Graphic/Branding */}
        <div className="hidden md:flex w-1/2 bg-card">
          <AuthGraphic />
        </div>
        {/* Center Content Section */}
        <div className="hidden md:flex flex-col items-center justify-center w-0 flex-grow bg-background">
          <AuthPageContent />
        </div>
        {/* Right Form */}
        <div className="flex w-full md:w-1/2 items-center justify-center px-4 py-12 bg-background">
          <div className="w-full max-w-md bg-card p-8 rounded-xl shadow-md animate-fade-in">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-extrabold tracking-tight mb-1">
                {authView === "login" ? "Sign in" : "Create your account"}
              </h1>
              <p className="text-muted-foreground text-base">
                Enterprise Portal Login
              </p>
            </div>
            <div className="flex flex-col gap-3 mb-6">
              <Button
                variant="outline"
                className="w-full flex items-center gap-2 py-2"
                disabled
                onClick={() => handleSocialLogin("google")}
              >
                <svg className="w-5 h-5" viewBox="0 0 48 48"><g><circle fill="#fff" cx="24" cy="24" r="24"/><path fill="#4285F4" d="M35.28 24.327c0-.72-.064-1.44-.192-2.132h-11.08v4.068h6.3c-.272 1.464-1.13 2.704-2.398 3.54v2.914h3.868c2.272-2.09 3.5-5.166 3.5-8.39z"/><path fill="#34A853" d="M24 36c2.97 0 5.456-.98 7.264-2.674l-3.868-2.913c-1.074.72-2.45 1.145-3.396 1.145-2.608 0-4.814-1.763-5.6-4.122h-4.04v2.977A11.998 11.998 0 0024 36z"/><path fill="#FBBC05" d="M18.4 27.436a6.961 6.961 0 010-4.472v-2.977h-4.04A12.002 12.002 0 0012 24c0 1.993.49 3.875 1.36 5.458l5.04-2.022z"/><path fill="#EA4335" d="M24 16.5c1.62 0 3.078.56 4.224 1.66l3.168-3.168C29.452 12.966 27.03 12 24 12a11.998 11.998 0 00-10.64 6.414l5.04 2.978C19.186 17.867 21.392 16.5 24 16.5z"/></g></svg>
                Sign in with Google
              </Button>
              <Button
                variant="outline"
                className="w-full flex items-center gap-2 py-2"
                disabled
                onClick={() => handleSocialLogin("azure")}
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="#0078D4" d="M2 22l9.996-20L22 22h-7.505l-2.5-5.07L8.5 22zm9.996-18.157L19.204 20h-3.452l-2.756-5.59L6.25 20H4.797zM8.783 18.5h6.434l-3.217-6.522z"/></svg>
                Sign in with Microsoft
              </Button>
            </div>
            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t"></span>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="bg-card px-2 text-muted-foreground">
                  or continue with email
                </span>
              </div>
            </div>
            <form className="space-y-4" onSubmit={onSubmit}>
              <Input
                type="email"
                name="email"
                placeholder="Email address"
                required
                value={form.email}
                onChange={handleInput}
                autoComplete="username"
                disabled={loading}
              />
              <Input
                type="password"
                name="password"
                placeholder="Password"
                required
                value={form.password}
                onChange={handleInput}
                autoComplete={authView === "login" ? "current-password" : "new-password"}
                disabled={loading}
              />
              <Button type="submit" disabled={loading} className="w-full font-semibold">
                {loading ? "Processing..." : authView === "login" ? "Sign in" : "Sign up"}
              </Button>
              {error && <div className="text-sm text-destructive">{error}</div>}
            </form>
            <div className="flex flex-col gap-2 mt-6 text-muted-foreground text-sm text-center">
              {authView === "login" ? (
                <span>
                  New to the portal?
                  <Button variant="link" size="sm" onClick={() => setAuthView("signup")} className="p-0 pl-2 h-auto align-baseline font-semibold">Sign up</Button>
                </span>
              ) : (
                <span>
                  Already have an account?
                  <Button variant="link" size="sm" onClick={() => setAuthView("login")} className="p-0 pl-2 h-auto align-baseline font-semibold">Sign in</Button>
                </span>
              )}
            </div>
            <div className="mt-8 text-xs text-center text-muted-foreground">
              &copy; {new Date().getFullYear()} Your Company. All rights reserved.
            </div>
          </div>
        </div>
      </div>
      {/* Mobile: extra content below the form */}
      <div className="md:hidden block">
        <AuthPageContent />
      </div>
    </div>
  );
};

export default AuthPage;
