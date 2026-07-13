interface ShortcutItemProps {
  label: string;
  keys: string[];
}

export function ShortcutItem({ label, keys }: ShortcutItemProps) {
  return (
    <div className="flex items-center justify-between py-3 group">
      <span className="text-sm">{label}</span>
      <div className="flex items-center gap-1">
        {keys.map((key, idx) => (
          <span key={idx}>
            <kbd>
              {key}
            </kbd>
            {idx < keys.length - 1 && <span className="text-muted-foreground mx-0.5">+</span>}
          </span>
        ))}
      </div>
    </div>
  );
}
