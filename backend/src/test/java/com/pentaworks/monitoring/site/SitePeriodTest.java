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
        assertEquals(50, response.take());
        assertEquals("2026-10-02T02:36:56Z", response.lastAt());
        verify(jdbc).query(contains("AND date >= ? AND date <= ?"), any(RowMapper.class),
            eq("016"), eq(Timestamp.from(start)), eq(Timestamp.from(end)), eq(50), eq(50), eq(50), eq(50));
    }
    @Test
    void allowsLatestModeAndPeriodsLongerThanAMonth() {
        Instant start = Instant.parse("2026-10-01T00:00:00Z");
        assertDoesNotThrow(() -> SiteService.validatePeriod(null, null));
        assertDoesNotThrow(() -> SiteService.validatePeriod(start, start.plus(Duration.ofDays(365))));
    }

    @Test
    void rejectsMissingReverseOrEqualPeriod() {
        Instant start = Instant.parse("2026-10-01T00:00:00Z");
        assertThrows(BadRequestException.class, () -> SiteService.validatePeriod(start, null));
        assertThrows(BadRequestException.class, () -> SiteService.validatePeriod(null, start));
        assertThrows(BadRequestException.class, () -> SiteService.validatePeriod(start, start));
        assertThrows(BadRequestException.class, () -> SiteService.validatePeriod(start, start.minusSeconds(1)));
    }
    @Test
    @SuppressWarnings("unchecked")
    void samplesTheWholeLongPeriodUsingTheRequestedCountAndIgnoresLegacyPages() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.query(anyString(), any(ResultSetExtractor.class), eq("008")))
            .thenAnswer(invocation -> invocation.getArgument(0, String.class).startsWith("SELECT site,")
                ? new SiteResponse.SiteSummary("008", "신당서울") : "2026-10-06T05:00:00Z");
        Instant start = Instant.parse("2026-08-01T00:00:00Z"), end = Instant.parse("2026-10-06T00:00:00Z");
        when(jdbc.queryForObject(contains("COUNT(*)"), eq(Long.class), eq("008"),
            eq(Timestamp.from(start)), eq(Timestamp.from(end)))).thenReturn(10023L);
        SiteService service = new SiteService(jdbc);
        SiteResponse second = service.detail("8",50,start,end,2);
        assertEquals(1,second.page());
        assertEquals(50,second.take());
        assertEquals(10023L,second.totalCount());
        SiteResponse last = service.detail("8",50,start,end,Integer.MAX_VALUE);
        assertEquals(1,last.page());
        assertEquals(1,service.detail("8",50,start,end,-1).page());
        verify(jdbc,times(3)).query(contains("ROW_NUMBER() OVER (ORDER BY date, `index`)"),any(RowMapper.class),eq("008"),
            eq(Timestamp.from(start)),eq(Timestamp.from(end)),eq(50),eq(50),eq(50),eq(50));
    }

    @Test
    @SuppressWarnings("unchecked")
    void emptyPeriodKeepsFirstPageAndLatestModeIgnoresPagination() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.query(anyString(),any(ResultSetExtractor.class),eq("008")))
            .thenAnswer(invocation -> invocation.getArgument(0,String.class).startsWith("SELECT site,")
                ? new SiteResponse.SiteSummary("008","신당서울") : "2026-10-06T05:00:00Z");
        Instant start = Instant.parse("2026-08-01T00:00:00Z"), end = start.plus(Duration.ofDays(90));
        when(jdbc.queryForObject(contains("COUNT(*)"),eq(Long.class),eq("008"),
            eq(Timestamp.from(start)),eq(Timestamp.from(end)))).thenReturn(0L);
        var empty = new SiteService(jdbc).detail("8",50,start,end,5);
        assertEquals(0,empty.totalCount());
        assertEquals(1,empty.page());
        var latest = new SiteService(jdbc).detail("8",50,null,null,5);
        assertEquals(50,latest.take());
        assertEquals(1,latest.page());
        verify(jdbc).query(contains("LIMIT ?"),any(RowMapper.class),eq("008"),eq(50));
    }

}
