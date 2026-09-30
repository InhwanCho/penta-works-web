package com.pentaworks.monitoring.company;

import com.pentaworks.monitoring.admin.AuditService;
import com.pentaworks.monitoring.auth.CurrentUserService.CurrentUser;
import com.pentaworks.monitoring.common.BadRequestException;
import com.pentaworks.monitoring.common.ForbiddenException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

@Service
public class CompanyMetricService {
    private static final List<Metric> DEFAULTS = List.of(
        new Metric("recosi", "리콘덴서 Si410 온도", "K", 0, true),
        new Metric("coldtp", "콜드헤드 온도", "K", 1, true),
        new Metric("recoru", "리콘덴서 RuO 온도", "K", 2, true),
        new Metric("hepres", "He Pressure", "psi", 3, true),
        new Metric("heleve", "He Level", "%", 4, true),
        new Metric("actemp", "AC Temp", "°C", 5, true),
        new Metric("achumi", "AC Humidity", "%", 6, true),
        new Metric("gctemp", "그라디언트칠러 온도", "°C", 7, true),
        new Metric("gcflow", "그라디언트칠러 유량", null, 8, true),
        new Metric("cctemp", "콜드칠러 온도", "°C", 9, true),
        new Metric("ccflow", "콜드칠러 유량", null, 10, true));
    private final JdbcTemplate jdbc;
    private final AuditService audit;
    private final Map<Long, Cached> cache = new ConcurrentHashMap<>();
    public CompanyMetricService(JdbcTemplate jdbc, AuditService audit) { this.jdbc = jdbc; this.audit = audit; }

    public List<Metric> metrics(long companyId) {
        Cached cached = cache.get(companyId);
        if (cached != null && cached.until().isAfter(Instant.now())) return cached.metrics();
        Map<String, Metric> stored = new HashMap<>();
        jdbc.query("""
            SELECT metric_key,display_name,unit,sort_order,is_visible
              FROM company_metric_config WHERE company_id=?
            """, (org.springframework.jdbc.core.RowCallbackHandler) rs -> stored.put(rs.getString(1),
                new Metric(rs.getString(1), rs.getString(2), rs.getString(3), rs.getInt(4), rs.getBoolean(5))), companyId);
        List<Metric> values = DEFAULTS.stream().map(metric -> stored.getOrDefault(metric.key(), metric))
            .sorted(Comparator.comparingInt(Metric::sortOrder).thenComparing(Metric::key)).toList();
        if (cache.size() > 1000) cache.entrySet().removeIf(entry -> !entry.getValue().until().isAfter(Instant.now()));
        cache.put(companyId, new Cached(values, Instant.now().plusSeconds(10)));
        return values;
    }

    @Transactional
    public List<Metric> save(CurrentUser actor, List<Metric> requested) {
        if (!actor.isSuperAdmin()) throw new ForbiddenException("회사 최고관리자 권한이 필요합니다.");
        jdbc.queryForObject("SELECT id FROM company WHERE id=? FOR UPDATE", Long.class, actor.companyId());
        if (requested == null || requested.size() != DEFAULTS.size()) throw new BadRequestException("모든 측정항목을 함께 저장해주세요.");
        var allowed = new HashSet<>(DEFAULTS.stream().map(Metric::key).toList());
        List<Metric> normalized = new ArrayList<>();
        for (int i = 0; i < requested.size(); i++) {
            Metric metric = requested.get(i);
            if (metric == null || !allowed.remove(metric.key()) || metric.displayName() == null ||
                metric.displayName().isBlank() || metric.displayName().trim().length() > 80 ||
                (metric.unit() != null && metric.unit().trim().length() > 20))
                throw new BadRequestException("항목 이름(1~80자)과 단위(최대 20자)를 확인해주세요.");
            normalized.add(new Metric(metric.key(), metric.displayName().trim(),
                metric.unit() == null || metric.unit().isBlank() ? null : metric.unit().trim(), i, metric.visible()));
        }
        if (normalized.stream().noneMatch(Metric::visible)) throw new BadRequestException("표시할 측정항목을 하나 이상 선택해주세요.");
        List<Metric> before = metrics(actor.companyId());
        for (Metric metric : normalized) jdbc.update("""
            INSERT INTO company_metric_config (company_id,metric_key,display_name,unit,sort_order,is_visible)
            VALUES (?,?,?,?,?,?) ON DUPLICATE KEY UPDATE display_name=VALUES(display_name),unit=VALUES(unit),
                sort_order=VALUES(sort_order),is_visible=VALUES(is_visible)
            """, actor.companyId(), metric.key(), metric.displayName(), metric.unit(), metric.sortOrder(), metric.visible());
        audit.record(actor, "COMPANY_METRICS_UPDATED", "COMPANY", Long.toString(actor.companyId()),
            Map.of("previous", before, "metrics", normalized));
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override public void afterCommit() { cache.remove(actor.companyId()); }
        });
        return List.copyOf(normalized);
    }

    public record Metric(String key, String displayName, String unit, int sortOrder, boolean visible) {}
    private record Cached(List<Metric> metrics, Instant until) {}
}
