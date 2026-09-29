package com.pentaworks.monitoring.auth;

import com.pentaworks.monitoring.common.ForbiddenException;
import com.pentaworks.monitoring.common.UnauthorizedException;
import java.util.LinkedHashSet;
import java.util.Set;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;

@Service
public class CurrentUserService {
    private final JdbcTemplate jdbcTemplate;

    public CurrentUserService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public CurrentUser require(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            throw new UnauthorizedException("로그인이 필요합니다.");
        }
        CurrentUser user = jdbcTemplate.query("""
            SELECT u.id,u.company_id,u.email,u.name,u.role,u.status
              FROM app_user u JOIN company c ON c.id=u.company_id
             WHERE u.email=? AND c.status='ACTIVE'
               AND (u.role<>'PLATFORM_ADMIN' OR c.code='PENTAWORKS')
            """, rs -> rs.next() ? new CurrentUser(rs.getLong("id"), rs.getLong("company_id"),
                rs.getString("email"), rs.getString("name"), rs.getString("role"), rs.getString("status")) : null,
            authentication.getName());
        if (user == null || !"ACTIVE".equals(user.status())) {
            throw new UnauthorizedException("사용할 수 없는 계정입니다.");
        }
        return user;
    }

    public Set<String> allowedSiteIds(CurrentUser user) {
        String sql;
        Object[] args;
        if (user.isAdmin()) {
            sql = "SELECT site_id FROM company_site WHERE company_id=? ORDER BY site_id";
            args = new Object[] {user.companyId()};
        } else {
            sql = "SELECT site_id FROM user_site WHERE user_id=? ORDER BY site_id";
            args = new Object[] {user.id()};
        }
        return new LinkedHashSet<>(jdbcTemplate.query(sql, (rs, row) -> rs.getString(1), args));
    }

    public void requireSiteAccess(CurrentUser user, String siteId) {
        if (!allowedSiteIds(user).contains(siteId)) {
            throw new ForbiddenException("이 사업장에 접근할 권한이 없습니다.");
        }
    }

    public record CurrentUser(long id, long companyId, String email, String name, String role, String status) {
        public boolean isPlatformAdmin() { return "PLATFORM_ADMIN".equals(role); }
        public boolean isSuperAdmin() { return isPlatformAdmin() || "SUPER_ADMIN".equals(role); }
        public boolean isAdmin() { return isSuperAdmin() || "ADMIN".equals(role); }
    }
}
