import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { ArrowLeft, CheckCircle2, XCircle, Trophy, MapPin } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/leren/quiz/$id")({
  head: () => ({ meta: [{ title: "Quiz — Leren" }] }),
  component: QuizPage,
});

interface Option { id: string; text: string; is_correct: boolean }
interface Question { id: string; question: string; explanation: string | null; options: Option[] }

function QuizPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState<null | {
    score: number; correct: number; total: number; passed: boolean; points: number;
  }>(null);

  const { data: quiz } = useQuery({
    queryKey: ["quiz", id],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("quizzes").select("*, werf:werven(id,name)")
        .eq("id", id).maybeSingle();
      return data;
    },
  });
  const { data: questions = [] } = useQuery({
    queryKey: ["quiz_questions", id],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("quiz_questions").select("*")
        .eq("quiz_id", id).order("order_index");
      return (data ?? []) as Question[];
    },
  });
  const { data: bestAttempt } = useQuery({
    queryKey: ["quiz_best", id, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("quiz_attempts").select("*")
        .eq("quiz_id", id).eq("user_id", user!.id)
        .order("score", { ascending: false }).limit(1).maybeSingle();
      return data;
    },
  });

  const allAnswered = questions.length > 0 && questions.every((q) => answers[q.id]);

  const submit = async () => {
    if (!user || !quiz || !allAnswered) return;
    let correct = 0;
    const answerLog = questions.map((q) => {
      const chosen = answers[q.id];
      const opt = q.options.find((o) => o.id === chosen);
      const ok = !!opt?.is_correct;
      if (ok) correct++;
      return { question_id: q.id, chosen_option_id: chosen, correct: ok };
    });
    const score = Math.round((correct / questions.length) * 100);
    const passed = score >= (quiz.pass_score ?? 70);
    const perfect = correct === questions.length;
    const points = passed ? quiz.points + (perfect ? quiz.bonus_points_perfect : 0) : 0;

    const { error } = await (supabase as any).from("quiz_attempts").insert({
      quiz_id: id, user_id: user.id, score, total_questions: questions.length,
      correct_count: correct, passed, points_awarded: points, answers: answerLog,
    });
    if (error) { toast.error("Kon poging niet opslaan"); return; }
    setSubmitted({ score, correct, total: questions.length, passed, points });
    if (passed) toast.success(`Geslaagd! +${points} punten`);
    else toast.error(`Score ${score}% — minimum ${quiz.pass_score}%`);
    qc.invalidateQueries({ queryKey: ["quiz_attempts", user.id] });
    qc.invalidateQueries({ queryKey: ["quiz_best", id, user.id] });
    qc.invalidateQueries({ queryKey: ["leaderboard"] });
  };

  const reset = () => { setAnswers({}); setSubmitted(null); };

  const detail = useMemo(() => submitted && questions.map((q) => {
    const chosen = answers[q.id];
    const correctOpt = q.options.find((o) => o.is_correct);
    const chosenOpt = q.options.find((o) => o.id === chosen);
    return { q, chosen: chosenOpt, correct: correctOpt, ok: !!chosenOpt?.is_correct };
  }), [submitted, questions, answers]);

  if (!quiz) return <div className="p-8">Quiz niet gevonden.</div>;

  return (
    <div className="space-y-4 max-w-3xl">
      <Button asChild variant="ghost" size="sm">
        <Link to="/leren"><ArrowLeft className="w-4 h-4" /> Terug</Link>
      </Button>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <CardTitle>{quiz.title}</CardTitle>
              {quiz.description && <p className="text-sm text-muted-foreground mt-1">{quiz.description}</p>}
            </div>
            <div className="flex items-center gap-2">
              {quiz.werf && <Badge variant="outline" className="gap-1"><MapPin className="w-3 h-3" />{quiz.werf.name}</Badge>}
              <Badge variant="outline">Slagen ≥ {quiz.pass_score}%</Badge>
              <Badge variant="outline">+{quiz.points} pt</Badge>
            </div>
          </div>
          {bestAttempt && (
            <p className="text-xs text-muted-foreground mt-2">
              Beste score tot nu: <b>{bestAttempt.score}%</b> — {bestAttempt.passed ? "geslaagd" : "niet geslaagd"}
            </p>
          )}
        </CardHeader>
      </Card>

      {!submitted && (
        <div className="space-y-4">
          {questions.map((q, idx) => (
            <Card key={q.id}>
              <CardContent className="p-5 space-y-3">
                <div className="font-medium">{idx + 1}. {q.question}</div>
                <RadioGroup value={answers[q.id] ?? ""} onValueChange={(v) => setAnswers((s) => ({ ...s, [q.id]: v }))}>
                  {q.options.map((o) => (
                    <div key={o.id} className="flex items-center gap-2">
                      <RadioGroupItem id={`${q.id}-${o.id}`} value={o.id} />
                      <Label htmlFor={`${q.id}-${o.id}`} className="cursor-pointer">{o.text}</Label>
                    </div>
                  ))}
                </RadioGroup>
              </CardContent>
            </Card>
          ))}
          {questions.length === 0 ? (
            <p className="text-sm text-muted-foreground">Deze quiz heeft nog geen vragen.</p>
          ) : (
            <Button onClick={submit} disabled={!allAnswered}>Indienen</Button>
          )}
        </div>
      )}

      {submitted && detail && (
        <div className="space-y-4">
          <Card>
            <CardContent className="p-6 flex items-center gap-4">
              {submitted.passed ? (
                <Trophy className="w-10 h-10 text-primary" />
              ) : (
                <XCircle className="w-10 h-10 text-destructive" />
              )}
              <div className="flex-1">
                <div className="text-lg font-semibold">
                  {submitted.passed ? "Geslaagd!" : "Niet geslaagd"}
                </div>
                <div className="text-sm text-muted-foreground">
                  {submitted.correct}/{submitted.total} juist · Score {submitted.score}%
                  {submitted.passed && ` · +${submitted.points} punten`}
                </div>
              </div>
              <Button variant="outline" onClick={reset}>Opnieuw proberen</Button>
              <Button onClick={() => navigate({ to: "/leren" })}>Terug naar overzicht</Button>
            </CardContent>
          </Card>
          {detail.map((d, idx) => (
            <Card key={d.q.id}>
              <CardContent className="p-5 space-y-2">
                <div className="flex items-start gap-2">
                  {d.ok ? <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" /> : <XCircle className="w-5 h-5 text-destructive mt-0.5" />}
                  <div className="flex-1">
                    <div className="font-medium">{idx + 1}. {d.q.question}</div>
                    <div className="text-sm mt-1">
                      Jouw antwoord: <span className={d.ok ? "text-green-700" : "text-destructive"}>{d.chosen?.text ?? "—"}</span>
                    </div>
                    {!d.ok && d.correct && (
                      <div className="text-sm">Juiste antwoord: <span className="text-green-700">{d.correct.text}</span></div>
                    )}
                    {d.q.explanation && <div className="text-xs text-muted-foreground mt-1">{d.q.explanation}</div>}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
