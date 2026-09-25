package com.pentaworks.monitoring.office;

import org.springframework.http.HttpStatus;

public class OfficeIntegrationException extends RuntimeException {
    private final HttpStatus status;

    public OfficeIntegrationException(HttpStatus status, String message) {
        super(message);
        this.status = status;
    }

    public HttpStatus status() { return status; }
}
