import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Aanmelden — HSE & Kwaliteitsplatform" },
      { name: "description", content: "Log in op het HSE- en kwaliteitsbeheerplatform." },
    ],
  }),
  component: AuthPage,
});

const emailSchema = z.string().trim().email({ message: "Ongeldig e-mailadres" }).max(255);
const passwordSchema = z.string().min(8, { message: "Wachtwoord moet minimaal 8 tekens hebben" }).max(72);
const nameSchema = z.string().trim().min(2, { message: "Naam is te kort" }).max(100);

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) navigate({ to: "/dashboard", replace: true });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  const handleGoogle = async () => {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("Aanmelden met Google mislukt");
      setLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const emailP = emailSchema.safeParse(fd.get("email"));
    const pwdP = passwordSchema.safeParse(fd.get("password"));
    if (!emailP.success) return toast.error(emailP.error.errors[0].message);
    if (!pwdP.success) return toast.error(pwdP.error.errors[0].message);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: emailP.data,
      password: pwdP.data,
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Aangemeld");
  };

  const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const nameP = nameSchema.safeParse(fd.get("name"));
    const emailP = emailSchema.safeParse(fd.get("email"));
    const pwdP = passwordSchema.safeParse(fd.get("password"));
    if (!nameP.success) return toast.error(nameP.error.errors[0].message);
    if (!emailP.success) return toast.error(emailP.error.errors[0].message);
    if (!pwdP.success) return toast.error(pwdP.error.errors[0].message);
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: emailP.data,
      password: pwdP.data,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: nameP.data },
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Account aangemaakt — je kan direct inloggen");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary text-primary-foreground mb-4">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">HSE & Kwaliteit</h1>
          <p className="text-sm text-muted-foreground mt-1">Beheerplatform voor procedures, meldingen en risico's</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Welkom</CardTitle>
            <CardDescription>Log in of maak een account aan om verder te gaan.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              type="button"
              variant="outline"
              className="w-full mb-4"
              onClick={handleGoogle}
              disabled={loading}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden>
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.1A6.85 6.85 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.07H2.18A10.98 10.98 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.83z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.83C6.71 7.31 9.14 5.38 12 5.38z"/>
              </svg>
              Doorgaan met Google
            </Button>
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">of e-mail</span>
              </div>
            </div>
            <Tabs defaultValue="signin">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Inloggen</TabsTrigger>
                <TabsTrigger value="signup">Registreren</TabsTrigger>
              </TabsList>
              <TabsContent value="signin">
                <form onSubmit={handleSignIn} className="space-y-3 mt-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="si-email">E-mail</Label>
                    <Input id="si-email" name="email" type="email" required autoComplete="email" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="si-pwd">Wachtwoord</Label>
                    <Input id="si-pwd" name="password" type="password" required autoComplete="current-password" />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>Inloggen</Button>
                </form>
              </TabsContent>
              <TabsContent value="signup">
                <form onSubmit={handleSignUp} className="space-y-3 mt-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="su-name">Volledige naam</Label>
                    <Input id="su-name" name="name" required autoComplete="name" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="su-email">E-mail</Label>
                    <Input id="su-email" name="email" type="email" required autoComplete="email" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="su-pwd">Wachtwoord</Label>
                    <Input id="su-pwd" name="password" type="password" required minLength={8} autoComplete="new-password" />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>Account aanmaken</Button>
                </form>
              </TabsContent>
            </Tabs>
            <p className="text-xs text-center text-muted-foreground mt-6">
              <Link to="/" className="hover:underline">← terug naar start</Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
