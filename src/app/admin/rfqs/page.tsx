import { DataView } from "@/components/data-view";
import { PortalFrame } from "@/components/portal-frame";
import { requireRole } from "@/lib/auth/guard";
import { getRepo } from "@/lib/data";
import { formatWhen } from "@/lib/format";

export default async function AdminRfqsPage() {
  await requireRole("admin");
  const rfqs = await (await getRepo()).adminRfqs();
  return (
    <PortalFrame role="admin" title="RFQs">
      <DataView
        screen="admin-rfqs"
        columns={[
          { key: "title", title: "Title", width: 220 },
          { key: "buyer", title: "Buyer" },
          { key: "status", title: "Status" },
          { key: "lines", title: "Lines", kind: "number" },
          { key: "bids", title: "Bids", kind: "number" },
          { key: "routes", title: "Routes", kind: "number" },
          { key: "created", title: "Created" },
        ]}
        rows={rfqs.map((rfq) => ({
          id: rfq.id,
          title: rfq.title,
          buyer: rfq.buyerCompany,
          status: rfq.status,
          lines: rfq.lines,
          bids: rfq.bids,
          routes: rfq.routes,
          created: formatWhen(rfq.createdAt),
        }))}
        rowAction={{ open: "/admin/rfqs/" }}
      />
    </PortalFrame>
  );
}
