package com.pentaworks.monitoring;

import java.sql.PreparedStatement;
import java.sql.Timestamp;
import java.util.Arrays;
import java.util.List;
import javax.sql.DataSource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

@Service
@ConditionalOnProperty(prefix = "app.mrtb-sync", name = "enabled", havingValue = "true")
public class MrtbSyncService {
    private static final Logger log = LoggerFactory.getLogger(MrtbSyncService.class);
    private static final String SELECT_ROWS = """
        SELECT `index`, date, recosi, coldtp, recoru, hepres, heleve,
               actemp, achumi, gctemp, gcflow, cctemp, ccflow, siteid
          FROM mrtb
         WHERE `index` > ?
         ORDER BY `index`
         LIMIT ?
        """;
    private static final String INSERT_ROWS = """
        INSERT IGNORE INTO mrtb
          (`index`, date, recosi, coldtp, recoru, hepres, heleve,
           actemp, achumi, gctemp, gcflow, cctemp, ccflow, siteid)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """;

    private final JdbcTemplate source;
    private final JdbcTemplate destination;
    private final int batchSize;
    private final int maxBatchesPerRun;

    @Autowired
    public MrtbSyncService(JdbcTemplate destination, MrtbSyncProperties properties) {
        this(new JdbcTemplate(sourceDataSource(properties)), destination,
            properties.getBatchSize(), properties.getMaxBatchesPerRun());
    }

    MrtbSyncService(JdbcTemplate source, JdbcTemplate destination, int batchSize, int maxBatchesPerRun) {
        this.source = source;
        this.destination = destination;
        this.batchSize = Math.max(1, batchSize);
        this.maxBatchesPerRun = Math.max(1, maxBatchesPerRun);
    }

    private static DataSource sourceDataSource(MrtbSyncProperties properties) {
        if (properties.getUrl().isBlank() || properties.getUsername().isBlank()) {
            throw new IllegalStateException("MRTB sync is enabled but source DB connection is not configured");
        }
        DriverManagerDataSource dataSource = new DriverManagerDataSource();
        dataSource.setDriverClassName("org.mariadb.jdbc.Driver");
        dataSource.setUrl(properties.getUrl());
        dataSource.setUsername(properties.getUsername());
        dataSource.setPassword(properties.getPassword());
        return dataSource;
    }

    @Scheduled(fixedDelayString = "${app.mrtb-sync.interval-ms:10000}")
    public void scheduledSync() {
        try {
            int inserted = sync();
            if (inserted > 0) log.info("Synchronized {} mrtb rows from POS", inserted);
        } catch (Exception error) {
            log.warn("Mrtb synchronization failed; the web service will continue running", error);
        }
    }

    int sync() {
        Long destinationMax = destination.queryForObject("SELECT COALESCE(MAX(`index`), 0) FROM mrtb", Long.class);
        long cursor = destinationMax == null ? 0L : destinationMax;
        int inserted = 0;

        for (int batch = 0; batch < maxBatchesPerRun; batch++) {
            List<MrtbRow> rows = source.query(SELECT_ROWS, (result, rowNumber) -> new MrtbRow(
                result.getLong("index"), result.getTimestamp("date"),
                result.getString("recosi"), result.getString("coldtp"), result.getString("recoru"),
                result.getString("hepres"), result.getString("heleve"), result.getString("actemp"),
                result.getString("achumi"), result.getString("gctemp"), result.getString("gcflow"),
                result.getString("cctemp"), result.getString("ccflow"), result.getString("siteid")), cursor, batchSize);

            if (rows.isEmpty()) break;
            int[][] results = destination.batchUpdate(INSERT_ROWS, rows, batchSize, MrtbSyncService::bindRow);
            inserted += Arrays.stream(results).flatMapToInt(Arrays::stream)
                .filter(value -> value > 0 || value == PreparedStatement.SUCCESS_NO_INFO).count();
            cursor = rows.get(rows.size() - 1).index();
            if (rows.size() < batchSize) break;
        }
        return inserted;
    }

    private static void bindRow(PreparedStatement statement, MrtbRow row) throws java.sql.SQLException {
        statement.setLong(1, row.index());
        statement.setTimestamp(2, row.date());
        statement.setString(3, row.recosi());
        statement.setString(4, row.coldtp());
        statement.setString(5, row.recoru());
        statement.setString(6, row.hepres());
        statement.setString(7, row.heleve());
        statement.setString(8, row.actemp());
        statement.setString(9, row.achumi());
        statement.setString(10, row.gctemp());
        statement.setString(11, row.gcflow());
        statement.setString(12, row.cctemp());
        statement.setString(13, row.ccflow());
        statement.setString(14, row.siteid());
    }

    record MrtbRow(long index, Timestamp date, String recosi, String coldtp, String recoru,
                   String hepres, String heleve, String actemp, String achumi, String gctemp,
                   String gcflow, String cctemp, String ccflow, String siteid) {}
}
