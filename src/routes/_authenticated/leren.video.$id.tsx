import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, CheckCircle2, MapPin } from "lucide-react";
import { toast } from "sonner";
import { getEmbedUrl } from "@/lib/video-utils";

export const Route = createFileRoute("/_authenticated/leren/video/$id")({
  head: () => ({ meta: [{ title: "Video — Leren" }] }),
  component: VideoPage,
});

function VideoPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [completing, setCompleting] = useState(false);

  const { data: video } = useQuery({
    queryKey: ["training_video", id],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("training_videos")
        .select("*, werf:werven(id,name)")
        .eq("id", id)
        .maybeSingle();
      return data;
    },
  });

  const { data: view } = useQuery({
    queryKey: ["video_view", id, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("video_views")
        .select("*")
        .eq("video_id", id)
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  const alreadyDone = !!view?.completed;

  const markComplete = async () => {
    if (!user || !video || alreadyDone) return;
    setCompleting(true);
    const { error } = await (supabase as any).from("video_views").upsert(
      {
        video_id: id,
        user_id: user.id,
        completed: true,
        completed_at: new Date().toISOString(),
        points_awarded: video.points,
        progress_seconds: video.duration_seconds ?? 0,
      },
      { onConflict: "video_id,user_id" },
    );
    setCompleting(false);
    if (error) {
      toast.error("Kon voltooiing niet opslaan");
      return;
    }
    toast.success(`Video voltooid — +${video.points} punten`);
    qc.invalidateQueries({ queryKey: ["video_view", id, user.id] });
    qc.invalidateQueries({ queryKey: ["video_views", user.id] });
    qc.invalidateQueries({ queryKey: ["leaderboard"] });
  };

  // Auto-complete for YouTube when video ends (via postMessage). For other providers we rely on the button.
  const iframeRef = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    if (!video || video.provider !== "youtube") return;
    const onMsg = (e: MessageEvent) => {
      try {
        const data = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
        // YouTube state 0 = ended
        if (data?.event === "onStateChange" && data?.info === 0) {
          markComplete();
        }
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("message", onMsg);
    // Ask the player to send events
    const interval = setInterval(() => {
      iframeRef.current?.contentWindow?.postMessage(
        JSON.stringify({ event: "listening" }),
        "*",
      );
      iframeRef.current?.contentWindow?.postMessage(
        JSON.stringify({ event: "command", func: "addEventListener", args: ["onStateChange"] }),
        "*",
      );
    }, 1000);
    setTimeout(() => clearInterval(interval), 5000);
    return () => window.removeEventListener("message", onMsg);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [video?.id]);

  if (!video) return <div className="p-8">Video niet gevonden.</div>;

  const embedUrl = getEmbedUrl(video.provider, video.external_id, video.url);

  return (
    <div className="space-y-4 max-w-4xl">
      <Button asChild variant="ghost" size="sm">
        <Link to="/leren"><ArrowLeft className="w-4 h-4" /> Terug</Link>
      </Button>

      <Card>
        <div className="aspect-video bg-black">
          {video.provider === "url" ? (
            <video ref={undefined} controls className="w-full h-full" src={video.url} onEnded={markComplete} />
          ) : (
            <iframe
              ref={iframeRef}
              src={embedUrl}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              title={video.title}
            />
          )}
        </div>
        <CardContent className="p-6 space-y-3">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-xl font-semibold">{video.title}</h1>
              {video.description && <p className="text-sm text-muted-foreground mt-1">{video.description}</p>}
            </div>
            <div className="flex items-center gap-2">
              {video.werf && (
                <Badge variant="outline" className="gap-1">
                  <MapPin className="w-3 h-3" /> {video.werf.name}
                </Badge>
              )}
              <Badge variant="outline">+{video.points} pt</Badge>
            </div>
          </div>
          <div className="flex items-center gap-3 pt-2">
            {alreadyDone ? (
              <Badge className="bg-green-600 gap-1">
                <CheckCircle2 className="w-4 h-4" /> Voltooid
              </Badge>
            ) : (
              <Button onClick={markComplete} disabled={completing}>
                <CheckCircle2 className="w-4 h-4" /> Markeer als volledig bekeken
              </Button>
            )}
            <p className="text-xs text-muted-foreground">
              YouTube-video's markeren automatisch af bij einde. Andere bronnen: bevestig met de knop.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
