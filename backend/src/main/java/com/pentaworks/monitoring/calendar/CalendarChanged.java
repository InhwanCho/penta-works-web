package com.pentaworks.monitoring.calendar;

/** The company's calendar projection may have changed; publish inside the source transaction. */
public record CalendarChanged(long companyId) {}
