import {sqliteTable,text} from 'drizzle-orm/sqlite-core';
export const archiveRecords=sqliteTable('archive_records',{id:text('id').primaryKey(),canonicalUrl:text('canonical_url').notNull().unique(),doi:text('doi').unique(),data:text('data').notNull(),createdAt:text('created_at').notNull()});
export const editorialReviews=sqliteTable('editorial_reviews',{recordId:text('record_id').primaryKey().references(()=>archiveRecords.id),decision:text('decision').notNull(),notes:text('notes').notNull(),updatedAt:text('updated_at').notNull()});
export const sourceRegistry=sqliteTable('source_registry',{id:text('id').primaryKey(),data:text('data').notNull(),checkedAt:text('checked_at'),lastError:text('last_error')});
export const collectionRuns=sqliteTable('collection_runs',{id:text('id').primaryKey(),data:text('data').notNull(),createdAt:text('created_at').notNull()});
export const discoveryLog=sqliteTable('discovery_log',{id:text('id').primaryKey(),canonicalUrl:text('canonical_url').notNull(),data:text('data').notNull(),updatedAt:text('updated_at').notNull()});
export const searchLog=sqliteTable('search_log',{id:text('id').primaryKey(),data:text('data').notNull(),checkedAt:text('checked_at').notNull()});
export const backfillQueue=sqliteTable('backfill_queue',{id:text('id').primaryKey(),data:text('data').notNull(),status:text('status').notNull(),checkedAt:text('checked_at')});
