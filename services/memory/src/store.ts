export interface MemoryNote {
  id: string;
  tenantId: string;
  userId: string;
  content: string;
  kind: "durable" | "episodic";
  createdAt: string;
}

export class InMemoryStore {
  private readonly notes: MemoryNote[] = [];

  put(note: Omit<MemoryNote, "createdAt">): MemoryNote {
    const record: MemoryNote = { ...note, createdAt: new Date().toISOString() };
    this.notes.push(record);
    return record;
  }

  listByTenant(tenantId: string): MemoryNote[] {
    return this.notes.filter((note) => note.tenantId === tenantId);
  }
}
