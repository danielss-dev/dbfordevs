import { Label } from "@/components/ui";

interface SettingRowProps {
  label: string;
  description: string;
  children: React.ReactNode;
}

export function SettingRow({ label, description, children }: SettingRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 px-3 py-2.5">
      <div className="space-y-0.5">
        <Label className="text-[13px] font-medium">{label}</Label>
        <p className="text-[11px] text-muted-foreground max-w-[280px]">{description}</p>
      </div>
      {children}
    </div>
  );
}
