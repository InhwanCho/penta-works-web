package com.pentaworks.monitoring.site;

import com.pentaworks.monitoring.common.BadRequestException;
import java.time.Instant;
import java.time.Duration;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.ResultSetExtractor;
import org.springframework.jdbc.core.RowMapper;
import java.sql.Timestamp;

class SitePeriodTest {
    @Test
    @SuppressWarnings("unchecked")
    void periodUsesBoundedParametersAndKeepsActualLatestCollectionTime() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.query(anyString(), any(ResultSetExtractor.class), eq("016")))
            .thenAnswer(invocation -> invocation.getArgument(0, String.class).startsWith("SELECT site,")
                ? new SiteResponse.SiteSummary("016", "대구동물") : "2026-10-02T02:36:56Z");
        Instant start = Instant.parse("2026-10-01T00:00:00Z"), end = start.plus(Duration.ofDays(1));
        SiteResponse response = new SiteService(jdbc).detail("16", 50, start, end);
        assertEquals(5000, response.take());
        assertEquals("2026-10-02T02:36:56Z", response.lastAt());
        verify(jdbc).query(contains("AND date >= ? AND date <= ?"), any(RowMapper.class),
            eq("016"), eq(Timestamp.from(start)), eq(Timestamp.from(end)), eq(5000));
    }
    @Test
    void allowsLatestModeAndUpTo31Days() {
        Instant start = Instant.parse("2026-10-01T00:00:00Z");
        assertDoesNotThrow(() -> SiteService.validatePeriod(null, null));
        assertDoesNotThrow(() -> SiteService.validatePeriod(start, start.plus(Duration.ofDays(31))));
    }

    @Test
    void rejectsMissingReverseEqualOrExcessivePeriod() {
        Instant start = Instant.parse("2026-10-01T00:00:00Z");
        assertThrows(BadRequestException.class, () -> SiteService.validatePeriod(start, null));
        assertThrows(BadRequestException.class, () -> SiteService.validatePeriod(null, start));
        assertThrows(BadRequestException.class, () -> SiteService.validatePeriod(start, start));
        assertThrows(BadRequestException.class, () -> SiteService.validatePeriod(start, start.minusSeconds(1)));
        assertThrows(BadRequestException.class, () -> SiteService.validatePeriod(start, start.plus(Duration.ofDays(31)).plusSeconds(1)));
    }
}
