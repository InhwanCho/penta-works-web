package com.pentaworks.monitoring.common;

import com.pentaworks.monitoring.office.OfficeIntegrationException;
import java.time.Instant;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class ApiExceptionHandler {
    @ExceptionHandler(NotFoundException.class)
    ResponseEntity<Map<String, Object>> notFound(NotFoundException error) {
        return response(HttpStatus.NOT_FOUND, error.getMessage());
    }

    @ExceptionHandler(UnauthorizedException.class)
    ResponseEntity<Map<String, Object>> unauthorized(UnauthorizedException error) {
        return response(HttpStatus.UNAUTHORIZED, error.getMessage());
    }

    @ExceptionHandler(OfficeIntegrationException.class)
    ResponseEntity<Map<String, Object>> officeIntegration(OfficeIntegrationException error) {
        return response(error.status(), error.getMessage());
    }

    @ExceptionHandler(Exception.class)
    ResponseEntity<Map<String, Object>> unexpected(Exception error) {
        return response(HttpStatus.INTERNAL_SERVER_ERROR, "요청을 처리하지 못했습니다.");
    }

    private ResponseEntity<Map<String, Object>> response(HttpStatus status, String message) {
        return ResponseEntity.status(status).body(Map.of(
            "status", status.value(), "message", message, "timestamp", Instant.now().toString()));
    }
}
