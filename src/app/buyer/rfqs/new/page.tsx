import { PortalFrame } from "@/components/portal-frame";
import { TraySeed } from "@/components/tray-seed";
import { requireRole } from "@/lib/auth/guard";
import { getRepo } from "@/lib/data";

export default async function NewRfqPage({ searchParams }: { searchParams: Promise<{ bom?: string; rev?: string }> }) {
  const session = await requireRole("buyer");
  const query = await searchParams;
  let initial: { mpn: string; manufacturer: string; description: string; qty: number }[] = [];
  if (query.bom) {
    const detail = await (await getRepo()).bomDetail(session.buyerId!, query.bom, query.rev);
    initial = (detail?.lines ?? [])
      .filter((line) => line.match.type === "none")
      .map((line) => ({ mpn: line.mpn, manufacturer: line.manufacturer, description: line.description, qty: line.qty }));
  }
  return (
    <PortalFrame role="buyer" title="New RFQ">
      <p className="mb-4 text-sm text-ink-soft">Lines from your quote tray are added in the browser. The RFQ is stored only when you send it.</p>
      <TraySeed initial={initial} />
    </PortalFrame>
  );
}
