import { paginate } from './paginate';

describe('paginate', () => {
  it('should create a paginated response with correct meta', () => {
    const data = [{ id: '1' }, { id: '2' }];
    const result = paginate(data, 50, 1, 20);

    expect(result).toEqual({
      success: true,
      data,
      meta: {
        total: 50,
        page: 1,
        limit: 20,
        totalPages: 3,
      },
    });
  });

  it('should calculate totalPages correctly for exact division', () => {
    const result = paginate([], 100, 1, 20);
    expect(result.meta.totalPages).toBe(5);
  });

  it('should calculate totalPages correctly for non-exact division', () => {
    const result = paginate([], 101, 1, 20);
    expect(result.meta.totalPages).toBe(6);
  });

  it('should handle empty results', () => {
    const result = paginate([], 0, 1, 20);

    expect(result).toEqual({
      success: true,
      data: [],
      meta: {
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      },
    });
  });
});
