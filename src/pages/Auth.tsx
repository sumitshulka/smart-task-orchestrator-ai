
import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/use-toast";
import { useNavigate } from "react-router-dom";

type AuthView = "login" | "signup";

const AuthPage: React.FC = () => {
  const [authView, setAuthView] = useState<AuthView>("login");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  // We store session state locally
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

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md bg-card p-8 rounded-xl shadow">
        <h1 className="text-2xl font-bold mb-6 text-center">
          {authView === "login" ? "Sign in" : "Sign up"}
        </h1>
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
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Processing..." : authView === "login" ? "Sign in" : "Sign up"}
          </Button>
          {error && <div className="text-sm text-destructive">{error}</div>}
        </form>
        <div className="flex flex-col gap-2 mt-4 text-muted-foreground text-sm text-center">
          {authView === "login" ? (
            <>
              <span>
                New to the app?
                <Button variant="link" size="sm" onClick={() => setAuthView("signup")} className="p-0 pl-2 h-auto align-baseline">Sign up</Button>
              </span>
            </>
          ) : (
            <>
              <span>
                Already have an account?
                <Button variant="link" size="sm" onClick={() => setAuthView("login")} className="p-0 pl-2 h-auto align-baseline">Sign in</Button>
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
