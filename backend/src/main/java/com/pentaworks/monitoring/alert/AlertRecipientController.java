package com.pentaworks.monitoring.alert;

import com.pentaworks.monitoring.alert.AlertRecipientService.CreateRecipient;
import com.pentaworks.monitoring.alert.AlertRecipientService.RecipientSummary;
import com.pentaworks.monitoring.alert.AlertRecipientService.UpdateRecipient;
import com.pentaworks.monitoring.auth.CurrentUserService;
import com.pentaworks.monitoring.auth.CurrentUserService.CurrentUser;
import com.pentaworks.monitoring.common.ForbiddenException;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.LocalTime;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/alerts/recipients")
public class AlertRecipientController {
    private final AlertRecipientService recipients;
    private final CurrentUserService currentUsers;

    public AlertRecipientController(AlertRecipientService recipients, CurrentUserService currentUsers) {
        this.recipients = recipients;
        this.currentUsers = currentUsers;
    }

    @GetMapping
    public List<RecipientSummary> recipients(Authentication authentication) {
        return recipients.recipients(requireAdmin(authentication));
    }

    @PostMapping
    public RecipientSummary create(@Valid @RequestBody CreateRecipientRequest request,
                                   Authentication authentication) {
        return recipients.create(requireAdmin(authentication), new CreateRecipient(
            request.siteId(), request.channel(), request.destination(), request.quietStart(), request.quietEnd(), request.enabled(), request.userId()));
    }

    @PatchMapping("/{id}")
    public RecipientSummary update(@PathVariable long id, @Valid @RequestBody UpdateRecipientRequest request,
                                   Authentication authentication) {
        return recipients.update(requireAdmin(authentication), id,
            new UpdateRecipient(request.quietStart(), request.quietEnd(), request.enabled(), request.destination(), request.userId()));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable long id, Authentication authentication) {
        recipients.delete(requireAdmin(authentication), id);
        return ResponseEntity.noContent().build();
    }

    private CurrentUser requireAdmin(Authentication authentication) {
        CurrentUser actor = currentUsers.require(authentication);
        if (!actor.isAdmin()) throw new ForbiddenException("수신처 관리는 관리자만 사용할 수 있습니다.");
        return actor;
    }

    public record CreateRecipientRequest(@NotBlank String siteId, String channel, @NotBlank String destination,
                                         LocalTime quietStart, LocalTime quietEnd, @NotNull Boolean enabled, Long userId) {}
    public record UpdateRecipientRequest(LocalTime quietStart, LocalTime quietEnd, @NotNull Boolean enabled, String destination, Long userId) {}
}
