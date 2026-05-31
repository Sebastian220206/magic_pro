import type { PersistedProject } from './projectPersistence';

export type MigrationFn = (data: any) => any;

const migrations: Record<number, MigrationFn> = {
  // Future migrations go here:
  // 2: migrateV1ToV2,
};

export function migrateProject(data: any): PersistedProject {
  let current = { ...data };
  const fromVersion = current.schemaVersion ?? 0;
  const toVersion = 1;

  for (let v = fromVersion; v < toVersion; v++) {
    const nextV = v + 1;
    const migration = migrations[nextV];
    if (migration) {
      try {
        current = migration(current);
        current.schemaVersion = nextV;
        console.log(`[Migration] Applied v${v} → v${nextV}`);
      } catch (e) {
        console.error(`[Migration] Failed v${v} → v${nextV}:`, e);
        throw e;
      }
    }
  }

  return current as PersistedProject;
}
