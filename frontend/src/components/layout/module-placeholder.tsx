import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/display";

export function ModulePlaceholder({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="space-y-6">
      <PageHeader title={title} description={description} />
      <Card className="p-4 sm:p-6">
        <EmptyState
          title={`${title} is coming next`}
          description="This navigation destination is reserved. No business data or workflow has been implemented yet."
        />
      </Card>
    </div>
  );
}
