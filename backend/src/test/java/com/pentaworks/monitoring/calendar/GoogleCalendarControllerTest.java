package com.pentaworks.monitoring.calendar;

import com.pentaworks.monitoring.auth.CurrentUserService;
import com.pentaworks.monitoring.common.BadRequestException;
import jakarta.servlet.http.Cookie;
import java.util.*;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import javax.crypto.Cipher;
import javax.crypto.spec.*;
import org.junit.jupiter.api.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.*;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.UriComponentsBuilder;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;
import org.springframework.http.MediaType;

class GoogleCalendarControllerTest {
 JdbcTemplate db; CurrentUserService users; GoogleCalendarController controller;
 final byte[] key=new byte[32];
 @BeforeEach void setup(){
  db=mock(JdbcTemplate.class);users=mock(CurrentUserService.class);controller=new GoogleCalendarController(db,users,mock(org.springframework.context.ApplicationEventPublisher.class));
  when(users.require(null)).thenReturn(new CurrentUserService.CurrentUser(12,1,"test@example.com","Test","USER","ACTIVE"));
  ReflectionTestUtils.setField(controller,"clientId","test-client");ReflectionTestUtils.setField(controller,"clientSecret","test-secret");
  ReflectionTestUtils.setField(controller,"encryptionKey",Base64.getEncoder().encodeToString(key));
  ReflectionTestUtils.setField(controller,"redirectUri","https://dev.example.com/api/v1/integrations/google-calendar/callback");
 }
 @Test void missingConfigurationDoesNotStartAuthorization(){
  ReflectionTestUtils.setField(controller,"clientSecret","");
  assertEquals(false,controller.status(null).get("configured"));
  assertThrows(BadRequestException.class,()->controller.connect(null,new MockHttpServletResponse()));
  verify(db,never()).update(anyString(),any(Object[].class));
 }
 @Test void authorizationUsesExpiringHashedStateAndSecureBrowserCookie(){
  when(db.queryForObject(anyString(),eq(Long.class),eq(12L),eq(1L))).thenReturn(5L);
  var response=new MockHttpServletResponse();String url=controller.connect(null,response).get("url");
  var params=UriComponentsBuilder.fromUri(URI.create(url)).build().getQueryParams();
  assertEquals("https://accounts.google.com",URI.create(url).getScheme()+"://"+URI.create(url).getHost());
  assertNotNull(params.getFirst("state"));assertEquals("offline",params.getFirst("access_type"));
  String cookie=response.getHeader("Set-Cookie");assertTrue(cookie.contains("Secure"));assertTrue(cookie.contains("HttpOnly"));assertTrue(cookie.contains("SameSite=Lax"));
  verify(db).update(contains("INSERT INTO calendar_oauth_state"),matches("[a-f0-9]{64}"),matches("[a-f0-9]{64}"),eq(5L));
 }
 @Test void callbackWithoutBrowserBindingCannotExchangeCode()throws Exception{
  var response=new MockHttpServletResponse();controller.callback("forged","code",null,new MockHttpServletRequest(),response);
  assertEquals("/settings?googleCalendar=failed&calendarError=invalid_state#google-calendar",response.getHeader("Location"));verifyNoInteractions(db);
 }
 void validState(){when(db.queryForList(contains("SELECT s.connection_id"),anyString(),anyString())).thenReturn(List.of(Map.of("connection_id",5L,"user_id",12L,"company_id",1L)));}
 MockHttpServletRequest request(){var r=new MockHttpServletRequest();r.setCookies(new Cookie("mreyes_calendar_oauth","browser-nonce"));return r;}
 @Test void unknownOrExpiredStateCannotConnect()throws Exception{
  var response=new MockHttpServletResponse();controller.callback("unknown","code",null,request(),response);
  assertEquals("/settings?googleCalendar=failed&calendarError=invalid_state#google-calendar",response.getHeader("Location"));
  verify(db,never()).update(anyString(),any(Object[].class));
 }
 @Test void googleTokenFailureDoesNotSaveConnection()throws Exception{
  validState();var builder=RestClient.builder();var server=MockRestServiceServer.bindTo(builder).build();ReflectionTestUtils.setField(controller,"http",builder.build());
  server.expect(requestTo("https://oauth2.googleapis.com/token")).andRespond(withBadRequest());
  var response=new MockHttpServletResponse();controller.callback("nonce","bad-code",null,request(),response);
  assertEquals("/settings?googleCalendar=failed&calendarError=token_http_400#google-calendar",response.getHeader("Location"));
  verify(db,never()).update(contains("status='CONNECTED'"),any(),any(),any());server.verify();
 }
 @Test void consentCancellationConsumesStateWithoutConnecting()throws Exception{
  validState();var response=new MockHttpServletResponse();controller.callback("nonce",null,"access_denied",request(),response);
  assertEquals("/settings?googleCalendar=cancelled#google-calendar",response.getHeader("Location"));
  verify(db).update(contains("DELETE FROM calendar_oauth_state WHERE state_hash"),anyString());
  verify(db,never()).update(contains("status='CONNECTED'"),any(),any(),any());
 }
 @Test void successfulExchangeEncryptsRefreshTokenAndCreatesKoreaCalendar()throws Exception{
  validState();var builder=RestClient.builder();var server=MockRestServiceServer.bindTo(builder).build();ReflectionTestUtils.setField(controller,"http",builder.build());
  server.expect(requestTo("https://oauth2.googleapis.com/token")).andExpect(content().string(org.hamcrest.Matchers.containsString("grant_type=authorization_code")))
   .andRespond(withSuccess("{\"access_token\":\"access-test\",\"refresh_token\":\"refresh-test\"}",MediaType.APPLICATION_JSON));
  server.expect(requestTo("https://www.googleapis.com/calendar/v3/calendars")).andExpect(header("Authorization","Bearer access-test"))
   .andExpect(content().string(org.hamcrest.Matchers.containsString("Asia/Seoul")))
   .andRespond(withSuccess("{\"id\":\"test-calendar\"}",MediaType.APPLICATION_JSON));
  var response=new MockHttpServletResponse();controller.callback("nonce","code",null,request(),response);
  assertEquals("/settings?googleCalendar=connected#google-calendar",response.getHeader("Location"));
  var encrypted=org.mockito.ArgumentCaptor.forClass(String.class);
  verify(db).update(contains("status='CONNECTED'"),eq("test-calendar"),encrypted.capture(),eq(5L));
  assertNotEquals("refresh-test",encrypted.getValue());byte[] bytes=Base64.getDecoder().decode(encrypted.getValue());
  var cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.DECRYPT_MODE,new SecretKeySpec(key,"AES"),new GCMParameterSpec(128,Arrays.copyOf(bytes,12)));
  assertEquals("refresh-test",new String(cipher.doFinal(Arrays.copyOfRange(bytes,12,bytes.length)),StandardCharsets.UTF_8));server.verify();
 }
 @Test void disconnectClearsTokensAndPendingAuthorizationOnlyForCurrentUser(){
  when(db.queryForList(contains("SELECT id FROM user_calendar_connection"),eq(12L),eq(1L))).thenReturn(List.of(Map.of("id",5L)));
  assertEquals(true,controller.disconnect(null).get("disconnected"));
  verify(db).update(contains("DELETE FROM calendar_oauth_state"),eq(5L));
  verify(db).update(contains("refresh_token_encrypted=NULL,status='DISCONNECTED'"),eq(5L));
 }
}
