package com.pentaworks.monitoring.auth;

import com.pentaworks.monitoring.config.AppProperties;
import com.pentaworks.monitoring.common.UnauthorizedException;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

@org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable(named="MREYES_QA_DATABASE", matches="true")
class AuthMariaDbVerificationTest {
    JdbcTemplate jdbc;
    TransactionTemplate tx;
    AuthService service;
    final AppProperties properties = new AppProperties(null,
        new AppProperties.Jwt("test-only-random-secret-with-at-least-32-bytes",43200,365,false),null,null);

    AuthService newService() {
        JwtTokens tokens=mock(JwtTokens.class);
        when(tokens.issue(anyLong(),anyString(),anyString(),anyString(),anyString()))
          .thenReturn(new JwtTokens.AccessToken("qa-jwt", Instant.now().plusSeconds(3600)));
        return new AuthService(jdbc,tokens,new BCryptPasswordEncoder(4),properties,mock(SessionRegistry.class));
    }
    @BeforeEach void setup() throws Exception {
        var ds=new DriverManagerDataSource("jdbc:mariadb://127.0.0.1:13316/mreyes_auth_qa","root","local-qa-only");
        jdbc=new JdbcTemplate(ds);
        tx=new TransactionTemplate(new DataSourceTransactionManager(ds));
        jdbc.execute("DROP TABLE IF EXISTS user_session");
        jdbc.execute("DROP TABLE IF EXISTS app_user");
        jdbc.execute("DROP TABLE IF EXISTS company");
        jdbc.execute("CREATE TABLE company(id BIGINT PRIMARY KEY,code VARCHAR(50),status VARCHAR(20))");
        jdbc.execute("CREATE TABLE app_user(id BIGINT PRIMARY KEY,company_id BIGINT,email VARCHAR(254),password_hash VARCHAR(255),name VARCHAR(100),role VARCHAR(30),status VARCHAR(20),failed_login_count INT DEFAULT 0,locked_until DATETIME(6),last_login_at DATETIME(6),updated_at DATETIME(6))");
        jdbc.execute("CREATE TABLE user_session(id CHAR(36) PRIMARY KEY,user_id BIGINT,refresh_token_hash CHAR(64) UNIQUE,device_name VARCHAR(120),ip_address VARCHAR(45),last_used_at DATETIME(6),expires_at DATETIME(6),created_at DATETIME(6),revoked_at DATETIME(6))");
        jdbc.update("INSERT INTO company VALUES(1,'PENTAWORKS','ACTIVE')");
        jdbc.update("INSERT INTO app_user(id,company_id,email,password_hash,name,role,status) VALUES(1,1,'qa@example.com',?,'QA','USER','ACTIVE')",new BCryptPasswordEncoder(4).encode("qa-password"));
        service=newService();
    }
    String login() { return service.login("qa@example.com","qa-password","127.0.0.1","QA").refreshToken(); }
    String refresh(AuthService s,String token) { return tx.execute(status -> s.refresh(token,"127.0.0.1","QA").refreshToken()); }

    @Test void existingDevicesContinueWithoutSchemaMigration() throws Exception {
        String before=login();
        assertNotNull(refresh(service,before));
        assertEquals(1,jdbc.queryForObject("SELECT COUNT(*) FROM user_session",Integer.class));
    }
    @Test void tenSimultaneousRefreshesPreserveDeviceCredential() throws Exception {
        String original=login(); var pool=Executors.newFixedThreadPool(10);
        var start=new CountDownLatch(1); List<Future<String>> futures=new ArrayList<>();
        try {
            for(int i=0;i<10;i++) futures.add(pool.submit(()->{start.await(); return refresh(newService(),original);}));
            start.countDown(); Set<String> successors=new HashSet<>();
            for(var f:futures) successors.add(f.get(15,TimeUnit.SECONDS));
            assertEquals(1,successors.size()); assertTrue(successors.contains(original));
            assertEquals(successors.iterator().next(),refresh(service,original));
        } finally {pool.shutdownNow();}
    }
    @Test void lostResponseRecoversAcrossServiceRestart() throws Exception {
        String original=login(); String successor=refresh(service,original);
        assertEquals(successor,refresh(newService(),original));
        assertEquals(successor,refresh(newService(),successor));
    }
    @Test void lostResponseAfterLongSleepStillRestoresSession() {
        String original=login(); refresh(service,original);
        jdbc.update("UPDATE user_session SET last_used_at=DATE_SUB(CURRENT_TIMESTAMP(6),INTERVAL 1 DAY)");
        assertEquals(original,refresh(newService(),original));
    }
    @Test void defaultLogoutPreservesOtherDevice() {
        String original=login(); String otherDevice=login();
        tx.executeWithoutResult(status -> service.logout(original));
        assertThrows(UnauthorizedException.class,()->refresh(service,original));
        assertEquals(otherDevice,refresh(service,otherDevice));
    }
    @Test void explicitAllDeviceLogoutRevokesBothDevices() {
        String original=login(); String otherDevice=login();
        tx.executeWithoutResult(status -> service.logout(original,true));
        for(String token:List.of(original,otherDevice)) assertThrows(UnauthorizedException.class,()->refresh(service,token));
    }
    @Test void expiryAndAccountSuspensionStillBlockRefresh() throws Exception {
        String original=login();
        jdbc.update("UPDATE app_user SET status='SUSPENDED'");
        assertThrows(UnauthorizedException.class,()->refresh(service,original));
        jdbc.update("UPDATE app_user SET status='ACTIVE'");
        jdbc.update("UPDATE user_session SET expires_at=DATE_SUB(CURRENT_TIMESTAMP(6),INTERVAL 1 DAY)");
        assertThrows(UnauthorizedException.class,()->refresh(service,original));
    }
}
