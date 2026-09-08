package com.pentaworks.monitoring.alert;

public record PsiThreshold(String siteid, String name, Double min, Double max, boolean active) {}
