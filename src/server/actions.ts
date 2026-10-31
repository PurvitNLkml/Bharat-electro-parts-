"use server";

import { clearDemoCookie, getSession, setDemoCookie } from "@/lib/auth/session";
import { readToken, signToken } from "@/lib/auth/token";
import { getRepo } from "@/lib/data";
import { fetchPublishedSheet } from "@/lib/data/sheet-fetch";
import { MarketplaceError } from "@/lib/data/marketplace";
import { applyMapping } from "@/lib/domain/columns";
import type { BuyerSignup, GstMode, ListingInput, ManufacturerSignup, RfqDraftLine, SupplierSignup } from "@/lib/domain/types";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

function homeFor(role: string) {
  if (role === "supplier") return "/supplier";
  if (role === "manufacturer") return "/manufacturer";
  if (role === "admin") return "/admin";
  return "/buyer";
}

function isRedirect(error: unknown): boolean {
  return typeof error === "object" && error !== null && "digest" in error && String((error as { digest?: string }).digest).startsWith("NEXT_REDIRECT");
}

function bounce(path: string, error: unknown): never {
  if (isRedirect(error)) throw error;
  const message = error instanceof Error ? error.message : "Something went wrong.";
  redirect(`${path}${path.includes("?") ? "&" : "?"}error=${encodeURIComponent(message)}`);
}

export async function signOut() {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  await clearDemoCookie();
  redirect("/");
}

export async function demoSignIn(formData: FormData) {
  const userId = String(formData.get("userId") ?? "");
  const session = await (await getRepo()).sessionForUser(userId);
  if (!session || isSupabaseConfigured()) redirect("/login?error=Choose%20an%20account");
  await setDemoCookie(session.userId);
  redirect(homeFor(session.role));
}

export async function requestOtp(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const next = String(formData.get("next") ?? "/buyer");
  if (!isSupabaseConfigured()) {
    const user = await (await getRepo()).userByEmail(email);
    if (!user) redirect("/login?error=No%20seeded%20account%20uses%20that%20email");
    await setDemoCookie(user.id);
    redirect(homeFor(user.role));
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  if (error) redirect(`/login?error=${encodeURIComponent(error.message)}`);
  redirect(`/login?sent=1&email=${encodeURIComponent(email)}&next=${encodeURIComponent(next)}`);
}

export async function verifyOtp(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const token = String(formData.get("token") ?? "").trim();
  const next = String(formData.get("next") ?? "/buyer");
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
  if (error) redirect(`/login?error=${encodeURIComponent(error.message)}&sent=1&email=${encodeURIComponent(email)}`);
  const pending = await takePendingSignup();
  if (pending) {
    try {
      const repo = await getRepo();
      if (pending.kind === "supplier") await repo.signupSupplier(pending.input);
      if (pending.kind === "buyer") await repo.signupBuyer(pending.input);
      if (pending.kind === "manufacturer") await repo.signupManufacturer(pending.input);
    } catch (error) {
      bounce("/login", error);
    }
  }
  const session = await getSession();
  redirect(session ? homeFor(session.role) : next);
}

async function rememberSignup(payload: PendingSignup) {
  const jar = await cookies();
  jar.set("bep_signup", signToken(JSON.stringify({ ...payload, exp: Date.now() + 60 * 60 * 1000 })), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60,
  });
}

type PendingSignup =
  | { kind: "supplier"; input: SupplierSignup; exp?: number }
  | { kind: "buyer"; input: BuyerSignup; exp?: number }
  | { kind: "manufacturer"; input: ManufacturerSignup; exp?: number };

async function takePendingSignup(): Promise<PendingSignup | null> {
  const jar = await cookies();
  const raw = readToken(jar.get("bep_signup")?.value);
  jar.delete("bep_signup");
  if (!raw) return null;
  const parsed = JSON.parse(raw) as PendingSignup;
  if (parsed.exp && parsed.exp < Date.now()) return null;
  return parsed;
}

export async function registerSupplier(formData: FormData) {
  const input: SupplierSignup = {
    companyName: String(formData.get("companyName") ?? ""),
    contactPerson: String(formData.get("contactPerson") ?? ""),
    mobile: String(formData.get("mobile") ?? ""),
    email: String(formData.get("email") ?? ""),
    gstin: String(formData.get("gstin") ?? ""),
    city: String(formData.get("city") ?? ""),
    state: String(formData.get("state") ?? ""),
  };
  try {
    if (!isSupabaseConfigured()) {
      const session = await (await getRepo()).signupSupplier(input);
      await setDemoCookie(session.userId);
      redirect("/supplier");
    }
    const session = await getSession();
    if (!session) {
      await rememberSignup({ kind: "supplier", input });
      const supabase = await createClient();
      const { error } = await supabase.auth.signInWithOtp({ email: input.email.trim().toLowerCase(), options: { shouldCreateUser: true } });
      if (error) throw new MarketplaceError(error.message);
      redirect(`/login?sent=1&email=${encodeURIComponent(input.email.trim().toLowerCase())}&next=/supplier`);
    }
    await (await getRepo()).signupSupplier(input);
  } catch (error) {
    bounce("/suppliers/join", error);
  }
  redirect("/supplier");
}

export async function registerBuyer(formData: FormData) {
  const input: BuyerSignup = {
    name: String(formData.get("name") ?? ""),
    company: String(formData.get("company") ?? ""),
    email: String(formData.get("email") ?? ""),
    city: String(formData.get("city") ?? ""),
    mobile: String(formData.get("mobile") ?? ""),
  };
  try {
    if (!isSupabaseConfigured()) {
      const session = await (await getRepo()).signupBuyer(input);
      await setDemoCookie(session.userId);
      redirect("/buyer");
    }
    const session = await getSession();
    if (!session) {
      await rememberSignup({ kind: "buyer", input });
      const supabase = await createClient();
      const { error } = await supabase.auth.signInWithOtp({ email: input.email.trim().toLowerCase(), options: { shouldCreateUser: true } });
      if (error) throw new MarketplaceError(error.message);
      redirect(`/login?sent=1&email=${encodeURIComponent(input.email.trim().toLowerCase())}&next=/buyer`);
    }
    await (await getRepo()).signupBuyer(input);
  } catch (error) {
    bounce("/login", error);
  }
  redirect("/buyer");
}

export async function registerManufacturer(formData: FormData) {
  const input: ManufacturerSignup = {
    brandName: String(formData.get("brandName") ?? ""),
    contactName: String(formData.get("contactName") ?? ""),
    email: String(formData.get("email") ?? ""),
    website: String(formData.get("website") ?? ""),
    description: String(formData.get("description") ?? ""),
    city: String(formData.get("city") ?? ""),
  };
  try {
    if (!isSupabaseConfigured()) {
      const session = await (await getRepo()).signupManufacturer(input);
      await setDemoCookie(session.userId);
      redirect("/manufacturer");
    }
    const session = await getSession();
    if (!session) {
      await rememberSignup({ kind: "manufacturer", input });
      const supabase = await createClient();
      const { error } = await supabase.auth.signInWithOtp({ email: input.email.trim().toLowerCase(), options: { shouldCreateUser: true } });
      if (error) throw new MarketplaceError(error.message);
      redirect(`/login?sent=1&email=${encodeURIComponent(input.email.trim().toLowerCase())}&next=/manufacturer`);
    }
    await (await getRepo()).signupManufacturer(input);
  } catch (error) {
    bounce("/manufacturers/join", error);
  }
  redirect("/manufacturer");
}

async function supplier() {
  const session = await getSession();
  if (!session || session.role !== "supplier" || !session.supplierId) redirect("/login?next=/supplier");
  return session;
}

export async function saveStockRows(rows: ListingInput[]) {
  const session = await supplier();
  try {
    const report = await (await getRepo()).addListings(session.supplierId!, rows);
    revalidatePath("/supplier/stock");
    revalidatePath("/search");
    return report;
  } catch (error) {
    return { ok: 0, failed: [{ row: 0, reason: error instanceof Error ? error.message : "Could not save stock." }], createdIds: [] };
  }
}

export async function saveStockForm(formData: FormData) {
  const session = await supplier();
  const breaks = [1, 2, 3, 4, 5].flatMap((index) => {
    const minQty = Number(formData.get(`minQty${index}`) || 0);
    const rate = Number(formData.get(`rate${index}`) || 0);
    if (!minQty && !rate) return [];
    return [{ minQty, rate }];
  });
  const row: ListingInput = {
    mpn: String(formData.get("mpn") ?? ""),
    manufacturer: String(formData.get("manufacturer") ?? ""),
    description: String(formData.get("description") ?? ""),
    category: String(formData.get("category") ?? ""),
    package: String(formData.get("package") ?? ""),
    qty: Number(formData.get("qty") || 0),
    moq: Number(formData.get("moq") || 0),
    priceBreaks: breaks,
    gstMode: (String(formData.get("gstMode") ?? "extra") === "inclusive" ? "inclusive" : "extra") as GstMode,
    leadTime: String(formData.get("leadTime") ?? ""),
    dateCode: String(formData.get("dateCode") ?? ""),
    city: String(formData.get("city") ?? ""),
    state: String(formData.get("state") ?? ""),
  };
  try {
    const report = await (await getRepo()).addListings(session.supplierId!, [row]);
    if (report.failed.length && report.ok === 0) throw new MarketplaceError(report.failed[0]?.reason ?? "Could not save.");
    revalidatePath("/supplier/stock");
    revalidatePath("/search");
  } catch (error) {
    bounce("/supplier/stock/new", error);
  }
  redirect("/supplier/stock");
}

export async function touchListing(formData: FormData) {
  const session = await supplier();
  await (await getRepo()).touchListing(session.supplierId!, String(formData.get("id") ?? ""));
  revalidatePath("/supplier/stock");
  revalidatePath("/search");
}

export async function saveMappedStock(payload: { rows: Record<string, string>[]; city: string; state: string }) {
  const rows: ListingInput[] = payload.rows.map((row) => ({
    mpn: row.mpn ?? "",
    manufacturer: row.manufacturer ?? "",
    description: row.description ?? "",
    category: (row.category || "passives").toLowerCase(),
    package: row.package ?? "",
    qty: Number(row.qty || 0),
    moq: Number(row.moq || 0),
    gstMode: row.gstMode?.toLowerCase().includes("incl") ? "inclusive" : "extra",
    leadTime: row.leadTime ?? "",
    dateCode: row.dateCode ?? "",
    city: row.city || payload.city,
    state: row.state || payload.state,
    priceBreaks: row.rate ? [{ minQty: Number(row.breakQty || row.moq || 1), rate: Number(row.rate) }] : [],
  }));
  return saveStockRows(rows);
}

export async function previewSheet(url: string) {
  try {
    return await fetchPublishedSheet(url);
  } catch (error) {
    return { headers: [], rows: [], error: error instanceof Error ? error.message : "Could not read that sheet." };
  }
}

export async function saveBid(formData: FormData) {
  const session = await supplier();
  const rfqId = String(formData.get("rfqId") ?? "");
  let attachmentPath: string | null = null;
  let attachmentName: string | null = null;
  const file = formData.get("attachment");
  try {
    if (file instanceof File && file.size > 0) {
      const saved = await (await getRepo()).saveAttachment(session.supplierId!, {
        filename: file.name,
        contentType: file.type || "application/octet-stream",
        base64: Buffer.from(await file.arrayBuffer()).toString("base64"),
      });
      attachmentPath = saved.path;
      attachmentName = saved.name;
    }
    await (await getRepo()).submitBid(session.supplierId!, {
      rfqLineId: String(formData.get("rfqLineId") ?? ""),
      rate: formData.get("cantSupply") ? null : Number(formData.get("rate")),
      moq: formData.get("moq") ? Number(formData.get("moq")) : null,
      stock: formData.get("stock") ? Number(formData.get("stock")) : null,
      leadTime: String(formData.get("leadTime") ?? ""),
      brand: String(formData.get("brand") ?? ""),
      alternatePart: String(formData.get("alternatePart") ?? ""),
      dateCode: String(formData.get("dateCode") ?? ""),
      validity: String(formData.get("validity") ?? ""),
      remarks: String(formData.get("remarks") ?? ""),
      cantSupply: formData.get("cantSupply") === "on",
      attachmentPath,
      attachmentName,
    });
    revalidatePath(`/supplier/rfqs/${rfqId}`);
  } catch (error) {
    bounce(`/supplier/rfqs/${rfqId}`, error);
  }
  redirect(`/supplier/rfqs/${rfqId}`);
}

export async function saveBom(payload: { name: string; note: string; lines: RfqDraftLine[]; refdes?: string[]; packages?: string[] }) {
  const session = await getSession();
  if (!session || session.role !== "buyer" || !session.buyerId) redirect("/login?next=/buyer/boms");
  try {
    const id = await (await getRepo()).createBom(
      session.buyerId,
      payload.name,
      payload.lines.map((line, index) => ({
        mpn: line.mpn,
        manufacturer: line.manufacturer,
        description: line.description,
        qty: line.qty,
        refdes: payload.refdes?.[index] ?? "",
        package: payload.packages?.[index] ?? "",
      })),
      payload.note,
    );
    revalidatePath("/buyer/boms");
    return { id };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not save the BOM." };
  }
}

export async function saveRevision(payload: { bomId: string; note: string; lines: { mpn: string; manufacturer?: string; description?: string; qty: number; refdes?: string; package?: string }[] }) {
  const session = await getSession();
  if (!session || session.role !== "buyer" || !session.buyerId) redirect("/login?next=/buyer/boms");
  try {
    const revisionId = await (await getRepo()).addRevision(session.buyerId, payload.bomId, payload.lines, payload.note);
    revalidatePath(`/buyer/boms/${payload.bomId}`);
    return { revisionId };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not save the revision." };
  }
}

export async function saveRfq(payload: { title: string; notes: string; lines: RfqDraftLine[] }) {
  const session = await getSession();
  if (!session || session.role !== "buyer" || !session.buyerId) redirect("/login?next=/buyer/rfqs/new");
  try {
    const id = await (await getRepo()).createRfq(session.buyerId, payload.title, payload.notes, payload.lines);
    revalidatePath("/buyer/rfqs");
    return { id };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not send the RFQ." };
  }
}

export async function setSupplierStatus(formData: FormData) {
  const session = await getSession();
  if (!session || session.role !== "admin") redirect("/login?next=/admin");
  const status = String(formData.get("status") ?? "");
  if (status !== "pending" && status !== "verified" && status !== "rejected") return;
  await (await getRepo()).setSupplierStatus(String(formData.get("supplierId") ?? ""), status);
  revalidatePath("/admin/suppliers");
}

export async function routeSuggested(formData: FormData) {
  const session = await getSession();
  if (!session || session.role !== "admin") redirect("/login?next=/admin");
  const rfqId = String(formData.get("rfqId") ?? "");
  const supplierIds = formData.getAll("supplierId").map(String);
  await (await getRepo()).routeRfq(rfqId, supplierIds);
  revalidatePath(`/admin/rfqs/${rfqId}`);
}

export async function awardBid(formData: FormData) {
  const session = await getSession();
  if (!session || session.role !== "admin") redirect("/login?next=/admin");
  const rfqId = String(formData.get("rfqId") ?? "");
  await (await getRepo()).award(String(formData.get("lineId") ?? ""), String(formData.get("bidId") ?? ""));
  revalidatePath(`/admin/rfqs/${rfqId}`);
  revalidatePath("/buyer/rfqs");
}

export async function resolveFlag(formData: FormData) {
  const session = await getSession();
  if (!session || session.role !== "admin") redirect("/login?next=/admin");
  await (await getRepo()).resolveFlag(String(formData.get("flagId") ?? ""));
  revalidatePath("/admin/flags");
}

export async function toggleAuthorisation(formData: FormData) {
  const session = await getSession();
  if (!session || session.role !== "admin") redirect("/login?next=/admin");
  await (await getRepo()).setAuthorisation(
    String(formData.get("manufacturerId") ?? ""),
    String(formData.get("supplierId") ?? ""),
    formData.get("authorised") === "yes",
  );
  revalidatePath("/admin/suppliers");
  revalidatePath("/brands");
}

export async function updateBrand(formData: FormData) {
  const session = await getSession();
  if (!session || session.role !== "manufacturer" || !session.manufacturerId) redirect("/login?next=/manufacturer");
  await (await getRepo()).updateManufacturer(session.manufacturerId, String(formData.get("description") ?? ""), String(formData.get("website") ?? ""));
  revalidatePath("/manufacturer");
}

export async function attachmentLink(path: string) {
  const session = await getSession();
  if (!session) return null;
  return (await getRepo()).signedAttachmentUrl(session, path);
}

export async function mapRows(rows: Record<string, string>[], mapping: Record<string, string | null>) {
  return applyMapping(rows, mapping);
}
