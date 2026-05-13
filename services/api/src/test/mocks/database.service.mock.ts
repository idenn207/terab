export const mockDbFor = jest.fn();
export const mockDbLimit = jest.fn();
export const mockDbWhere = jest.fn();
export const mockDbFrom = jest.fn();
export const mockDbSelect = jest.fn();
export const mockDbInsert = jest.fn();
export const mockDbUpdate = jest.fn();
export const mockDbDelete = jest.fn();
export const mockDbTransaction = jest.fn();

export const mockDatabaseService = {
  db: {
    select: mockDbSelect,
    insert: mockDbInsert,
    update: mockDbUpdate,
    delete: mockDbDelete,
    transaction: mockDbTransaction,
  },
};

// jest.clearAllMocks() 호출 후 select 체인을 재구성할 때 사용
export const setupMockDbSelectChain = () => {
  mockDbSelect.mockReturnValue({ from: mockDbFrom });
  mockDbFrom.mockReturnValue({ where: mockDbWhere });
  mockDbWhere.mockReturnValue({ limit: mockDbLimit });
  mockDbLimit.mockReturnValue({ for: mockDbFor });
};

// jest.clearAllMocks() 호출 후 transaction 콜백 실행을 재구성할 때 사용
export const setupMockDbTransactionChain = () => {
  mockDbTransaction.mockImplementation((cb: (tx: unknown) => Promise<unknown>) => cb({}));
};
