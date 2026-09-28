package com.pentaworks.monitoring.alert;

public record AlertThreshold(String key, String label, String unit,
                             Double min, Double max, boolean active) {}
