import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlayCircle, HelpCircle, CheckCircle2, Trophy, MapPin, Search, Settings } from "lucide-react";
import { getThumbnail } from "@/lib/video-utils";

export const Route = createFileRoute("/_authenticated/leren/")({
  head: () => ({ meta: [{ title: "Leren & Certificering — HSE & Kwaliteit" }] }),
  component: LerenPage,
});

function LerenPage() {
  const { user, hasRole } = useAuth();
  const [tab, setTab] = useState("videos");
  const [search, setSearch] = useState("");
  const [werfFilter, setWerfFilter] = useState<string>("all");

  const { data: werven = [] } = useQuery({
    queryKey: ["werven"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("werven").select("*").eq("is_active", true).order("name");
      return data ?? [];
    },
  });

  const { data: videos = [] } = useQuery({
    queryKey: ["training_videos"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("training_videos")
        .select("*, werf:werven(id,name)")
        .eq("is_published", true)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: quizzes = [] } = useQuery({
    queryKey: ["quizzes"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("quizzes")
        .select("*, werf:werven(id,name)")
        .eq("is_published", true)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: views = [] } = useQuery({
    queryKey: ["video_views", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await (supabase as any).from("video_views").select("*").eq("user_id", user!.id);
      return data ?? [];
    },
  });

  const { data: attempts = [] } = useQuery({
    queryKey: ["quiz_attempts", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await (supabase as any).from("quiz_attempts").select("*").eq("user_id", user!.id);
      return data ?? [];
    },
  });

  const { data: leaderboard = [] } = useQuery({
    queryKey: ["leaderboard"],
    queryFn: async () => {
      const { data } = await (supabase as any).rpc("get_leaderboard", { _limit: 25 });
      return data ?? [];
    },
  });

  const viewedIds = new Set(views.filter((v: any) => v.completed).map((v: any) => v.video_id));
  const passedIds = new Set(attempts.filter((a: any) => a.passed).map((a: any) => a.quiz_id));

  const filterFn = (items: any[]) =>
    items.filter(
      (i) =>
        (werfFilter === "all" || i.werf_id === werfFilter) &&
        (search === "" || i.title?.toLowerCase().includes(search.toLowerCase())),
    );

  const filteredVideos = filterFn(videos);
  const filteredQuizzes = filterFn(quizzes);

  const myPoints =
    views.reduce((s: number, v: any) => s + (v.points_awarded ?? 0), 0) +
    Object.values(
      attempts
        .filter((a: any) => a.passed)
        .reduce((acc: Record<string, number>, a: any) => {
          acc[a.quiz_id] = Math.max(acc[a.quiz_id] ?? 0, a.points_awarded ?? 0);
          return acc;
        }, {}),
    ).reduce((s: number, n: any) => s + n, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Leren & Certificering</h1>
          <p className="text-sm text-muted-foreground">Instructievideo's, quizzen per werf en klassement.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-accent/40 border">
            <Trophy className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">{myPoints} punten</span>
          </div>
          {hasRole("admin") && (
            <Button asChild variant="outline" size="sm">
              <Link to="/leren/beheer">
                <Settings className="w-4 h-4" /> Beheer
              </Link>
            </Button>
          )}
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="videos">Video's</TabsTrigger>
          <TabsTrigger value="quizzes">Quizzen</TabsTrigger>
          <TabsTrigger value="leaderboard">Klassement</TabsTrigger>
        </TabsList>

        {tab !== "leaderboard" && (
          <div className="flex items-center gap-2 mt-4 flex-wrap">
            <div className="relative flex-1 min-w-[220px] max-w-md">
              <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Zoeken op titel…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={werfFilter} onValueChange={setWerfFilter}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Alle werven" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle werven</SelectItem>
                {werven.map((w: any) => (
                  <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <TabsContent value="videos" className="mt-4">
          {filteredVideos.length === 0 ? (
            <EmptyState icon={<PlayCircle className="w-8 h-8" />} label="Nog geen video's beschikbaar." />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredVideos.map((v: any) => {
                const thumb = getThumbnail(v.provider, v.external_id);
                const done = viewedIds.has(v.id);
                return (
                  <Link key={v.id} to="/leren/video/$id" params={{ id: v.id }}>
                    <Card className="overflow-hidden hover:shadow-md transition-shadow h-full">
                      <div className="aspect-video bg-muted relative flex items-center justify-center">
                        {thumb ? (
                          <img src={thumb} alt={v.title} className="w-full h-full object-cover" />
                        ) : (
                          <PlayCircle className="w-12 h-12 text-muted-foreground" />
                        )}
                        {done && (
                          <div className="absolute top-2 right-2 bg-green-600 text-white rounded-full p-1">
                            <CheckCircle2 className="w-4 h-4" />
                          </div>
                        )}
                      </div>
                      <CardContent className="p-4 space-y-2">
                        <div className="font-medium line-clamp-2">{v.title}</div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {v.werf && (
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="w-3 h-3" /> {v.werf.name}
                            </span>
                          )}
                          <Badge variant="outline" className="ml-auto">+{v.points} pt</Badge>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="quizzes" className="mt-4">
          {filteredQuizzes.length === 0 ? (
            <EmptyState icon={<HelpCircle className="w-8 h-8" />} label="Nog geen quizzen beschikbaar." />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredQuizzes.map((q: any) => {
                const done = passedIds.has(q.id);
                return (
                  <Link key={q.id} to="/leren/quiz/$id" params={{ id: q.id }}>
                    <Card className="hover:shadow-md transition-shadow h-full">
                      <CardHeader>
                        <div className="flex items-start justify-between gap-2">
                          <CardTitle className="text-base">{q.title}</CardTitle>
                          {done && <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {q.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2">{q.description}</p>
                        )}
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {q.werf && (
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="w-3 h-3" /> {q.werf.name}
                            </span>
                          )}
                          <Badge variant="outline" className="ml-auto">+{q.points} pt</Badge>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="leaderboard" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-primary" /> Top 25
              </CardTitle>
            </CardHeader>
            <CardContent>
              {leaderboard.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nog geen scores.</p>
              ) : (
                <div className="space-y-1">
                  {leaderboard.map((row: any, i: number) => (
                    <div
                      key={row.user_id}
                      className={`flex items-center gap-3 p-3 rounded-md ${
                        row.user_id === user?.id ? "bg-accent/40 border" : "hover:bg-muted/50"
                      }`}
                    >
                      <div className="w-8 text-center font-semibold text-muted-foreground">{i + 1}</div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{row.full_name ?? row.email}</div>
                        <div className="text-xs text-muted-foreground">
                          {row.videos_completed} video's · {row.quizzes_passed} quizzen
                        </div>
                      </div>
                      <div className="font-semibold">{row.total_points} pt</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function EmptyState({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="border rounded-lg py-12 text-center text-muted-foreground flex flex-col items-center gap-2">
      {icon}
      <div className="text-sm">{label}</div>
    </div>
  );
}
