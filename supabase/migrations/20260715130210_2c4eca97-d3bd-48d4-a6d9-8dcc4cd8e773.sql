
-- Werven (locaties) — beheerbaar door admin
CREATE TABLE public.werven (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT,
  address TEXT,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.werven TO authenticated;
GRANT ALL ON public.werven TO service_role;
ALTER TABLE public.werven ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Iedereen ingelogd kan werven lezen" ON public.werven FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin beheert werven" ON public.werven FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER werven_updated_at BEFORE UPDATE ON public.werven FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Video-provider enum
CREATE TYPE public.video_provider AS ENUM ('youtube', 'vimeo', 'url');

-- Instructievideo's
CREATE TABLE public.training_videos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  url TEXT NOT NULL,
  provider public.video_provider NOT NULL DEFAULT 'youtube',
  external_id TEXT,
  duration_seconds INTEGER,
  werf_id UUID REFERENCES public.werven(id) ON DELETE SET NULL,
  points INTEGER NOT NULL DEFAULT 10,
  is_published BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.training_videos TO authenticated;
GRANT ALL ON public.training_videos TO service_role;
ALTER TABLE public.training_videos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Iedereen ingelogd kan gepubliceerde video's lezen" ON public.training_videos FOR SELECT TO authenticated
  USING (is_published OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin beheert video's" ON public.training_videos FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER training_videos_updated_at BEFORE UPDATE ON public.training_videos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_training_videos_werf ON public.training_videos(werf_id);

-- Video views (voltooiingen)
CREATE TABLE public.video_views (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  video_id UUID NOT NULL REFERENCES public.training_videos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  progress_seconds INTEGER NOT NULL DEFAULT 0,
  completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  points_awarded INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(video_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.video_views TO authenticated;
GRANT ALL ON public.video_views TO service_role;
ALTER TABLE public.video_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Eigen video-views beheren" ON public.video_views FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admin ziet alle video-views" ON public.video_views FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hse_manager') OR public.has_role(auth.uid(), 'manager'));
CREATE TRIGGER video_views_updated_at BEFORE UPDATE ON public.video_views FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Quizzen
CREATE TABLE public.quizzes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  werf_id UUID REFERENCES public.werven(id) ON DELETE SET NULL,
  pass_score INTEGER NOT NULL DEFAULT 70,
  points INTEGER NOT NULL DEFAULT 20,
  bonus_points_perfect INTEGER NOT NULL DEFAULT 10,
  is_published BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quizzes TO authenticated;
GRANT ALL ON public.quizzes TO service_role;
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Iedereen ingelogd kan gepubliceerde quizzen lezen" ON public.quizzes FOR SELECT TO authenticated
  USING (is_published OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin beheert quizzen" ON public.quizzes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER quizzes_updated_at BEFORE UPDATE ON public.quizzes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Quizvragen
CREATE TABLE public.quiz_questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  explanation TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  -- options is array of { id, text, is_correct }
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quiz_questions TO authenticated;
GRANT ALL ON public.quiz_questions TO service_role;
ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Ingelogde gebruikers lezen vragen van gepubliceerde quizzen" ON public.quiz_questions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.quizzes q WHERE q.id = quiz_id AND (q.is_published OR public.has_role(auth.uid(), 'admin'))));
CREATE POLICY "Admin beheert quizvragen" ON public.quiz_questions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER quiz_questions_updated_at BEFORE UPDATE ON public.quiz_questions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_quiz_questions_quiz ON public.quiz_questions(quiz_id);

-- Quizpogingen
CREATE TABLE public.quiz_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  score INTEGER NOT NULL DEFAULT 0,
  total_questions INTEGER NOT NULL DEFAULT 0,
  correct_count INTEGER NOT NULL DEFAULT 0,
  passed BOOLEAN NOT NULL DEFAULT false,
  points_awarded INTEGER NOT NULL DEFAULT 0,
  answers JSONB NOT NULL DEFAULT '[]'::jsonb,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quiz_attempts TO authenticated;
GRANT ALL ON public.quiz_attempts TO service_role;
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Eigen pogingen beheren" ON public.quiz_attempts FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admin/HSE/Manager zien alle pogingen" ON public.quiz_attempts FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hse_manager') OR public.has_role(auth.uid(), 'manager'));
CREATE INDEX idx_quiz_attempts_user ON public.quiz_attempts(user_id);
CREATE INDEX idx_quiz_attempts_quiz ON public.quiz_attempts(quiz_id);

-- Leaderboard functie (aggregatie video points + best quiz points per quiz)
CREATE OR REPLACE FUNCTION public.get_leaderboard(_limit INTEGER DEFAULT 50)
RETURNS TABLE(
  user_id UUID,
  full_name TEXT,
  email TEXT,
  video_points BIGINT,
  quiz_points BIGINT,
  total_points BIGINT,
  videos_completed BIGINT,
  quizzes_passed BIGINT
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH vp AS (
    SELECT user_id, COALESCE(SUM(points_awarded),0)::BIGINT AS pts, COUNT(*) FILTER (WHERE completed)::BIGINT AS n
    FROM public.video_views WHERE completed GROUP BY user_id
  ),
  qp AS (
    SELECT user_id,
           COALESCE(SUM(best_points),0)::BIGINT AS pts,
           COUNT(*) FILTER (WHERE best_points > 0)::BIGINT AS n
    FROM (
      SELECT user_id, quiz_id, MAX(points_awarded) AS best_points
      FROM public.quiz_attempts WHERE passed GROUP BY user_id, quiz_id
    ) a GROUP BY user_id
  )
  SELECT p.id AS user_id,
         p.full_name,
         p.email,
         COALESCE(vp.pts,0) AS video_points,
         COALESCE(qp.pts,0) AS quiz_points,
         (COALESCE(vp.pts,0) + COALESCE(qp.pts,0)) AS total_points,
         COALESCE(vp.n,0) AS videos_completed,
         COALESCE(qp.n,0) AS quizzes_passed
  FROM public.profiles p
  LEFT JOIN vp ON vp.user_id = p.id
  LEFT JOIN qp ON qp.user_id = p.id
  WHERE auth.uid() IS NOT NULL
  ORDER BY total_points DESC, videos_completed DESC
  LIMIT _limit;
$$;
