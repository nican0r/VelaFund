import { PaginationMeta, PaginatedApiResponse } from '../types/api-response.types';

export function paginate<T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
): PaginatedApiResponse<T> {
  const meta: PaginationMeta = {
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };

  return { success: true, data, meta };
}
