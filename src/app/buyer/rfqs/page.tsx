import { DataView } from "@/components/data-view";
import { PortalFrame } from "@/components/portal-frame";
import { requireRole } from "@/lib/auth/guard";
import { getRepo } from "@/lib/data";
import { formatWhen } from "@/lib/format";

export default async function BuyerRfqsPage() {
  const session = await requireRole("buyer");
  const rfqs = await (await getRepo()).rfqsForBuyer(session.buyerId!);
  return (
    <PortalFrame role="buyer" title="RFQs">
      <DataView
        screen="buyer-rfqs"
        columns={[
          { key: "title", title: "Title", width: 220 },
          { key: "status", title: "Status" },
          { key: "lines", title: "Lines", kind: "number" },
          { key: "quotes", title: "Quotes", kind: "number" },
          { key: "created", title: "Created" },
        ]}
        rows={rfqs.map((rfq) => ({ id: rfq.id, title: rfq.title, status: rfq.status, lines: rfq.lines, quotes: rfq.quotes, created: formatWhen(rfq.createdAt) }))}
        rowAction={{ open: "/buyer/rfqs/" }}
      />
    </PortalFrame>
  );
}
