import type { ApiSuccess } from "@/types/auth";

export interface PaginatedData<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export type PaginatedResponse<T> = ApiSuccess<PaginatedData<T>>;
