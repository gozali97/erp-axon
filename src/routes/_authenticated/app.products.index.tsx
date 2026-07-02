import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveCompany } from "@/hooks/use-active-company";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/products/")({
  component: ProductsPage,
});

function ProductsPage() {
  const { data: companyId } = useActiveCompany();
  const [search, setSearch] = useState("");
  const [openCreate, setOpenCreate] = useState(false);

  const { data: products, isLoading } = useQuery({
    queryKey: ["products", companyId, search],
    enabled: !!companyId,
    queryFn: async () => {
      let query = supabase
        .from("products")
        .select("id, sku, name, product_type, sale_price, purchase_price, is_active, base_unit_id, category_id, units(code), categories(name)")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false })
        .limit(200);
      if (search) query = query.or(`sku.ilike.%${search}%,name.ilike.%${search}%,barcode.ilike.%${search}%`);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-widest text-primary mb-2 font-bold">
            Master Data / Products
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">Products</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Kelola SKU, harga, dan konfigurasi persediaan.
          </p>
        </div>
        <Dialog open={openCreate} onOpenChange={setOpenCreate}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="size-4" /> Produk baru
            </Button>
          </DialogTrigger>
          <CreateProductDialog companyId={companyId} onDone={() => setOpenCreate(false)} />
        </Dialog>
      </div>

      <div className="mb-4 flex items-center gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari SKU, nama, atau barcode…"
            className="pl-9"
          />
        </div>
      </div>

      <div className="border border-border rounded-lg overflow-hidden bg-background">
        <table className="w-full text-sm">
          <thead className="bg-surface border-b border-border">
            <tr className="text-left">
              <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">SKU</th>
              <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Nama</th>
              <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Kategori</th>
              <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Unit</th>
              <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Jenis</th>
              <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground text-right">Harga Jual</th>
              <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Status</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground text-sm">Memuat…</td></tr>
            )}
            {!isLoading && products?.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-16 text-center">
                  <Package className="mx-auto size-8 text-muted-foreground mb-3" />
                  <div className="font-medium mb-1">Belum ada produk</div>
                  <div className="text-xs text-muted-foreground mb-4">Mulai dengan menambahkan produk pertama Anda.</div>
                  <Button onClick={() => setOpenCreate(true)} size="sm" className="gap-2">
                    <Plus className="size-4" /> Tambah produk
                  </Button>
                </td>
              </tr>
            )}
            {products?.map((p) => (
              <tr key={p.id} className="border-b border-border last:border-0 hover:bg-surface/50">
                <td className="px-4 py-3 font-mono text-xs">{p.sku}</td>
                <td className="px-4 py-3 font-medium">{p.name}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {(p.categories as { name: string } | null)?.name ?? "—"}
                </td>
                <td className="px-4 py-3 font-mono text-xs">
                  {(p.units as { code: string } | null)?.code ?? "—"}
                </td>
                <td className="px-4 py-3">
                  <span className="font-mono text-[10px] uppercase text-muted-foreground">{p.product_type}</span>
                </td>
                <td className="px-4 py-3 text-right font-mono">
                  {Number(p.sale_price).toLocaleString("id-ID", { minimumFractionDigits: 0 })}
                </td>
                <td className="px-4 py-3">
                  {p.is_active ? (
                    <span className="text-[10px] font-mono uppercase text-green-700 bg-green-50 px-2 py-0.5 border border-green-200">Active</span>
                  ) : (
                    <span className="text-[10px] font-mono uppercase text-muted-foreground bg-surface px-2 py-0.5 border border-border">Inactive</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 text-xs text-muted-foreground flex items-center justify-between">
        <div>
          Butuh Unit atau Kategori dulu?{" "}
          <Link to="/app/units" className="text-primary underline">Kelola Units</Link>
          {" · "}
          <Link to="/app/categories" className="text-primary underline">Kelola Categories</Link>
        </div>
      </div>
    </div>
  );
}

function CreateProductDialog({ companyId, onDone }: { companyId: string | null | undefined; onDone: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    sku: "",
    name: "",
    barcode: "",
    description: "",
    product_type: "stockable" as "stockable" | "service" | "consumable",
    valuation_method: "average" as "fifo" | "lifo" | "average" | "standard",
    category_id: "" as string,
    base_unit_id: "" as string,
    sale_price: "",
    purchase_price: "",
    min_stock: "",
    is_active: true,
  });

  const { data: units } = useQuery({
    queryKey: ["units-select", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await supabase
        .from("units")
        .select("id, code, name")
        .eq("company_id", companyId!)
        .eq("is_active", true)
        .order("code");
      return data ?? [];
    },
  });

  const { data: categories } = useQuery({
    queryKey: ["categories-select", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await supabase
        .from("categories")
        .select("id, code, name")
        .eq("company_id", companyId!)
        .eq("is_active", true)
        .order("name");
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("No active company");
      if (!form.sku.trim() || !form.name.trim() || !form.base_unit_id) {
        throw new Error("SKU, nama, dan satuan dasar wajib diisi");
      }
      const { data: user } = await supabase.auth.getUser();
      const { error } = await supabase.from("products").insert({
        company_id: companyId,
        sku: form.sku.trim(),
        name: form.name.trim(),
        barcode: form.barcode.trim() || null,
        description: form.description.trim() || null,
        product_type: form.product_type,
        valuation_method: form.valuation_method,
        category_id: form.category_id || null,
        base_unit_id: form.base_unit_id,
        sale_price: Number(form.sale_price) || 0,
        purchase_price: Number(form.purchase_price) || 0,
        min_stock: Number(form.min_stock) || 0,
        is_active: form.is_active,
        created_by: user.user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Produk berhasil dibuat");
      queryClient.invalidateQueries({ queryKey: ["products"] });
      onDone();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Gagal membuat produk"),
  });

  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader>
        <DialogTitle>Produk baru</DialogTitle>
      </DialogHeader>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="sku">SKU *</Label>
          <Input id="sku" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value.toUpperCase() })} placeholder="PRD-001" />
        </div>
        <div>
          <Label htmlFor="barcode">Barcode</Label>
          <Input id="barcode" value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} />
        </div>
        <div className="col-span-2">
          <Label htmlFor="name">Nama produk *</Label>
          <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nama produk" />
        </div>
        <div>
          <Label>Kategori</Label>
          <Select value={form.category_id || undefined} onValueChange={(v) => setForm({ ...form, category_id: v })}>
            <SelectTrigger><SelectValue placeholder="Pilih kategori" /></SelectTrigger>
            <SelectContent>
              {categories?.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
              {(categories?.length ?? 0) === 0 && (
                <div className="px-2 py-4 text-xs text-muted-foreground">Belum ada kategori</div>
              )}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Satuan dasar *</Label>
          <Select value={form.base_unit_id} onValueChange={(v) => setForm({ ...form, base_unit_id: v })}>
            <SelectTrigger><SelectValue placeholder="Pilih unit" /></SelectTrigger>
            <SelectContent>
              {units?.map((u) => (
                <SelectItem key={u.id} value={u.id}>{u.code} — {u.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Jenis produk</Label>
          <Select value={form.product_type} onValueChange={(v: "stockable" | "service" | "consumable") => setForm({ ...form, product_type: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="stockable">Stockable (stok)</SelectItem>
              <SelectItem value="service">Service (jasa)</SelectItem>
              <SelectItem value="consumable">Consumable</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Metode penilaian</Label>
          <Select value={form.valuation_method} onValueChange={(v: "fifo" | "lifo" | "average" | "standard") => setForm({ ...form, valuation_method: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="average">Average</SelectItem>
              <SelectItem value="fifo">FIFO</SelectItem>
              <SelectItem value="lifo">LIFO</SelectItem>
              <SelectItem value="standard">Standard cost</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="sale_price">Harga jual</Label>
          <Input id="sale_price" type="number" min="0" step="0.01" value={form.sale_price} onChange={(e) => setForm({ ...form, sale_price: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="purchase_price">Harga beli</Label>
          <Input id="purchase_price" type="number" min="0" step="0.01" value={form.purchase_price} onChange={(e) => setForm({ ...form, purchase_price: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="min_stock">Min. stok</Label>
          <Input id="min_stock" type="number" min="0" step="0.01" value={form.min_stock} onChange={(e) => setForm({ ...form, min_stock: e.target.value })} />
        </div>
        <div className="col-span-2">
          <Label htmlFor="description">Deskripsi</Label>
          <Textarea id="description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
        </div>
        <div className="col-span-2 flex items-center gap-2">
          <Switch id="active" checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
          <Label htmlFor="active">Aktif</Label>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onDone}>Batal</Button>
        <Button onClick={() => create.mutate()} disabled={create.isPending}>
          {create.isPending ? "Menyimpan…" : "Simpan produk"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
