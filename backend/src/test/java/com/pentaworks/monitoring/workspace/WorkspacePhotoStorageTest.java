package com.pentaworks.monitoring.workspace;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import java.awt.image.BufferedImage;
import java.io.*;
import java.nio.file.*;
import java.util.*;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.SimpleTransactionStatus;
class WorkspacePhotoStorageTest {
 @TempDir Path temp;
 byte[] picture(int width,int height)throws Exception{var out=new ByteArrayOutputStream();var image=new BufferedImage(width,height,BufferedImage.TYPE_INT_RGB);for(int y=0;y<height;y++)for(int x=0;x<width;x++)image.setRGB(x,y,((x*313+y*23)&0xffffff));ImageIO.write(image,"jpeg",out);return out.toByteArray();}
 @Test void fullBytesArePreservedAndPreviewIsBoundedAndIndependent()throws Exception{
  var bytes=picture(1800,1200);var store=new WorkspacePhotoStorage(temp.toString());var saved=store.store(7,bytes,"image/jpeg");assertArrayEquals(bytes,store.read(saved.key()));assertEquals(WorkspacePhotoStorage.sha(bytes),saved.checksum());var preview=ImageIO.read(new ByteArrayInputStream(store.read(saved.thumbnailKey())));assertEquals(500,preview.getWidth());assertTrue(preview.getHeight()<500);assertTrue(saved.thumbnailBytes()<bytes.length);assertTrue(saved.key().startsWith("c7/"));
 }
 @Test void previewHonorsPhoneExifRotation()throws Exception{
  byte[] original=picture(1200,800);var out=new ByteArrayOutputStream();out.write(original,0,2);
  byte[] exif={69,120,105,102,0,0,73,73,42,0,8,0,0,0,1,0,18,1,3,0,1,0,0,0,6,0,0,0,0,0,0,0};out.write(255);out.write(225);out.write(0);out.write(exif.length+2);out.write(exif);out.write(original,2,original.length-2);
  assertEquals(6,WorkspacePhotoStorage.orientation(out.toByteArray()));var thumbnail=ImageIO.read(new ByteArrayInputStream(WorkspacePhotoStorage.thumbnail(out.toByteArray())));assertEquals(500,thumbnail.getHeight());assertTrue(thumbnail.getWidth()<500);
 }
 @Test void rejectsTraversalAndSymlinkKeys()throws Exception{
  var store=new WorkspacePhotoStorage(temp.toString());assertThrows(IllegalArgumentException.class,()->store.read("../secret"));assertThrows(IllegalArgumentException.class,()->store.read("c1/../../secret"));
  Path outside=Files.createTempDirectory("mreyes-photo-outside-");try{Files.createSymbolicLink(temp.resolve("c1"),outside);assertThrows(IllegalArgumentException.class,()->store.read("c1/11111111-1111-1111-1111-111111111111/full.jpg"));}finally{Files.deleteIfExists(outside);}
 }
 @Test void cleanupNeverRemovesReferencedOrNewFiles()throws Exception{
  var store=new WorkspacePhotoStorage(temp.toString());var saved=store.store(1,picture(100,50),"image/jpeg");long later=System.currentTimeMillis()+1000;store.cleanup(Set.of(saved.key(),saved.thumbnailKey()),later);assertTrue(Files.exists(store.path(saved.key())));store.cleanup(Set.of(),0);assertTrue(Files.exists(store.path(saved.key())));store.cleanup(Set.of(),later);assertFalse(Files.exists(store.path(saved.key())));
 }
 @Test void failedMigrationKeepsBlobAvailable(){
  var db=mock(JdbcTemplate.class);var store=mock(WorkspacePhotoStorage.class);var manager=mock(PlatformTransactionManager.class);when(manager.getTransaction(any())).thenReturn(new SimpleTransactionStatus());when(db.queryForList(anyString(),eq(Long.class))).thenReturn(List.of(1L));when(db.queryForList(contains("FOR UPDATE"),eq(1L))).thenReturn(List.of(Map.of("company_id",1L,"mime_type","image/jpeg","image_data",new byte[]{1})));
  try{when(store.store(anyLong(),any(),anyString())).thenThrow(new IOException("disk full"));}catch(IOException impossible){throw new AssertionError(impossible);}new WorkspacePhotoMaintenance(db,store,manager).migrate();verify(db,never()).update(contains("image_data=NULL"),any(Object[].class));
 }
}
