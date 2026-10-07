package com.pentaworks.monitoring.alert;

import com.pentaworks.monitoring.auth.CurrentUserService;
import com.pentaworks.monitoring.auth.CurrentUserService.CurrentUser;
import com.pentaworks.monitoring.common.ForbiddenException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.security.core.Authentication;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class AlertRecipientControllerTest {
    @Test void regularUserCannotListCreateUpdateOrDeleteRecipients() {
        var users = mock(CurrentUserService.class);
        var service = mock(AlertRecipientService.class);
        var authentication = mock(Authentication.class);
        when(users.require(authentication)).thenReturn(new CurrentUser(1,1,"user@example.com","User","USER","ACTIVE"));
        var controller = new AlertRecipientController(service, users);
        assertThrows(ForbiddenException.class, () -> controller.recipients(authentication));
        assertThrows(ForbiddenException.class, () -> controller.create(new AlertRecipientController.CreateRecipientRequest("001","KAKAO_ALIMTALK","01012345678",null,null,true,1L),authentication));
        assertThrows(ForbiddenException.class, () -> controller.update(1,new AlertRecipientController.UpdateRecipientRequest(null,null,true,"01012345678",1L),authentication));
        assertThrows(ForbiddenException.class, () -> controller.delete(1,authentication));
        verifyNoInteractions(service);
    }

    @ParameterizedTest
    @ValueSource(strings={"ADMIN","SUPER_ADMIN","PLATFORM_ADMIN"})
    void administratorCanManageRecipients(String role) {
        var users = mock(CurrentUserService.class);
        var service = mock(AlertRecipientService.class);
        var authentication = mock(Authentication.class);
        var actor = new CurrentUser(1,1,"admin@example.com","Admin",role,"ACTIVE");
        when(users.require(authentication)).thenReturn(actor);
        var controller = new AlertRecipientController(service,users);
        controller.recipients(authentication);
        controller.create(new AlertRecipientController.CreateRecipientRequest("001","KAKAO_ALIMTALK","01012345678",null,null,true,1L),authentication);
        controller.update(1,new AlertRecipientController.UpdateRecipientRequest(null,null,true,"01012345678",1L),authentication);
        controller.delete(1,authentication);
        verify(service).recipients(actor);
        verify(service).create(eq(actor),any(AlertRecipientService.CreateRecipient.class));
        verify(service).update(eq(actor),eq(1L),any(AlertRecipientService.UpdateRecipient.class));
        verify(service).delete(actor,1L);
    }
}
