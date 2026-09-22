import { Skeleton } from "@/components/ui/skeleton";

export default function NewShootLoading() {
  return (
    <div className="mx-auto grid max-w-5xl gap-7 p-7 md:grid-cols-[228px_1fr]" data-testid="shoot-wizard-loading">
      <Skeleton className="h-72 rounded-3xl" />
      <div className="space-y-5">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    </div>
  );
}
