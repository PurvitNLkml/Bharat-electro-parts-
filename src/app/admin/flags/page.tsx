import { DataView } from "@/components/data-view";
import { PortalFrame } from "@/components/portal-frame";
import { requireRole } from "@/lib/auth/guard";
import { getRepo } from "@/lib/data";
import { formatWhen } from "@/lib/format";

export default async function FlagsPage() {
  await requireRole("admin");
  const flags = await (await getRepo()).flags();
  return (
    <PortalFrame role="admin" title="Fraud flags">
      <DataView
        screen="admin-flags"
        columns={[
          { key: "entity", title: "Entity" },
          { key: "reason", title: "Reason", width: 360 },
          { key: "created", title: "Raised" },
          { key: "state", title: "State" },
        ]}
        rows={flags.map((flag) => ({
          id: flag.id,
          entity: `${flag.entityType} ${flag.entityId}`,
          reason: flag.reason,
          created: formatWhen(flag.createdAt),
          state: flag.resolved ? "Resolved" : "Open",
          resolved: flag.resolved,
        }))}
        rowAction="resolve"
      />
    </PortalFrame>
  );
}
