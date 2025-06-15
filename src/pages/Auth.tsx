
import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/use-toast";
import { useNavigate } from "react-router-dom";
import AuthGraphic from "@/components/AuthGraphic";
import Logo from "@/components/Logo";
import AuthPageContent from "@/components/AuthPageContent";

const AuthPage: React.FC = () => {
  // Only login allowed now, remove signup support
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
      // If an authenticated session exists, send the user to dashboard
      navigate("/admin/dashboard", { replace: true });
    }
  }, [session, navigate]);

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: form.email,
      password: form.password,
    });
    if (error) setError(error.message);
    else toast({ title: "Login successful!" });
    setLoading(false);
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
                Sign in
              </h1>
              <p className="text-muted-foreground text-base">
                Enterprise Portal Login
              </p>
            </div>
            {/* Removed: Social login buttons */}
            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t"></span>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="bg-card px-2 text-muted-foreground">
                  Sign in with email
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
                autoComplete="current-password"
                disabled={loading}
              />
              <Button type="submit" disabled={loading} className="w-full font-semibold">
                {loading ? "Processing..." : "Sign in"}
              </Button>
              {/* New demo login instruction */}
              <div className="mt-2 text-xs text-muted-foreground text-center">
                Use demo login <span className="font-semibold">ss@sumits.me / Sumit1209!</span> to explore the system features.
              </div>
              {error && <div className="text-sm text-destructive">{error}</div>}
            </form>
            {/* Removed: Sign-up line and link */}
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
