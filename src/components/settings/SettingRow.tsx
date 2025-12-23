import { Label } from "@/components/ui";

interface SettingRowProps {
  label: string;
  description: string;
  children: React.ReactNode;
}

export function SettingRow({ label, description, children }: SettingRowProps) {
  return (
    <div className="flex items-center justify-between py-4">
      <div className="space-y-1">
        <Label className="text-sm font-medium">{label}</Label>
        <p className="text-xs text-muted-foreground max-w-[280px]">{description}</p>
      </div>
      {children}
    </div>
  );
}
