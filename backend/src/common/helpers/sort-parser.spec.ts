import { parseSort } from './sort-parser';

describe('parseSort', () => {
  const allowedFields = ['createdAt', 'name', 'email', 'status'];

  it('should return default sort when no sort string provided', () => {
    const result = parseSort(undefined, allowedFields);
    expect(result).toEqual([{ field: 'createdAt', direction: 'desc' }]);
  });

  it('should parse ascending field', () => {
    const result = parseSort('name', allowedFields);
    expect(result).toEqual([{ field: 'name', direction: 'asc' }]);
  });

  it('should parse descending field with - prefix', () => {
    const result = parseSort('-createdAt', allowedFields);
    expect(result).toEqual([{ field: 'createdAt', direction: 'desc' }]);
  });

  it('should parse multiple comma-separated fields', () => {
    const result = parseSort('-createdAt,name', allowedFields);
    expect(result).toEqual([
      { field: 'createdAt', direction: 'desc' },
      { field: 'name', direction: 'asc' },
    ]);
  });

  it('should ignore unknown fields and fall back to default', () => {
    const result = parseSort('unknownField', allowedFields);
    expect(result).toEqual([{ field: 'createdAt', direction: 'desc' }]);
  });

  it('should limit to 3 sort fields', () => {
    const result = parseSort('name,-email,status,-createdAt', allowedFields);
    expect(result).toHaveLength(3);
  });

  it('should use custom default sort', () => {
    const result = parseSort(undefined, allowedFields, { field: 'name', direction: 'asc' });
    expect(result).toEqual([{ field: 'name', direction: 'asc' }]);
  });
});
