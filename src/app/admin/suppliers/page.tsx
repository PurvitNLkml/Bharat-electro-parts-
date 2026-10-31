import { DataView } from "@/components/data-view";
import { PortalFrame } from "@/components/portal-frame";
import { requireRole } from "@/lib/auth/guard";
import { getRepo } from "@/lib/data";
import { toggleAuthorisation } from "@/server/actions";

export default async function AdminSuppliersPage() {
  const awaitRole = await requireRole("admin");
  void awaitRole;
  const repo = await getRepo();
  const [suppliers, manufacturers, authorisations] = await Promise.all([repo.adminSuppliers(), repo.manufacturers(), repo.authorisations()]);
  return (
    <PortalFrame role="admin" title="Suppliers">
      <DataView
        screen="admin-suppliers"
        columns={[
          { key: "company", title: "Company", width: 200 },
          { key: "city", title: "City" },
          { key: "state", title: "State" },
          { key: "gstin", title: "GSTIN", width: 180 },
          { key: "status", title: "Status" },
          { key: "email", title: "Email", width: 200 },
        ]}
        rows={suppliers.map((row) => ({
          id: row.id,
          company: row.companyName,
          city: row.city,
          state: row.state,
          gstin: row.gstin,
          status: row.status,
          email: row.email,
        }))}
        rowAction="verify"
      />
      <h2 className="mt-8 font-serif text-2xl">Authorised stockists</h2>
      <div className="mt-3 space-y-3">
        {manufacturers.map((manufacturer) => (
          <div key={manufacturer.id} className="rounded-2xl border border-line bg-card p-4">
            <h3 className="font-semibold">{manufacturer.brandName}</h3>
            <div className="mt-2 flex flex-wrap gap-3">
              {suppliers.filter((supplier) => supplier.status === "verified").map((supplier) => {
                const on = authorisations.some((row) => row.manufacturerId === manufacturer.id && row.supplierId === supplier.id);
                return (
                  <form key={supplier.id} action={toggleAuthorisation}>
                    <input type="hidden" name="manufacturerId" value={manufacturer.id} />
                    <input type="hidden" name="supplierId" value={supplier.id} />
                    <input type="hidden" name="authorised" value={on ? "no" : "yes"} />
                    <button className="rounded-full border border-line px-3 py-1 text-sm" type="submit">
                      {on ? "Remove" : "Authorise"} {supplier.companyName}
                    </button>
                  </form>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </PortalFrame>
  );
}
