# Migration Audit

## Summary

Sprint 9.1 audited the historical Prisma migration chain and repaired the repository history by replacing the non-deterministic sequence with a single clean baseline migration generated from the current `schema.prisma`.

## Historical Migration Chain

Original migration order as stored in `server/prisma/migrations`:

1. `20260621173953_sprint1_local_setup`
2. `20260621190000_sprint2_catalog_foundation`
3. `20260622123000_sprint3_import_engine`
4. `20260622165000_sprint6_monitoring_ops`
5. `20260622193000_sprint4_scraper_framework`
6. `20260623170000_sprint65_commerce_foundation`

Observed problem:

- Migration timestamps do not match their dependency order.
- `sprint6_monitoring_ops` executes before `sprint4_scraper_framework`.
- `sprint6_monitoring_ops` alters and references `ScraperSource`, but `ScraperSource` is only created later in `sprint4_scraper_framework`.
- `sprint65_commerce_foundation` is effectively empty (`migration.sql` length: 2 bytes), while the current Prisma schema contains many commerce, payment, connector, cart, and notification models that never appear in the historical SQL chain.

## Valid Migrations

### `20260621173953_sprint1_local_setup`

Status: Valid in isolation

Creates the initial foundation:

- auth and user tables
- product catalog core
- orders and payments v1
- imports v1
- reviews, notifications v1, audit log, settings

### `20260621190000_sprint2_catalog_foundation`

Status: Valid in sequence after sprint1

Adds:

- `ProductVariant`
- product enum normalization
- product/category/brand refinements

### `20260622123000_sprint3_import_engine`

Status: Valid in sequence after sprint1 and sprint2

Adds:

- `ImportLog`
- `ImportSnapshot`
- `ImportRule`
- import enum upgrades
- import source configuration migration

### `20260622193000_sprint4_scraper_framework`

Status: SQL is valid, but historically misordered

Adds:

- `ScraperSource`
- `ScraperRun`
- `ScraperArtifact`
- scraper foreign keys into `ImportJob` and `AuditLog`

This migration must run before anything that alters or references `ScraperSource`.

## Broken Migrations

### `20260622165000_sprint6_monitoring_ops`

Status: Broken in historical order

Failure:

- Executes before `sprint4_scraper_framework`
- Runs `ALTER TABLE "ScraperSource" ...`
- Adds foreign key `SyncRun_sourceId_fkey -> ScraperSource(id)`

Root cause:

- hard dependency on a table introduced by a later timestamped migration

### `20260623170000_sprint65_commerce_foundation`

Status: Broken / incomplete

Failure:

- migration folder exists but `migration.sql` is effectively empty
- does not create the large set of current models introduced after sprint4/sprint6

Impact:

- historical SQL chain creates only 35 tables
- current Prisma schema defines 65 models
- 30 current models are missing from migration history entirely

Missing models from historical SQL chain:

- `BankAccount`
- `BrandSource`
- `BusinessSettings`
- `Cart`
- `CartItem`
- `ConnectorConfiguration`
- `ConnectorExecutionProfile`
- `ConnectorFieldMapping`
- `ConnectorRun`
- `ConnectorTemplate`
- `Country`
- `Currency`
- `CustomerAddress`
- `ExchangeRate`
- `ImportProductResult`
- `NotificationAudit`
- `NotificationChannel`
- `NotificationDelivery`
- `NotificationEvent`
- `NotificationPreference`
- `NotificationTemplate`
- `NotificationTemplateVersion`
- `PaymentAuditLog`
- `PaymentProviderConfig`
- `PaymentRefund`
- `PaymentTransaction`
- `PaymentWebhook`
- `ProcurementTask`
- `ShippingMethod`
- `TaxSettings`

## Dependency Graph

Historical dependency graph:

```text
sprint1_local_setup
  -> sprint2_catalog_foundation
  -> sprint3_import_engine
  -> sprint4_scraper_framework
  -> sprint6_monitoring_ops
  -> sprint65_commerce_foundation

sprint2_catalog_foundation
  -> sprint3_import_engine
  -> sprint6_monitoring_ops
  -> sprint65_commerce_foundation

sprint3_import_engine
  -> sprint4_scraper_framework
  -> sprint6_monitoring_ops
  -> sprint65_commerce_foundation

sprint4_scraper_framework
  -> sprint6_monitoring_ops
  -> sprint65_commerce_foundation

sprint6_monitoring_ops
  -> sprint65_commerce_foundation
```

Broken historical ordering:

```text
timestamp order:
  sprint3 -> sprint6 -> sprint4

required order:
  sprint3 -> sprint4 -> sprint6
```

## Repair Performed

The repository migration history was repaired as follows:

1. Archived the historical chain to:
   - `server/prisma/migrations_archive/20260624_pre_sprint91`
2. Replaced the active migration chain with a single deterministic baseline:
   - `server/prisma/migrations/20260624235000_sprint91_clean_baseline/migration.sql`
3. Kept `server/prisma/migrations/migration_lock.toml` in place
4. Generated the new baseline directly from the current Prisma datamodel with:

```bash
npx prisma migrate diff --from-empty --to-schema-datamodel server/prisma/schema.prisma --script
```

This baseline removes:

- timestamp ordering ambiguity
- missing-table drift
- broken cross-sprint dependencies
- empty migration gaps

## Verification

### What succeeded

- Baseline migration SQL generation from the current schema succeeded.
- Baseline file encoding was corrected to standard UTF-8 without BOM.
- Prisma server typecheck remained valid after migration history repair.

### What blocked full fresh-db proof on this machine

The local PostgreSQL environment is inconsistent with the repository configuration:

- `.env` uses `DATABASE_URL=...127.0.0.1:5433/outlethub`
- the active Windows PostgreSQL service is listening on `5432`
- credentials accepted by the configured `5433` environment are not valid on the live `5432` service

Observed environment mismatch:

- active service: `postgresql-x64-17`
- active listener: `127.0.0.1:5432`
- configured repo port: `127.0.0.1:5433`

Because of that mismatch, full `npx prisma migrate dev` validation against a disposable fresh database could not be completed on the current machine state without additional database credentials or the intended `5433` instance running.

### Expected verification command once the intended database is available

```bash
npx prisma migrate dev --schema server/prisma/schema.prisma --skip-generate
```

Expected result:

- baseline applies cleanly to a fresh database
- shadow database creation succeeds
- no dependency or missing-table errors occur

## Final State

Current active deterministic migration chain:

1. `20260624235000_sprint91_clean_baseline`

Historical migrations preserved for reference:

- `server/prisma/migrations_archive/20260624_pre_sprint91`

## Recommendation

To complete final operational proof, align the runtime database with repository configuration in one of these ways:

1. Start the intended PostgreSQL instance on `5433` with the repo credentials.
2. Or update `.env` to the actual active PostgreSQL instance and valid credentials, then run fresh-db verification again.

