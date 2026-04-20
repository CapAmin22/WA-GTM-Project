import { useState, FormEvent } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Zap, Loader2, Mail, Lock, EyeOff, Eye, ArrowRight } from "lucide-react";
import { toast } from "sonner";

export default function LoginPage() {
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (isSignUp) {
      const { error } = await signUp(email, password);
      setLoading(false);
      
      if (error) {
         setError(error.message);
      } else {
         toast.success("Account created successfully!");
         navigate("/");
      }
    } else {
      const { error } = await signIn(email, password);
      setLoading(false);

      if (error) {
        setError(error.message);
      } else {
        toast.success("Welcome back!");
        navigate("/");
      }
    }
  };

  return (
    <div className="min-h-screen bg-background relative flex items-center justify-center overflow-hidden px-4">
      {/* Premium Background DECOR */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/20 rounded-full blur-[120px] opacity-60" />
        <div className="absolute bottom-1/4 right-1/4 w-[300px] h-[300px] bg-chart-4/10 rounded-full blur-[100px] opacity-40" />
      </div>

      <div className="z-10 w-full max-w-[420px]">
        <div className="flex flex-col items-center justify-center mb-8 space-y-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary glow-primary shadow-lg shadow-primary/20">
            <Zap className="h-8 w-8 text-primary-foreground fill-primary-foreground" />
          </div>
          <div className="text-center space-y-1">
            <h1 className="text-3xl font-bold tracking-tight">WA Automation</h1>
            <p className="text-sm text-muted-foreground">
              {isSignUp ? "Create a new workspace" : "Sign in to your dashboard"}
            </p>
          </div>
        </div>

        <Card className="glass-panel border-border/50 shadow-2xl backdrop-blur-xl bg-card/60">
          <CardHeader className="space-y-1 pb-6">
            <CardTitle className="text-2xl text-center font-semibold tracking-tight">
              {isSignUp ? "Create Account" : "Welcome Back"}
            </CardTitle>
            <CardDescription className="text-center">
              {isSignUp
                ? "Enter your details to create an account"
                : "Enter your email to login to your dashboard"}
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {error && (
                <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-sm text-center font-medium">
                  {error}
                </div>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@example.com"
                    className="pl-9 bg-background/50 border-border/50 focus-visible:ring-primary h-10 transition-colors"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Password</Label>
                  {!isSignUp && (
                    <a href="#" className="text-xs font-medium text-primary hover:underline transition-all">
                      Forgot password?
                    </a>
                  )}
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    className="pl-9 pr-9 bg-background/50 border-border/50 focus-visible:ring-primary h-10 transition-colors"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </CardContent>
            
            <CardFooter className="flex flex-col space-y-5 pb-8 pt-2">
              <Button type="submit" className="w-full h-11 text-sm font-semibold transition-all hover:shadow-md hover:shadow-primary/20" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {isSignUp ? "Creating account..." : "Signing in..."}
                  </>
                ) : (
                  <>
                    {isSignUp ? "Sign Up" : "Sign In"}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
              
              <div className="text-center text-sm text-muted-foreground pt-2 border-t border-border/50 w-full">
                <div className="pt-4">
                  {isSignUp ? "Already have an account? " : "Don't have an account? "}
                  <button
                    type="button"
                    onClick={() => {
                      setIsSignUp(!isSignUp);
                      setError("");
                    }}
                    className="font-semibold text-primary hover:underline hover:text-primary/80 transition-all"
                  >
                    {isSignUp ? "Sign in" : "Create one"}
                  </button>
                </div>
              </div>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
