import {
  EntitySubscriberInterface,
  EventSubscriber,
  InsertEvent,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

/**
 * Entities use varchar UUID primary keys. TypeORM does not apply
 * `default: () => uuidv4()` on repository.create() — assign before insert.
 */
@EventSubscriber()
export class UuidPrimarySubscriber implements EntitySubscriberInterface {
  beforeInsert(event: InsertEvent<object>): void {
    const entity = event.entity as Record<string, unknown>;
    const now = new Date();

    for (const col of event.metadata.columns) {
      if (col.isCreateDate || col.isUpdateDate) {
        const current = entity[col.propertyName];
        if (current === null || current === undefined) {
          entity[col.propertyName] = now;
        }
      }
    }

    const { primaryColumns, columns } = event.metadata;
    if (primaryColumns.length !== 1) {
      return;
    }

    const pk = primaryColumns[0];
    if (pk.type !== 'varchar' && pk.type !== String) {
      return;
    }

    const current = entity[pk.propertyName];
    if (current !== null && current !== undefined && current !== '') {
      return;
    }

    const hasUuidDefault = columns.some(
      (col) =>
        col.propertyName === pk.propertyName &&
        typeof col.default === 'function',
    );
    if (!hasUuidDefault) {
      return;
    }

    entity[pk.propertyName] = uuidv4();
  }
}
