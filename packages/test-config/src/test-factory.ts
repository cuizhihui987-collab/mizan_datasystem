let counter = 0;
const uid = () => `test_${++counter}_${Date.now()}`;

export const TestFactory = {
  user(overrides?: Record<string, unknown>) {
    const id = uid();
    return {
      id,
      name: "Test User",
      email: `test-${id}@example.com`,
      password: "$2a$10$hashedpassword",
      role: "USER",
      ...overrides,
    };
  },

  schema(overrides?: Record<string, unknown>) {
    return {
      id: uid(),
      name: `Test Schema ${uid()}`,
      userId: "test-user-id",
      status: "ACTIVE",
      ...overrides,
    };
  },

  tableDefinition(overrides?: Record<string, unknown>) {
    const id = uid();
    return {
      id,
      schemaId: "test-schema-id",
      logicalName: `Test Table ${uid()}`,
      physicalName: `mzan_tbl_${id.replace(/-/g, "_")}`,
      status: "CREATED",
      ...overrides,
    };
  },

  column(overrides?: Record<string, unknown>) {
    const id = uid();
    return {
      id,
      tableId: "test-table-id",
      logicalName: `col_${id}`,
      physicalName: `col_${id}`,
      dataType: "STRING",
      ordinalPosition: 1,
      isNullable: true,
      ...overrides,
    };
  },
};
