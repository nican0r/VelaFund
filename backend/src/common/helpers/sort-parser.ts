export interface SortField {
  field: string;
  direction: 'asc' | 'desc';
}

export function parseSort(
  sort: string | undefined,
  allowedFields: string[],
  defaultSort: SortField = { field: 'createdAt', direction: 'desc' },
): SortField[] {
  if (!sort) return [defaultSort];

  const fields = sort.split(',').slice(0, 3);
  const parsed: SortField[] = [];

  for (const f of fields) {
    const descending = f.startsWith('-');
    const fieldName = descending ? f.slice(1) : f;

    if (allowedFields.includes(fieldName)) {
      parsed.push({
        field: fieldName,
        direction: descending ? 'desc' : 'asc',
      });
    }
  }

  return parsed.length > 0 ? parsed : [defaultSort];
}
