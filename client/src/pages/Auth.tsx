
import React, { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/use-toast";
import { useNavigate } from "react-router-dom";
import { ClipboardList, Users2, ShieldCheck } from "lucide-react";
import Logo from "@/components/Logo";
import SuperAdminRegistration from "@/components/SuperAdminRegistration";

const AuthPage: React.FC = () => {
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [systemHasUsers, setSystemHasUsers] = useState<boolean | null>(null);
  const [checkingSystem, setCheckingSystem] = useState(true);
  const navigate = useNavigate();
  const { user, login, loading, checkSystemStatus } = useAuth();

  useEffect(() => {
    if (user) {
      // If user is already logged in, redirect to home (which will handle role-based routing)
      navigate("/", { replace: true });
    }
  }, [user, navigate]);

  useEffect(() => {
    // Check if system has any users
    const checkSystem = async () => {
      try {
        const status = await checkSystemStatus();
        setSystemHasUsers(status.hasUsers);
      } catch (error) {
        console.error('Failed to check system status:', error);
        // Default to showing login if check fails
        setSystemHasUsers(true);
      } finally {
        setCheckingSystem(false);
      }
    };

    checkSystem();
  }, [checkSystemStatus]);

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      // Try internal user login first
      await login(form.email, form.password);
      toast({ title: "Login successful!" });
      // Navigation will happen automatically via useEffect when user state changes
    } catch {
      // Internal login failed — try portal (client contact) login as fallback
      try {
        const portalRes = await fetch("/api/portal/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ email: form.email.trim(), password: form.password }),
        });
        if (portalRes.ok) {
          // Client contact successfully authenticated — send to portal
          navigate("/portal/dashboard");
          return;
        }
        // Both failed — show a generic error
        throw new Error("Invalid credentials");
      } catch {
        const msg = "Invalid credentials. Please check your email and password.";
        setError(msg);
        toast({ title: "Login failed", description: msg, variant: "destructive" });
      }
    }
  };

  // Show loading spinner while checking system status
  if (checkingSystem) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-lg">Initializing system...</p>
        </div>
      </div>
    );
  }

  // Show registration page if no users exist
  if (systemHasUsers === false) {
    return <SuperAdminRegistration />;
  }

  // Show login page if users exist
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-400/5 rounded-full blur-3xl animate-ping"></div>
      </div>
      
      <div className="relative z-10 min-h-screen flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-6xl mx-auto grid lg:grid-cols-2 gap-8 items-center">
          
          {/* Left Side - Branding & Features */}
          <div className="hidden lg:block space-y-8 text-white">
            <div className="space-y-6">
              <div className="flex items-center space-x-3">
                <Logo />
                <span className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                  TaskRep
                </span>
              </div>
              <div className="space-y-4">
                <h1 className="text-5xl font-bold leading-tight">
                  Smart Task
                  <span className="block bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                    Management
                  </span>
                </h1>
                <p className="text-xl text-slate-300 leading-relaxed max-w-lg">
                  Streamline your workflow with intelligent task organization, team collaboration, and real-time progress tracking.
                </p>
              </div>
            </div>

            {/* Feature highlights */}
            <div className="grid grid-cols-1 gap-6 max-w-lg">
              <div className="flex items-start space-x-4 group">
                <div className="flex-shrink-0 w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center group-hover:bg-blue-500/30 transition-colors">
                  <ClipboardList className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-white mb-1">Intelligent Organization</h3>
                  <p className="text-slate-400 text-sm">AI-powered task prioritization and smart categorization</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-4 group">
                <div className="flex-shrink-0 w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center group-hover:bg-purple-500/30 transition-colors">
                  <Users2 className="w-6 h-6 text-purple-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-white mb-1">Team Collaboration</h3>
                  <p className="text-slate-400 text-sm">Real-time updates and seamless team communication</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-4 group">
                <div className="flex-shrink-0 w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center group-hover:bg-green-500/30 transition-colors">
                  <ShieldCheck className="w-6 h-6 text-green-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-white mb-1">Enterprise Security</h3>
                  <p className="text-slate-400 text-sm">Bank-grade encryption and compliance standards</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Side - Login Form */}
          <div className="flex items-center justify-center">
            <div className="w-full max-w-md">
              {/* Glass morphism card */}
              <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-8 shadow-2xl">
                <div className="text-center mb-8">
                  <div className="lg:hidden flex justify-center mb-6">
                    <Logo />
                  </div>
                  <h2 className="text-3xl font-bold text-white mb-2">
                    Welcome Back
                  </h2>
                  <p className="text-slate-300">
                    Sign in to your account to continue
                  </p>
                </div>

                <form onSubmit={onSubmit} className="space-y-6">
                  <div className="space-y-4">
                    <div className="relative">
                      <Input
                        type="email"
                        name="email"
                        placeholder="Enter your email"
                        required
                        value={form.email}
                        onChange={handleInput}
                        autoComplete="username"
                        disabled={loading}
                        className="w-full h-12 bg-white/10 border-white/20 text-white placeholder:text-slate-300 focus:border-blue-400 focus:ring-blue-400/20 rounded-xl"
                      />
                    </div>
                    <div className="relative">
                      <Input
                        type="password"
                        name="password"
                        placeholder="Enter your password"
                        required
                        value={form.password}
                        onChange={handleInput}
                        autoComplete="current-password"
                        disabled={loading}
                        className="w-full h-12 bg-white/10 border-white/20 text-white placeholder:text-slate-300 focus:border-blue-400 focus:ring-blue-400/20 rounded-xl"
                      />
                    </div>
                  </div>

                  {error && (
                    <div className="bg-red-500/20 border border-red-500/30 rounded-xl p-3">
                      <p className="text-red-300 text-sm text-center">{error}</p>
                    </div>
                  )}

                  <Button 
                    type="submit" 
                    disabled={loading}
                    className="w-full h-12 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                  >
                    {loading ? (
                      <div className="flex items-center space-x-2">
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        <span>Signing in...</span>
                      </div>
                    ) : (
                      "Sign In"
                    )}
                  </Button>

                  {/* Demo login instruction */}
                  <div className="text-center">
                    <div className="bg-blue-500/20 border border-blue-500/30 rounded-xl p-3">
                      <p className="text-blue-200 text-sm font-medium mb-1">Demo Access</p>
                      <p className="text-blue-300 text-xs">
                        Email: <span className="font-mono">ss@sumits.me</span><br />
                        Password: <span className="font-mono">tempPassword123</span>
                      </p>
                    </div>
                  </div>
                </form>

                {/* Additional info */}
                <div className="mt-8 text-center space-y-3">
                  <p className="text-slate-400 text-sm">
                    Secured by enterprise-grade encryption
                  </p>
                  <div className="flex items-center justify-center space-x-2">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                    <span className="text-green-400 text-sm font-medium">System Online</span>
                  </div>
                  <div className="border-t border-white/10 pt-3">
                    <p className="text-slate-500 text-xs mb-1.5">External client access?</p>
                    <button
                      type="button"
                      onClick={() => navigate("/portal/login")}
                      className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors font-medium"
                    >
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Sign in to the Client Portal →
                    </button>
                  </div>
                  <div className="text-xs text-slate-500">
                    &copy; {new Date().getFullYear()} TaskRep. All rights reserved.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
