package com.pentaworks.monitoring.alert;

/** Missing scheduled collection slots since the last received sample, not rolling-window counts. */
public final class CollectionHealth {
    private CollectionHealth() {}

    public static Long missedCount(Long lagMinutes, int intervalMinutes) {
        if (intervalMinutes <= 0) throw new IllegalArgumentException("Collection interval must be positive");
        return lagMinutes == null ? null : Math.max(0, lagMinutes) / intervalMinutes;
    }

    public static boolean isMissing(Long lagMinutes, int intervalMinutes, int threshold) {
        Long missed = missedCount(lagMinutes, intervalMinutes);
        return missed == null || missed >= threshold;
    }
}
