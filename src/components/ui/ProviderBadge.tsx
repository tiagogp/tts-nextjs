import { StatusPill } from "@/components/ui/StatusPill";

export interface ProviderBadgeProps {
  isLocal: boolean;
  available: boolean;
}

export default function ProviderBadge({ isLocal, available }: ProviderBadgeProps) {
  return (
    <StatusPill
      tone={available ? "default" : "danger"}
      title={isLocal ? "Content stays on this device" : "Content is sent to this cloud provider"}
    >
      {isLocal ? "Local" : "Cloud"}
    </StatusPill>
  );
}
