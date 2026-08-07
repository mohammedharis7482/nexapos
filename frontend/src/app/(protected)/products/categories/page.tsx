"use client";

import { Edit3, Plus } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { canManageCatalogue } from "@/components/catalogue/access";
import { CategoryDialog } from "@/components/catalogue/category-dialog";
import { Button, IconButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge, PageHeader } from "@/components/ui/display";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { SearchInput } from "@/components/ui/input";
import { FilterToolbar } from "@/components/ui/layout";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/providers/auth-provider";
import { categoryService } from "@/services/category.service";
import type { ProductCategory } from "@/types/category";

export default function CategoriesPage() {
  const { user } = useAuth();
  const owner = canManageCatalogue(user?.role ?? "CASHIER");
  const initialized = useRef(false);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ProductCategory | null>(null);

  const load = useCallback(async (term = search) => {
    setLoading(true);
    setError(null);
    try {
      const response = await categoryService.list(term, owner ? "all" : "true");
      setCategories(response.data.results);
    } catch (loadError) {
      setError(loadError instanceof ApiError ? loadError.message : "Categories could not be loaded.");
    } finally { setLoading(false); }
  }, [owner, search]);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    void load("");
  }, [load]);

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Catalogue"
        title="Product categories"
        description={owner ? "Organize the catalogue and control which categories are active." : "Browse active categories used by your shop."}
        action={owner ? <Button leadingIcon={<Plus className="size-4" />} onClick={() => { setEditing(null); setDialogOpen(true); }}>Add category</Button> : undefined}
      />
      <Link href="/products" className="text-sm font-semibold text-primary">← Back to products</Link>
      <FilterToolbar result={<><span className="font-semibold tabular-nums text-foreground">{categories.length}</span> {categories.length === 1 ? "category" : "categories"}</>}>
        <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); void load(search); }}>
          <div className="flex-1"><SearchInput value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search categories" aria-label="Search categories" /></div>
          <Button type="submit" variant="secondary">Search</Button>
        </form>
      </FilterToolbar>
      {loading ? <div className="space-y-3"><Skeleton className="h-20 w-full" /><Skeleton className="h-20 w-full" /></div> : null}
      {error ? <ErrorState title="Categories unavailable" description={error} onRetry={() => void load()} /> : null}
      {!loading && !error && categories.length === 0 ? <EmptyState title="No categories found" description={search ? "Try a different search." : "Add a category to organize products."} /> : null}
      {!loading && !error && categories.length > 0 ? (
        <Card className="divide-y divide-border overflow-hidden">
          {categories.map((category) => (
            <div key={category.id} className="flex items-center justify-between gap-4 p-4 transition-colors hover:bg-surface-secondary sm:px-5">
              <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold">{category.name}</h2><Badge tone={category.is_active ? "success" : "neutral"}>{category.is_active ? "Active" : "Inactive"}</Badge></div><p className="mt-1 truncate text-sm text-text-muted">{category.description || "No description"} · Display order {category.display_order}</p></div>
              {owner ? <IconButton aria-label={`Edit ${category.name}`} onClick={() => { setEditing(category); setDialogOpen(true); }}><Edit3 className="size-4" /></IconButton> : null}
            </div>
          ))}
        </Card>
      ) : null}
      <CategoryDialog open={dialogOpen} onOpenChange={setDialogOpen} category={editing} secondaryLanguage={user?.shop.secondary_language ?? ""} onSaved={() => void load()} />
    </div>
  );
}
