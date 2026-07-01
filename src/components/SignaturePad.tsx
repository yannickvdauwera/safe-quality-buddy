import { useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";
import { Button } from "@/components/ui/button";
import { RotateCcw, Check } from "lucide-react";

interface Props {
  onSave: (dataUrl: string) => void | Promise<void>;
  saving?: boolean;
}

export function SignaturePad({ onSave, saving }: Props) {
  const ref = useRef<SignatureCanvas>(null);
  const [empty, setEmpty] = useState(true);

  const clear = () => {
    ref.current?.clear();
    setEmpty(true);
  };

  const save = async () => {
    if (!ref.current || ref.current.isEmpty()) return;
    const dataUrl = ref.current.getCanvas().toDataURL("image/png");
    await onSave(dataUrl);
  };

  return (
    <div className="space-y-3">
      <div className="border-2 border-dashed border-muted-foreground/30 rounded-lg bg-white overflow-hidden touch-none">
        <SignatureCanvas
          ref={ref}
          canvasProps={{
            className: "w-full h-56 md:h-72",
            width: 800,
            height: 300,
          }}
          onEnd={() => setEmpty(false)}
          penColor="#111111"
        />
      </div>
      <p className="text-xs text-muted-foreground text-center">
        Teken hierboven met je vinger of muis
      </p>
      <div className="flex gap-2">
        <Button variant="outline" onClick={clear} disabled={saving} className="flex-1">
          <RotateCcw className="w-4 h-4" /> Wissen
        </Button>
        <Button onClick={save} disabled={empty || saving} className="flex-1">
          <Check className="w-4 h-4" /> {saving ? "Opslaan..." : "Bevestigen"}
        </Button>
      </div>
    </div>
  );
}
