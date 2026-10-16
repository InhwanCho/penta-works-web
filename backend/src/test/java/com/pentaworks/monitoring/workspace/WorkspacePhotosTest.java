package com.pentaworks.monitoring.workspace;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import com.pentaworks.monitoring.auth.CurrentUserService;
import com.pentaworks.monitoring.common.*;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.util.*;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
class WorkspacePhotosTest {
 @Test void rejectsDisguisedFilesAndOversizeUploads(){assertThrows(BadRequestException.class,()->WorkspacePhotos.validateImage("<svg onload='alert(1)'/>".getBytes()));assertThrows(BadRequestException.class,()->WorkspacePhotos.validateImage(new byte[20*1024*1024+1]));}
 @Test void preservesValidatedNormalPhotoBytes()throws Exception{var out=new ByteArrayOutputStream();ImageIO.write(new BufferedImage(20,10,BufferedImage.TYPE_INT_RGB),"png",out);var bytes=out.toByteArray();var result=WorkspacePhotos.validateImage(bytes);assertArrayEquals(bytes,result.bytes());assertEquals("image/png",result.mime());assertEquals(20,result.width());assertEquals(10,result.height());}
 @Test void cannotAttachPhotoFromAnotherRecordOrAnotherAuthorsDraft(){var db=mock(JdbcTemplate.class);var u=new CurrentUserService.CurrentUser(1,2,"user@test","User","USER","ACTIVE");var helper=new WorkspacePhotos(db,mock(CurrentUserService.class));when(db.queryForList(contains("byte_size"),eq(3L),eq(2L))).thenReturn(List.of(Map.of("record_id",9L,"author_id",1L,"byte_size",100L)));assertThrows(ForbiddenException.class,()->helper.attach(u,4L,List.of(3L)));var draft=new HashMap<String,Object>();draft.put("record_id",null);draft.put("author_id",99L);draft.put("byte_size",100L);when(db.queryForList(contains("byte_size"),eq(3L),eq(2L))).thenReturn(List.of(draft));assertThrows(ForbiddenException.class,()->helper.attach(u,4L,List.of(3L)));}
 @Test void rejectsDuplicateOrExcessivePhotoIds(){var helper=new WorkspacePhotos(mock(JdbcTemplate.class),mock(CurrentUserService.class));var u=new CurrentUserService.CurrentUser(1,2,"a@b","User","USER","ACTIVE");assertThrows(BadRequestException.class,()->helper.attach(u,1,List.of(2L,2L)));assertThrows(BadRequestException.class,()->helper.attach(u,1,Collections.nCopies(41,2L)));}
}
