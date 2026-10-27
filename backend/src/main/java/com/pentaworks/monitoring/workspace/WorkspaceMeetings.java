package com.pentaworks.monitoring.workspace;

import com.pentaworks.monitoring.admin.AuditService;
import com.pentaworks.monitoring.auth.CurrentUserService;
import com.pentaworks.monitoring.auth.CurrentUserService.CurrentUser;
import com.pentaworks.monitoring.common.*;
import java.sql.Statement;
import java.time.LocalDateTime;
import java.util.*;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/workspace/meetings")
@ConditionalOnProperty(name="app.workspace.enabled",havingValue="true")
public class WorkspaceMeetings {
    private final JdbcTemplate db;
    private final CurrentUserService users;
    private final AuditService audit;
    public WorkspaceMeetings(JdbcTemplate db,CurrentUserService users,AuditService audit) {this.db=db;this.users=users;this.audit=audit;}
    public record Input(String title,LocalDateTime meetingAt,String contentMarkdown,String participantNames,Long revision) {}
    static final String SELECT="""
        SELECT id,title,DATE_FORMAT(meeting_at,'%Y-%m-%dT%H:%i') meetingAt,
          content_markdown contentMarkdown,author_id authorId,author_name authorName,
          updated_by_name updatedByName,participant_names participantNames,revision,
          DATE_FORMAT(updated_at,'%Y-%m-%d %H:%i') updatedAt
        FROM workspace_meeting WHERE company_id=? AND deleted_at IS NULL
        """;
    private boolean allowed(CurrentUser user) {
        return Boolean.TRUE.equals(db.queryForObject("SELECT EXISTS(SELECT 1 FROM company WHERE id=? AND code='PENTAWORKS' AND status='ACTIVE')",Boolean.class,user.companyId()));
    }
    private CurrentUser require(Authentication auth) {
        var user=users.require(auth);
        if(!allowed(user))throw new ForbiddenException("펜타웍스 사내 회의록입니다.");
        return user;
    }
    @GetMapping("/access") public Map<String,Boolean> access(Authentication auth) {return Map.of("allowed",allowed(users.require(auth)));}
    @GetMapping public List<Map<String,Object>> list(Authentication auth) {
        var user=require(auth);return db.queryForList(SELECT+" ORDER BY meeting_at DESC,id DESC",user.companyId());
    }
    private Map<String,Object> find(long id,CurrentUser user) {
        var rows=db.queryForList(SELECT+" AND id=?",user.companyId(),id);
        if(rows.isEmpty())throw new NotFoundException("회의록을 찾을 수 없습니다.");
        return rows.get(0);
    }
    @GetMapping("/{id}") public Map<String,Object> get(@PathVariable long id,Authentication auth) {return find(id,require(auth));}
    static void validate(Input input) {
        if(input.meetingAt()==null)throw new BadRequestException("회의 일시를 입력해주세요.");
        if(input.title()==null||input.title().isBlank()||input.title().trim().length()>200)throw new BadRequestException("제목을 200자 이내로 입력해주세요.");
        if(input.contentMarkdown()==null||input.contentMarkdown().length()>250000||input.contentMarkdown().replaceAll("(?is)<h2\\b[^>]*>\\s*(지난주 진행 내용|진행 중인 일·이슈|이번 주·예정 작업)\\s*</h2>","").replaceAll("<[^>]*>","").replaceAll("&nbsp;|\\s","").isBlank())throw new BadRequestException("회의 내용을 입력해주세요.");
        if(input.participantNames()!=null&&input.participantNames().length()>1000)throw new BadRequestException("참석자는 1,000자 이내로 입력해주세요.");
    }
    @PostMapping @Transactional public Map<String,Long> create(@RequestBody Input input,Authentication auth) {
        var user=require(auth);validate(input);
        var key=new GeneratedKeyHolder();
        db.update(connection->{
            var statement=connection.prepareStatement("INSERT INTO workspace_meeting(company_id,title,meeting_at,content_markdown,author_id,author_name,updated_by_id,updated_by_name,participant_names) VALUES(?,?,?,?,?,?,?,?,?)",Statement.RETURN_GENERATED_KEYS);
            statement.setLong(1,user.companyId());statement.setString(2,input.title().trim());statement.setObject(3,input.meetingAt());statement.setString(4,input.contentMarkdown());statement.setLong(5,user.id());statement.setString(6,user.name());statement.setLong(7,user.id());statement.setString(8,user.name());statement.setString(9,Objects.toString(input.participantNames(),"").trim());return statement;
        },key);
        long id=Objects.requireNonNull(key.getKey()).longValue();
        audit.record(user,"CREATE","MEETING",String.valueOf(id),Map.of("title",input.title().trim()));
        return Map.of("id",id);
    }
    @PutMapping("/{id}") @Transactional public void update(@PathVariable long id,@RequestBody Input input,Authentication auth) {
        var user=require(auth);validate(input);find(id,user);
        if(input.revision()==null)throw new ConflictException("최신 회의록을 다시 열어주세요.");
        int changed=db.update("UPDATE workspace_meeting SET title=?,meeting_at=?,content_markdown=?,participant_names=?,updated_by_id=?,updated_by_name=?,updated_at=CURRENT_TIMESTAMP(6),revision=revision+1 WHERE id=? AND company_id=? AND deleted_at IS NULL AND revision=?",input.title().trim(),input.meetingAt(),input.contentMarkdown(),Objects.toString(input.participantNames(),"").trim(),user.id(),user.name(),id,user.companyId(),input.revision());
        if(changed==0)throw new ConflictException("다른 사람이 수정했습니다. 최신 회의록을 다시 열어주세요.");
        audit.record(user,"UPDATE","MEETING",String.valueOf(id),Map.of("title",input.title().trim()));
    }
    @DeleteMapping("/{id}") @Transactional public void delete(@PathVariable long id,@RequestParam long revision,Authentication auth) {
        var user=require(auth);var row=find(id,user);
        if(!user.isAdmin()&&!Objects.equals(((Number)Optional.ofNullable(row.get("authorId")).orElse(-1L)).longValue(),user.id()))throw new ForbiddenException("작성자 또는 관리자만 삭제할 수 있습니다.");
        if(db.update("UPDATE workspace_meeting SET deleted_at=CURRENT_TIMESTAMP(6),revision=revision+1 WHERE id=? AND company_id=? AND deleted_at IS NULL AND revision=?",id,user.companyId(),revision)==0)throw new ConflictException("다른 사람이 수정했습니다. 최신 회의록을 다시 열어주세요.");
        audit.record(user,"DELETE","MEETING",String.valueOf(id),Map.of("title",row.get("title")));
    }
}
