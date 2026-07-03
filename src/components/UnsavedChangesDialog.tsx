import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaveDraft: () => void;
  onDiscard: () => void;
  saving?: boolean;
}

/** Prompt shown when the user tries to close a dirty form. */
export function UnsavedChangesDialog({ open, onOpenChange, onSaveDraft, onDiscard, saving }: Props) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Niet-opgeslagen wijzigingen</AlertDialogTitle>
          <AlertDialogDescription>
            Je hebt gegevens ingevoerd die nog niet definitief zijn geregistreerd. Wil je deze bewaren als
            concept zodat je later verder kan werken?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
          <AlertDialogCancel disabled={saving}>Verder invullen</AlertDialogCancel>
          <Button variant="ghost" onClick={onDiscard} disabled={saving}>
            Weggooien
          </Button>
          <AlertDialogAction onClick={onSaveDraft} disabled={saving}>
            {saving ? "Opslaan…" : "Concept opslaan"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

interface RestoreProps {
  open: boolean;
  lastSavedAt?: string | null;
  onRestore: () => void;
  onDiscard: () => void;
}

/** Prompt shown when a saved draft is found for the same form. */
export function RestoreDraftDialog({ open, lastSavedAt, onRestore, onDiscard }: RestoreProps) {
  return (
    <AlertDialog open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Concept gevonden</AlertDialogTitle>
          <AlertDialogDescription>
            Er is een eerder opgeslagen concept gevonden{lastSavedAt ? ` van ${new Date(lastSavedAt).toLocaleString("nl-BE")}` : ""}.
            Wil je verder werken vanaf dat concept?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button variant="ghost" onClick={onDiscard}>Nieuw beginnen</Button>
          <AlertDialogAction onClick={onRestore}>Concept openen</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
