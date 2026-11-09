package com.pentaworks.monitoring.alert;

import com.pentaworks.monitoring.dashboard.DashboardResponse.DashboardRow;
import com.pentaworks.monitoring.dashboard.DashboardService.MetricSample;
import java.time.Instant;
import java.time.LocalDate;
import java.util.*;

public final class CompanyAlertEvaluation {
    private CompanyAlertEvaluation() {}
    public record Signal(String key, String label, String type, String unit, Double value, Double limit,
                         boolean triggered, boolean recovered) {}
    public record State(boolean enabled, String collectionLevel, Map<String,CompanyAlertRules.Reading> readings,
                        boolean pressureQuiet, @com.fasterxml.jackson.annotation.JsonIgnore List<Signal> signals) {}
    public static State evaluate(CompanyAlertPolicyService.Policy policy, SiteAlertSettings site, DashboardRow row,
                                 List<MetricSample> history, LocalDate replacement, Instant now, Long effectiveLag,
                                 boolean monitoring) {
        if (!site.alertsEnabled() || !monitoring || row.lastAt() == null)
            return new State(site.alertsEnabled(),"NORMAL",Map.of(),false,List.of());
        int interval = site.collectionIntervalMinutes();
        boolean quiet = CompanyAlertPolicyService.settling(replacement,now);
        Long missed = CollectionHealth.missedCount(effectiveLag,interval);
        boolean stopped = missed == null || missed >= policy.collectionCritical();
        String collection = stopped ? "RED" : missed >= policy.collectionWarning() ? "YELLOW" : "NORMAL";
        List<Signal> signals = new ArrayList<>();
        int received = CompanyAlertRules.streak(history,interval,s -> true);
        signals.add(new Signal("__data__","병원 전체 수집 중단","NO_DATA","분",effectiveLag == null ? null : effectiveLag.doubleValue(),
            (double)(interval * policy.collectionCritical()),stopped,!stopped && received >= 2));
        Map<String,CompanyAlertRules.Reading> readings = new LinkedHashMap<>();
        // A collection gap suppresses individual missing/range incidents until measurements resume.
        if (stopped || history.isEmpty() || !history.get(0).at().equals(Instant.parse(row.lastAt())))
            return new State(true,collection,readings,quiet,signals);
        for (var t : site.thresholds()) {
            if (!t.active()) continue;
            String key = t.key();
            Double value = row.metrics().get(key);
            boolean pressure = key.equals("hepres");
            Double critical = pressure ? Double.valueOf(policy.pressureCritical())
                : key.equals("gctemp") ? Double.valueOf(policy.gradientCritical()) : null;
            int high = critical == null ? 0 : CompanyAlertRules.streak(history,interval,s -> {
                Double v = s.metrics().get(key);
                return CompanyAlertRules.measured(v) && v > critical;
            });
            int missing = pressure ? CompanyAlertRules.streak(history,interval,s -> !CompanyAlertRules.measured(s.metrics().get(key))) : 0;
            var reading = CompanyAlertRules.reading(key,value,t.averageValue(),policy.tolerancePercent(),
                pressure ? policy.pressureWarning() : null,critical,high,missing,policy.missingWarning(),policy.missingCritical(),pressure && quiet);
            if (pressure && !reading.level().equals("RED")) {
                int rising = CompanyAlertRules.risingPressureStreak(history,interval,t.averageValue());
                if (rising >= 5) reading = new CompanyAlertRules.Reading("YELLOW",rising,"평균 위에서 상승",t.averageValue(),7);
            }
            readings.put(key,reading);
            if (critical != null) {
                int normal = CompanyAlertRules.streak(history,interval,s -> {
                    Double v = s.metrics().get(key);
                    return CompanyAlertRules.measured(v) && v <= critical;
                });
                signals.add(new Signal(key,t.label(),"HIGH",t.unit(),value,critical,high >= 2,normal >= 2));
            }
            if (pressure) {
                int valid = CompanyAlertRules.streak(history,interval,s -> CompanyAlertRules.measured(s.metrics().get(key)));
                signals.add(new Signal(key,t.label()+" 측정 누락","METRIC_MISSING","회",(double)missing,(double)policy.missingCritical(),
                    missing >= policy.missingCritical(),valid >= 2));
            }
        }
        if (site.coldChillerActive()) {
            boolean cold = CompanyAlertRules.chillerStopped(history.get(0));
            int normal = CompanyAlertRules.streak(history,interval,CompanyAlertRules::chillerNormal);
            signals.add(new Signal("__cold_chiller__","콜드칠러 정지 의심","HIGH","°C",row.metrics().get("cctemp"),0.1,cold,normal >= 2));
            if (cold) {
                readings.put("cctemp",new CompanyAlertRules.Reading("RED",1,"정지 의심",null,1));
                readings.put("ccflow",new CompanyAlertRules.Reading("RED",1,"정지 의심",null,1));
            }
        }
        return new State(true,collection,readings,quiet,signals);
    }
}
