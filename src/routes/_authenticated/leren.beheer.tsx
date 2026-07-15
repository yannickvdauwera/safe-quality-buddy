import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Pencil, Video, HelpCircle, MapPin } from "lucide-react";
import { toast } from "sonner";
import { detectVideo } from "@/lib/video-utils";

export const Route = createFileRoute("/_authenticated/leren/beheer")({
  head: () => ({ meta: [{ title: "Beheer Leren — HSE" }] }),
  beforeLoad: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw redirect({ to: "/auth" });
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin");
    if (!data || data.length === 0) throw redirect({ to: "/leren" });
  },
  component: BeheerPage,
});

function BeheerPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Beheer — Leren & Certificering</h1>
        <p className="text-sm text-muted-foreground">Werven, video's en quizzen beheren.</p>
      </div>
      <Tabs defaultValue="werven">
        <TabsList>
          <TabsTrigger value="werven"><MapPin className="w-4 h-4" /> Werven</TabsTrigger>
          <TabsTrigger value="videos"><Video className="w-4 h-4" /> Video's</TabsTrigger>
          <TabsTrigger value="quizzes"><HelpCircle className="w-4 h-4" /> Quizzen</TabsTrigger>
        </TabsList>
        <TabsContent value="werven" className="mt-4"><WervenTab /></TabsContent>
        <TabsContent value="videos" className="mt-4"><VideosTab /></TabsContent>
        <TabsContent value="quizzes" className="mt-4"><QuizzesTab /></TabsContent>
      </Tabs>
    </div>
  );
}

/* -------- Werven -------- */
function WervenTab() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<any | null>(null);
  const [form, setForm] = useState({ name: "", code: "", address: "", description: "", is_active: true });

  const { data: werven = [] } = useQuery({
    queryKey: ["werven-all"],
    queryFn: async () => (await (supabase as any).from("werven").select("*").order("name")).data ?? [],
  });

  const openNew = () => { setEdit(null); setForm({ name: "", code: "", address: "", description: "", is_active: true }); setOpen(true); };
  const openEdit = (w: any) => {
    setEdit(w);
    setForm({ name: w.name, code: w.code ?? "", address: w.address ?? "", description: w.description ?? "", is_active: w.is_active });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) return toast.error("Naam is verplicht");
    if (edit) {
      const { error } = await (supabase as any).from("werven").update(form).eq("id", edit.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await (supabase as any).from("werven").insert(form);
      if (error) return toast.error(error.message);
    }
    toast.success("Opgeslagen");
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["werven-all"] });
    qc.invalidateQueries({ queryKey: ["werven"] });
  };
  const remove = async (id: string) => {
    if (!confirm("Werf verwijderen?")) return;
    const { error } = await (supabase as any).from("werven").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["werven-all"] });
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button onClick={openNew}><Plus className="w-4 h-4" /> Nieuwe werf</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{edit ? "Werf bewerken" : "Nieuwe werf"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Naam</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>Code</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></div>
              <div><Label>Adres</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
              <div><Label>Beschrijving</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              <div className="flex items-center gap-2"><Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} /><Label>Actief</Label></div>
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Annuleer</Button><Button onClick={save}>Opslaan</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {werven.map((w: any) => (
          <Card key={w.id}>
            <CardContent className="p-4 flex items-start justify-between gap-2">
              <div>
                <div className="font-medium">{w.name}</div>
                {w.code && <div className="text-xs text-muted-foreground">{w.code}</div>}
                {w.address && <div className="text-xs text-muted-foreground">{w.address}</div>}
                {!w.is_active && <Badge variant="secondary" className="mt-1">Inactief</Badge>}
              </div>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" onClick={() => openEdit(w)}><Pencil className="w-4 h-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => remove(w.id)}><Trash2 className="w-4 h-4" /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {werven.length === 0 && <p className="text-sm text-muted-foreground">Nog geen werven.</p>}
      </div>
    </div>
  );
}

/* -------- Video's -------- */
function VideosTab() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<any | null>(null);
  const [form, setForm] = useState({
    title: "", description: "", url: "", werf_id: "none", points: 10, is_published: true,
  });

  const { data: werven = [] } = useQuery({
    queryKey: ["werven-all"],
    queryFn: async () => (await (supabase as any).from("werven").select("*").order("name")).data ?? [],
  });
  const { data: videos = [] } = useQuery({
    queryKey: ["videos-all"],
    queryFn: async () => (await (supabase as any).from("training_videos").select("*, werf:werven(name)").order("created_at", { ascending: false })).data ?? [],
  });

  const openNew = () => { setEdit(null); setForm({ title: "", description: "", url: "", werf_id: "none", points: 10, is_published: true }); setOpen(true); };
  const openEdit = (v: any) => { setEdit(v); setForm({ title: v.title, description: v.description ?? "", url: v.url, werf_id: v.werf_id ?? "none", points: v.points, is_published: v.is_published }); setOpen(true); };

  const save = async () => {
    if (!form.title.trim() || !form.url.trim()) return toast.error("Titel en URL zijn verplicht");
    const detected = detectVideo(form.url);
    const payload = {
      title: form.title, description: form.description || null, url: form.url,
      provider: detected.provider, external_id: detected.externalId,
      werf_id: form.werf_id === "none" ? null : form.werf_id,
      points: form.points, is_published: form.is_published,
    };
    if (edit) {
      const { error } = await (supabase as any).from("training_videos").update(payload).eq("id", edit.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await (supabase as any).from("training_videos").insert(payload);
      if (error) return toast.error(error.message);
    }
    toast.success("Opgeslagen");
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["videos-all"] });
    qc.invalidateQueries({ queryKey: ["training_videos"] });
  };
  const remove = async (id: string) => {
    if (!confirm("Video verwijderen?")) return;
    const { error } = await (supabase as any).from("training_videos").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["videos-all"] });
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button onClick={openNew}><Plus className="w-4 h-4" /> Nieuwe video</Button></DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{edit ? "Video bewerken" : "Nieuwe video"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Titel</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
              <div>
                <Label>URL (YouTube, Vimeo of directe link)</Label>
                <Input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://www.youtube.com/watch?v=..." />
              </div>
              <div><Label>Beschrijving</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Werf</Label>
                  <Select value={form.werf_id} onValueChange={(v) => setForm({ ...form, werf_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Geen" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Geen werf</SelectItem>
                      {werven.map((w: any) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Punten</Label>
                  <Input type="number" value={form.points} onChange={(e) => setForm({ ...form, points: Number(e.target.value) })} />
                </div>
              </div>
              <div className="flex items-center gap-2"><Switch checked={form.is_published} onCheckedChange={(v) => setForm({ ...form, is_published: v })} /><Label>Gepubliceerd</Label></div>
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Annuleer</Button><Button onClick={save}>Opslaan</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {videos.map((v: any) => (
          <Card key={v.id}>
            <CardContent className="p-4 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-medium truncate">{v.title}</div>
                <div className="text-xs text-muted-foreground truncate">{v.url}</div>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline">{v.provider}</Badge>
                  {v.werf && <Badge variant="outline">{v.werf.name}</Badge>}
                  <Badge variant="outline">+{v.points} pt</Badge>
                  {!v.is_published && <Badge variant="secondary">Concept</Badge>}
                </div>
              </div>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" onClick={() => openEdit(v)}><Pencil className="w-4 h-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => remove(v.id)}><Trash2 className="w-4 h-4" /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {videos.length === 0 && <p className="text-sm text-muted-foreground">Nog geen video's.</p>}
      </div>
    </div>
  );
}

/* -------- Quizzen -------- */
interface Option { id: string; text: string; is_correct: boolean }
interface QForm { question: string; explanation: string; options: Option[] }

function QuizzesTab() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<any | null>(null);
  const [form, setForm] = useState({
    title: "", description: "", werf_id: "none", pass_score: 70, points: 20, bonus_points_perfect: 10, is_published: true,
  });
  const [manageId, setManageId] = useState<string | null>(null);

  const { data: werven = [] } = useQuery({
    queryKey: ["werven-all"],
    queryFn: async () => (await (supabase as any).from("werven").select("*").order("name")).data ?? [],
  });
  const { data: quizzes = [] } = useQuery({
    queryKey: ["quizzes-all"],
    queryFn: async () => (await (supabase as any).from("quizzes").select("*, werf:werven(name)").order("created_at", { ascending: false })).data ?? [],
  });

  const openNew = () => { setEdit(null); setForm({ title: "", description: "", werf_id: "none", pass_score: 70, points: 20, bonus_points_perfect: 10, is_published: true }); setOpen(true); };
  const openEdit = (q: any) => {
    setEdit(q);
    setForm({ title: q.title, description: q.description ?? "", werf_id: q.werf_id ?? "none", pass_score: q.pass_score, points: q.points, bonus_points_perfect: q.bonus_points_perfect, is_published: q.is_published });
    setOpen(true);
  };
  const save = async () => {
    if (!form.title.trim()) return toast.error("Titel is verplicht");
    const payload = { ...form, werf_id: form.werf_id === "none" ? null : form.werf_id };
    if (edit) {
      const { error } = await (supabase as any).from("quizzes").update(payload).eq("id", edit.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await (supabase as any).from("quizzes").insert(payload);
      if (error) return toast.error(error.message);
    }
    toast.success("Opgeslagen"); setOpen(false);
    qc.invalidateQueries({ queryKey: ["quizzes-all"] });
    qc.invalidateQueries({ queryKey: ["quizzes"] });
  };
  const remove = async (id: string) => {
    if (!confirm("Quiz verwijderen?")) return;
    const { error } = await (supabase as any).from("quizzes").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["quizzes-all"] });
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button onClick={openNew}><Plus className="w-4 h-4" /> Nieuwe quiz</Button></DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{edit ? "Quiz bewerken" : "Nieuwe quiz"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Titel</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
              <div><Label>Beschrijving</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Werf</Label>
                  <Select value={form.werf_id} onValueChange={(v) => setForm({ ...form, werf_id: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Geen werf</SelectItem>
                      {werven.map((w: any) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Slaag %</Label><Input type="number" value={form.pass_score} onChange={(e) => setForm({ ...form, pass_score: Number(e.target.value) })} /></div>
                <div><Label>Punten</Label><Input type="number" value={form.points} onChange={(e) => setForm({ ...form, points: Number(e.target.value) })} /></div>
              </div>
              <div><Label>Bonus bij 100%</Label><Input type="number" value={form.bonus_points_perfect} onChange={(e) => setForm({ ...form, bonus_points_perfect: Number(e.target.value) })} /></div>
              <div className="flex items-center gap-2"><Switch checked={form.is_published} onCheckedChange={(v) => setForm({ ...form, is_published: v })} /><Label>Gepubliceerd</Label></div>
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Annuleer</Button><Button onClick={save}>Opslaan</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {quizzes.map((q: any) => (
          <Card key={q.id}>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-medium">{q.title}</div>
                  <div className="flex items-center gap-2 mt-1">
                    {q.werf && <Badge variant="outline">{q.werf.name}</Badge>}
                    <Badge variant="outline">Slagen ≥ {q.pass_score}%</Badge>
                    <Badge variant="outline">+{q.points} pt</Badge>
                    {!q.is_published && <Badge variant="secondary">Concept</Badge>}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => openEdit(q)}><Pencil className="w-4 h-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => remove(q.id)}><Trash2 className="w-4 h-4" /></Button>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => setManageId(q.id)}>Vragen beheren</Button>
            </CardContent>
          </Card>
        ))}
        {quizzes.length === 0 && <p className="text-sm text-muted-foreground">Nog geen quizzen.</p>}
      </div>
      {manageId && <QuestionsDialog quizId={manageId} onClose={() => setManageId(null)} />}
    </div>
  );
}

function QuestionsDialog({ quizId, onClose }: { quizId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: questions = [] } = useQuery({
    queryKey: ["quiz_questions_admin", quizId],
    queryFn: async () => (await (supabase as any).from("quiz_questions").select("*").eq("quiz_id", quizId).order("order_index")).data ?? [],
  });
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<QForm>({ question: "", explanation: "", options: [
    { id: crypto.randomUUID(), text: "", is_correct: true },
    { id: crypto.randomUUID(), text: "", is_correct: false },
  ]});

  const openNew = () => { setEditing(null); setForm({ question: "", explanation: "", options: [
    { id: crypto.randomUUID(), text: "", is_correct: true },
    { id: crypto.randomUUID(), text: "", is_correct: false },
  ]}); };
  const openEdit = (q: any) => { setEditing(q); setForm({ question: q.question, explanation: q.explanation ?? "", options: q.options }); };

  const save = async () => {
    if (!form.question.trim()) return toast.error("Vraag verplicht");
    if (form.options.filter((o) => o.text.trim()).length < 2) return toast.error("Minstens 2 antwoorden");
    if (!form.options.some((o) => o.is_correct)) return toast.error("Duid een juist antwoord aan");
    const cleanOptions = form.options.filter((o) => o.text.trim());
    if (editing) {
      const { error } = await (supabase as any).from("quiz_questions").update({
        question: form.question, explanation: form.explanation || null, options: cleanOptions,
      }).eq("id", editing.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await (supabase as any).from("quiz_questions").insert({
        quiz_id: quizId, question: form.question, explanation: form.explanation || null,
        options: cleanOptions, order_index: questions.length,
      });
      if (error) return toast.error(error.message);
    }
    toast.success("Opgeslagen"); setEditing(null); openNew();
    qc.invalidateQueries({ queryKey: ["quiz_questions_admin", quizId] });
    qc.invalidateQueries({ queryKey: ["quiz_questions", quizId] });
  };
  const remove = async (id: string) => {
    if (!confirm("Vraag verwijderen?")) return;
    await (supabase as any).from("quiz_questions").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["quiz_questions_admin", quizId] });
  };

  const setOptText = (id: string, text: string) => setForm((f) => ({ ...f, options: f.options.map((o) => o.id === id ? { ...o, text } : o) }));
  const setCorrect = (id: string) => setForm((f) => ({ ...f, options: f.options.map((o) => ({ ...o, is_correct: o.id === id })) }));
  const addOpt = () => setForm((f) => ({ ...f, options: [...f.options, { id: crypto.randomUUID(), text: "", is_correct: false }] }));
  const rmOpt = (id: string) => setForm((f) => ({ ...f, options: f.options.filter((o) => o.id !== id) }));

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Vragen beheren</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            {questions.map((q: any, i: number) => (
              <Card key={q.id}>
                <CardContent className="p-3 flex items-start justify-between gap-2">
                  <div className="text-sm">
                    <div className="font-medium">{i + 1}. {q.question}</div>
                    <div className="text-xs text-muted-foreground">{q.options.length} antwoorden</div>
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(q)}><Pencil className="w-4 h-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(q.id)}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <Card>
            <CardHeader><CardTitle className="text-base">{editing ? "Vraag bewerken" : "Nieuwe vraag"}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div><Label>Vraag</Label><Textarea value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })} /></div>
              <div>
                <Label>Antwoorden (kies de juiste)</Label>
                <div className="space-y-2 mt-1">
                  {form.options.map((o) => (
                    <div key={o.id} className="flex items-center gap-2">
                      <input type="radio" checked={o.is_correct} onChange={() => setCorrect(o.id)} />
                      <Input value={o.text} onChange={(e) => setOptText(o.id, e.target.value)} placeholder="Antwoord…" />
                      {form.options.length > 2 && (
                        <Button size="icon" variant="ghost" onClick={() => rmOpt(o.id)}><Trash2 className="w-4 h-4" /></Button>
                      )}
                    </div>
                  ))}
                </div>
                <Button size="sm" variant="outline" className="mt-2" onClick={addOpt}><Plus className="w-4 h-4" /> Antwoord</Button>
              </div>
              <div><Label>Uitleg (optioneel)</Label><Textarea value={form.explanation} onChange={(e) => setForm({ ...form, explanation: e.target.value })} /></div>
              <div className="flex gap-2">
                <Button onClick={save}>{editing ? "Bijwerken" : "Toevoegen"}</Button>
                {editing && <Button variant="outline" onClick={openNew}>Nieuw</Button>}
              </div>
            </CardContent>
          </Card>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Sluiten</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
