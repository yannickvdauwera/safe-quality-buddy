import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

export interface UserPickerProfile {
  id: string;
  full_name: string | null;
  email: string | null;
  function_title: string | null;
}

interface Props {
  value?: string | null; // profile id
  onSelect: (profile: UserPickerProfile | null) => void;
  placeholder?: string;
  emptyLabel?: string;
  disabled?: boolean;
  excludeUserIds?: string[];
  allowClear?: boolean;
}

export function UserPicker({
  value,
  onSelect,
  placeholder = "Zoek een gebruiker…",
  emptyLabel = "Geen gebruikers gevonden",
  disabled,
  excludeUserIds = [],
  allowClear = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: profiles = [], isLoading } = useQuery<UserPickerProfile[]>({
    queryKey: ["profiles-directory"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_app_users");
      if (error) throw error;
      return (data ?? []) as UserPickerProfile[];
    },
    staleTime: 60_000,
  });

  const filtered = useMemo(() => {
    const excl = new Set(excludeUserIds);
    const q = query.trim().toLowerCase();
    return profiles
      .filter((p) => !excl.has(p.id))
      .filter((p) => {
        if (!q) return true;
        return (
          p.full_name?.toLowerCase().includes(q) ||
          p.email?.toLowerCase().includes(q) ||
          p.function_title?.toLowerCase().includes(q)
        );
      })
      .slice(0, 100);
  }, [profiles, query, excludeUserIds]);

  const selected = profiles.find((p) => p.id === value) ?? null;

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 30);
  }, [open]);

  return (
    <div className="flex gap-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className="flex-1 justify-between font-normal"
          >
            <span className={cn("truncate text-left", !selected && "text-muted-foreground")}>
              {selected
                ? `${selected.full_name ?? selected.email ?? "—"}${selected.function_title ? ` · ${selected.function_title}` : ""}`
                : placeholder}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-[--radix-popover-trigger-width] min-w-[320px]" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              ref={inputRef}
              value={query}
              onValueChange={setQuery}
              placeholder="Zoek op naam, e-mail of functie…"
            />
            <CommandList>
              <CommandEmpty>{isLoading ? "Laden…" : emptyLabel}</CommandEmpty>
              <CommandGroup>
                {filtered.map((p) => (
                  <CommandItem
                    key={p.id}
                    value={p.id}
                    onSelect={() => {
                      onSelect(p);
                      setOpen(false);
                      setQuery("");
                    }}
                    className="flex items-start gap-2"
                  >
                    <Check
                      className={cn(
                        "mt-1 h-4 w-4",
                        value === p.id ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        {p.full_name ?? p.email ?? "Naamloos"}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {[p.function_title, p.email].filter(Boolean).join(" · ") || "—"}
                      </div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {allowClear && selected && !disabled && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => onSelect(null)}
          title="Wissen"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
