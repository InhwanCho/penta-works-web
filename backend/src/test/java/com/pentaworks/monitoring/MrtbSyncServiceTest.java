package com.pentaworks.monitoring;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

class MrtbSyncServiceTest {
    @Test
    @SuppressWarnings("unchecked")
    void copiesRowsAfterDestinationMaxIndex() {
        JdbcTemplate source = mock(JdbcTemplate.class);
        JdbcTemplate destination = mock(JdbcTemplate.class);
        Timestamp measuredAt = Timestamp.from(Instant.parse("2026-09-28T03:00:00Z"));
        MrtbSyncService.MrtbRow row = new MrtbSyncService.MrtbRow(
            238419L, measuredAt, "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "001");

        when(destination.queryForObject("SELECT COALESCE(MAX(`index`), 0) FROM mrtb", Long.class)).thenReturn(238418L);
        when(source.query(any(String.class), any(RowMapper.class), anyLong(), anyInt())).thenReturn(List.of(row));
        when(destination.batchUpdate(any(String.class), eq(List.of(row)), eq(1000), any())).thenReturn(new int[][] {{1}});

        MrtbSyncService service = new MrtbSyncService(source, destination, 1000, 100);

        assertEquals(1, service.sync());
        verify(source).query(any(String.class), any(RowMapper.class), eq(238418L), eq(1000));
    }
}
