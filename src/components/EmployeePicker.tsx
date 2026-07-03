import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type EmployeeLite = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  function_title: string | null;
  employer: string | null;
};

interface Props {
  /** Free-text value shown in the button — usually "Achternaam, Voornaam" */
  value: string;
  onSelect: (emp: EmployeeLite) => void;
  /** Optional: called when user clears / types free text via the input; keeps free-text mode */
  onFreeText?: (text: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function EmployeePicker({
  value,
  onSelect,
  onFreeText,
  placeholder = "Kies medewerker uit personeelsfiches…",
  className,
  disabled,
}: Props) {
  const [open, setOpen] = useState(false);
  const { data: employees = [], isLoading } = useQuery({
    queryKey: ["employees-picker"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id,first_name,last_name,function_title,employer,active")
        .eq("active", true)
        .order("last_name", { ascending: true })
        .limit(2000);
      if (error) throw error;
      return (data ?? []) as (EmployeeLite & { active: boolean })[];
    },
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between h-11 rounded-xl font-normal",
            !value && "text-muted-foreground",
            className,
          )}
        >
          <span className="truncate">{value || placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command
          filter={(v, search) => (v.toLowerCase().includes(search.toLowerCase()) ? 1 : 0)}
        >
          <CommandInput
            placeholder="Zoek op naam, functie of firma…"
            onValueChange={(v) => onFreeText?.(v)}
          />
          <CommandList>
            <CommandEmpty>
              {isLoading ? "Laden…" : "Geen medewerker gevonden. Voeg toe via Personeelsfiches."}
            </CommandEmpty>
            <CommandGroup>
              {employees.map((e) => {
                const label = `${e.last_name ?? ""}, ${e.first_name ?? ""}`.trim();
                const search = `${label} ${e.function_title ?? ""} ${e.employer ?? ""}`;
                const active = value === label;
                return (
                  <CommandItem
                    key={e.id}
                    value={search}
                    onSelect={() => {
                      onSelect(e);
                      setOpen(false);
                    }}
                    className="flex items-start gap-2"
                  >
                    <Check className={cn("mt-0.5 h-4 w-4", active ? "opacity-100" : "opacity-0")} />
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{label}</span>
                      <span className="text-xs text-muted-foreground">
                        {[e.function_title, e.employer].filter(Boolean).join(" — ") || "—"}
                      </span>
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
