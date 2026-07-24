import { Skeleton } from "@/components/ui/feedback";

export default function ReceiptLoading() {
  return (
    <div className="page-stack" aria-label="Loading receipt">
      <Skeleton className="mx-auto h-11 w-full max-w-[560px]" />
      <Skeleton className="mx-auto h-[680px] w-full max-w-[360px]" />
    </div>
  );
}
