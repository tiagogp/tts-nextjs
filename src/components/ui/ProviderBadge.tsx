export interface ProviderBadgeProps {
  isLocal: boolean;
  available: boolean;
}

export default function ProviderBadge({ isLocal, available }: ProviderBadgeProps) {
  return (
    <span
      className="status-pill"
      style={{ color: available ? "var(--text-muted)" : "#c41c1c" }}
      title={isLocal ? "Content stays on this device" : "Content is sent to this cloud provider"}
    >
      {isLocal ? "Local" : "Cloud"}
    </span>
  );
}
