package com.pentaworks.monitoring.privacy;

import com.pentaworks.monitoring.auth.CurrentUserService;
import com.pentaworks.monitoring.auth.CurrentUserService.CurrentUser;
import com.pentaworks.monitoring.admin.AdminAccountService;
import com.pentaworks.monitoring.admin.AuditService;
import com.pentaworks.monitoring.common.*;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/privacy/requests")
public class PrivacyRequestController {
    private final JdbcTemplate db; private final CurrentUserService users;
    private final AuditService audit; private final AdminAccountService accounts;
    public PrivacyRequestController(JdbcTemplate db,CurrentUserService users,AuditService audit,AdminAccountService accounts){this.db=db;this.users=users;this.audit=audit;this.accounts=accounts;}
    public record Create(String kind,String content){}
    public record Review(String status,String response,boolean identityVerified){}
    public record DeleteAccount(String confirmationEmail,boolean identityVerified){}
    static void validate(Create input){
        if(input==null||input.kind()==null||!Set.of("ACCESS","CORRECT","DELETE_ACCOUNT","ERASURE","STOP").contains(input.kind()))throw new BadRequestException("요청 종류를 선택해주세요.");
        if(input.content()==null||input.content().isBlank()||input.content().length()>3000)throw new BadRequestException("요청 내용을 3000자 이내로 입력해주세요.");
    }
    private void admin(CurrentUser u){if(!u.isSuperAdmin())throw new ForbiddenException("개인정보 요청은 최고관리자만 처리할 수 있습니다.");}
    private static final String SELECT="""
      SELECT p.id,p.user_id userId,p.kind,p.content,p.status,p.response_text response,
             p.identity_verified identityVerified,p.created_at createdAt,p.updated_at updatedAt,
             u.name,u.email,u.status accountStatus
      FROM privacy_request p JOIN app_user u ON u.id=p.user_id AND u.company_id=p.company_id
      WHERE p.company_id=?
      """;
    @GetMapping public List<Map<String,Object>> mine(Authentication auth){var u=users.require(auth);return db.queryForList(SELECT+" AND p.user_id=? ORDER BY p.created_at DESC LIMIT 100",u.companyId(),u.id());}
    @PostMapping @Transactional public Map<String,String> create(@RequestBody Create input,Authentication auth){
        var u=users.require(auth);validate(input);
        db.queryForObject("SELECT id FROM app_user WHERE id=? FOR UPDATE",Long.class,u.id());
        Integer count=db.queryForObject("SELECT COUNT(*) FROM privacy_request WHERE user_id=? AND status IN ('RECEIVED','REVIEWING')",Integer.class,u.id());
        if(count!=null&&count>=3)throw new BadRequestException("처리 중인 요청이 3건 있습니다. 기존 요청의 처리 결과를 확인해주세요.");
        String id=UUID.randomUUID().toString();db.update("INSERT INTO privacy_request(id,company_id,user_id,kind,content) VALUES(?,?,?,?,?)",id,u.companyId(),u.id(),input.kind(),input.content().trim());
        audit.record(u,"PRIVACY_REQUEST_CREATED","PRIVACY_REQUEST",id,Map.of("kind",input.kind()));return Map.of("id",id);
    }
    @GetMapping("/manage") public List<Map<String,Object>> manage(Authentication auth){var u=users.require(auth);admin(u);return db.queryForList(SELECT+" ORDER BY FIELD(p.status,'RECEIVED','REVIEWING','COMPLETED','REJECTED'),p.created_at DESC LIMIT 300",u.companyId());}
    private Map<String,Object> owned(String id,CurrentUser u){var rows=db.queryForList("SELECT * FROM privacy_request WHERE id=? AND company_id=? FOR UPDATE",id,u.companyId());if(rows.isEmpty())throw new NotFoundException("요청을 찾을 수 없습니다.");return rows.get(0);}
    @PatchMapping("/{id}") @Transactional public Map<String,Boolean> review(@PathVariable String id,@RequestBody Review input,Authentication auth){
        var u=users.require(auth);admin(u);var row=owned(id,u);
        if(input==null||input.status()==null||!Set.of("REVIEWING","COMPLETED","REJECTED").contains(input.status())||input.response()==null||input.response().isBlank()||input.response().length()>3000)throw new BadRequestException("상태와 요청자에게 보낼 처리 내용을 입력해주세요.");
        if(Set.of("COMPLETED","REJECTED").contains(Objects.toString(row.get("status"))))throw new BadRequestException("종료된 요청은 수정할 수 없습니다.");
        if("COMPLETED".equals(input.status())&&!input.identityVerified())throw new BadRequestException("본인 및 요청 권한 확인 후 완료해주세요.");
        db.update("UPDATE privacy_request SET status=?,response_text=?,identity_verified=?,handled_by=? WHERE id=?",input.status(),input.response().trim(),input.identityVerified(),u.id(),id);
        audit.record(u,"PRIVACY_REQUEST_REVIEWED","PRIVACY_REQUEST",id,Map.of("status",input.status()));return Map.of("saved",true);
    }
    @PostMapping("/{id}/delete-account") @Transactional public Map<String,Boolean> deleteAccount(@PathVariable String id,@RequestBody DeleteAccount input,Authentication auth){
        var u=users.require(auth);admin(u);var row=owned(id,u);
        if(!"DELETE_ACCOUNT".equals(row.get("kind"))||!Set.of("RECEIVED","REVIEWING").contains(row.get("status")))throw new BadRequestException("진행 중인 계정 삭제 요청만 처리할 수 있습니다.");
        if(input==null||!input.identityVerified())throw new BadRequestException("본인 및 삭제 범위를 먼저 확인해주세요.");
        accounts.deleteUser(u,((Number)row.get("user_id")).longValue(),input.confirmationEmail());
        db.update("UPDATE privacy_request SET status='COMPLETED',identity_verified=TRUE,handled_by=?,response_text=? WHERE id=?",u.id(),"계정 식별정보를 익명화하고 로그인·알림·Google 연결을 중지했습니다. 회사 업무기록과 보존 목적의 감사기록은 유지됩니다. 기록 본문·사진의 삭제는 별도 요청 범위에 따라 검토합니다.",id);
        return Map.of("deleted",true);
    }
}
