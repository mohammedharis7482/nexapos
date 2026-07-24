import { Skeleton } from "@/components/ui/feedback";

export default function SaleDetailLoading() {
  return (
    <div className="page-stack" aria-label="Loading sale details">
      <Skeleton className="h-6 w-28" />
      <Skeleton className="h-14 w-full max-w-xl" />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Skeleton className="h-96" />
        <div className="space-y-4">
          <Skeleton className="h-56" />
          <Skeleton className="h-44" />
        </div>
      </div>
    </div>
  );
}
