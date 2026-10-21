# Strict measurement parsing and average repair

User confirmed pressure corrections: site 013 at 2026-10-20 12:04:04 raw HEX 320E333835 -> 2.285; site 010 at 2026-10-21 07:43:04 raw HEX 30393330 -> 0.930. The 2.385 value inferred from neighbors was explicitly NOT chosen.

V52 stores original bytes and correction reason in measurement_correction, then updates only exactly matching local mrtb readings. It also replaces numeric generated-column parsing for all 11 metrics. Upstream collection is untouched (MrtbSyncService uses INSERT IGNORE). Complete numeric tokens with known suffix units are accepted; embedded controls, split/garbled numbers, and ambiguous zero-padded integers are excluded. No decimal position guessing or physical maximum clipping. Existing unmeasured numeric sentinels remain excluded.

DashboardService.parseNumber applies the same token grammar. V53 rebuilds all retained hourly average snapshots so historical fallback cannot reintroduce the old invalid averages. Hourly preaggregation keeps the rebuild bounded to the retained history range. Averages now use corrected readings and omit invalid ones.

Validation: DashboardMeasurementTest and RollingAverageServiceTest; bootJar; actual MariaDB TEMPORARY table execution of both migrations with malformed examples, confirmed corrections, valid large readings and snapshot averages. Read-only production preview identified additional corrupted strings across the existing measurement history.

Pre-deployment full database backups (gzip verified):
- /home/inhwan/backups/mreyes-prod/before-strict-parsing-20261021.sql.gz
- /home/inhwan/backups/mreyes-dev/before-strict-parsing-20261021.sql.gz

Local diagnostic scripts and outputs are under output/average-investigation-20261021 (untracked).
