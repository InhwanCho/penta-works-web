package com.pentaworks.monitoring.admin;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.pentaworks.monitoring.auth.CurrentUserService.CurrentUser;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

@Service
public class AuditService {
    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;

    public AuditService(JdbcTemplate jdbcTemplate, ObjectMapper objectMapper) {
        this.jdbcTemplate = jdbcTemplate;
        this.objectMapper = objectMapper;
    }

    public void record(CurrentUser actor, String action, String targetType, String targetId,
                       Map<String, ?> afterData) {
        jdbcTemplate.update("""
            INSERT INTO audit_log
                (company_id,actor_user_id,actor_name,action,target_type,target_id,after_data,created_at)
            VALUES (?,?,?,?,?,?,?,CURRENT_TIMESTAMP(6))
            """, actor.companyId(), actor.id(), actor.name(), action, targetType, targetId, json(afterData));
    }

    private String json(Map<String, ?> value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException error) {
            throw new IllegalStateException("감사 로그를 기록하지 못했습니다.", error);
        }
    }
}
