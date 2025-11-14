import { Loader2 } from "lucide-react";

export function ActivationSpinner() {
  return (
    <Loader2 
      className="h-4 w-4 animate-spin" 
      strokeWidth={2.5}
    />
  );
}
