import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface DraftRow<T = unknown> {
  id: string;
  form_type: string;
  form_key: string;
  title: string | null;
  payload: T;
  last_saved_at: string;
  updated_at: string;
}

interface Options<T> {
  formType: string;
  formKey?: string;
  values: T;
  isDirty: boolean;
  isSubmitted: boolean;
  title?: string;
  autosaveMs?: number;
  /** If false, autosave/restore are inert (e.g. editing an existing record). */
  enabled?: boolean;
}

export function useDraftForm<T>({
  formType,
  formKey = "new",
  values,
  isDirty,
  isSubmitted,
  title,
  autosaveMs = 3000,
  enabled = true,
}: Options<T>) {
  const { user } = useAuth();
  const [existingDraft, setExistingDraft] = useState<DraftRow<T> | null>(null);
  const [checkedForDraft, setCheckedForDraft] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const draftIdRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Check for existing draft once when mounted
  useEffect(() => {
    if (!enabled || !user) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("form_drafts")
        .select("*")
        .eq("user_id", user.id)
        .eq("form_type", formType)
        .eq("form_key", formKey)
        .maybeSingle();
      if (cancelled) return;
      if (data) {
        setExistingDraft(data as unknown as DraftRow<T>);
        draftIdRef.current = data.id;
        setLastSavedAt(data.last_saved_at);
      }
      setCheckedForDraft(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, user, formType, formKey]);

  const persist = useCallback(async () => {
    if (!user || !enabled) return;
    setSaving(true);
    const now = new Date().toISOString();
    const row = {
      user_id: user.id,
      form_type: formType,
      form_key: formKey,
      title: title ?? null,
      payload: values as unknown,
      last_saved_at: now,
    };
    const { data, error } = await supabase
      .from("form_drafts")
      .upsert(row as never, { onConflict: "user_id,form_type,form_key" })
      .select("id, last_saved_at")
      .single();
    setSaving(false);
    if (!error && data) {
      draftIdRef.current = data.id;
      setLastSavedAt(data.last_saved_at);
    }
    return { error };
  }, [user, enabled, formType, formKey, title, values]);

  // Debounced autosave
  useEffect(() => {
    if (!enabled || !user || !isDirty || isSubmitted) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      void persist();
    }, autosaveMs);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [enabled, user, isDirty, isSubmitted, autosaveMs, persist, values]);

  // Warn before browser tab close / navigation
  useEffect(() => {
    if (!enabled || !isDirty || isSubmitted) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [enabled, isDirty, isSubmitted]);

  const deleteDraft = useCallback(async () => {
    if (!user) return;
    if (draftIdRef.current) {
      await supabase.from("form_drafts").delete().eq("id", draftIdRef.current);
    } else {
      await supabase
        .from("form_drafts")
        .delete()
        .eq("user_id", user.id)
        .eq("form_type", formType)
        .eq("form_key", formKey);
    }
    draftIdRef.current = null;
    setLastSavedAt(null);
    setExistingDraft(null);
  }, [user, formType, formKey]);

  const dismissRestore = useCallback(() => {
    setExistingDraft(null);
  }, []);

  return {
    existingDraft,
    checkedForDraft,
    saving,
    lastSavedAt,
    saveNow: persist,
    deleteDraft,
    dismissRestore,
  };
}
