package com.pentaworks.monitoring.workspace;

import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.*;
import java.nio.*;
import java.nio.channels.FileChannel;
import java.nio.file.*;
import java.nio.file.attribute.PosixFilePermissions;
import java.security.MessageDigest;
import java.util.*;
import javax.imageio.*;
import javax.imageio.stream.MemoryCacheImageOutputStream;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;

@Component
@ConditionalOnProperty(name="app.workspace.enabled",havingValue="true")
public class WorkspacePhotoStorage {
 private final Path root;
 public WorkspacePhotoStorage(@Value("${app.workspace.photos-directory:./data/workspace-photos}") String directory){root=Path.of(directory).toAbsolutePath().normalize();}
 public record Stored(String key,String thumbnailKey,String checksum,String thumbnailChecksum,long thumbnailBytes){}
 static String sha(byte[] bytes){try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));}catch(Exception e){throw new IllegalStateException(e);}}
 Path path(String key){if(key==null||!key.matches("c[1-9][0-9]*/[a-f0-9-]{36}/(full\\.(jpg|png|gif)|preview.jpg)"))throw new IllegalArgumentException("Invalid photo key");Path p=root.resolve(key).normalize();if(!p.startsWith(root))throw new IllegalArgumentException("Invalid photo path");for(Path ancestor=p;ancestor!=null&&ancestor.startsWith(root);ancestor=ancestor.getParent())if(Files.isSymbolicLink(ancestor))throw new IllegalArgumentException("Photo symlinks are forbidden");return p;}
 private static void directory(Path p)throws IOException{Files.createDirectories(p);Files.setPosixFilePermissions(p,PosixFilePermissions.fromString("rwx------"));}
 private void write(String key,byte[] bytes)throws IOException{Path p=path(key);directory(root);directory(p.getParent().getParent());directory(p.getParent());Path temp=Files.createTempFile(p.getParent(),".writing-",".tmp");try{Files.setPosixFilePermissions(temp,PosixFilePermissions.fromString("rw-------"));try(var channel=FileChannel.open(temp,StandardOpenOption.WRITE)){ByteBuffer buffer=ByteBuffer.wrap(bytes);while(buffer.hasRemaining())channel.write(buffer);channel.force(true);}Files.move(temp,p,StandardCopyOption.ATOMIC_MOVE);}finally{Files.deleteIfExists(temp);}}
 public void cleanup(Set<String> referenced,long before)throws IOException{
  if(!Files.exists(root))return;
  try(var paths=Files.walk(root)){for(Path p:paths.filter(x->Files.isRegularFile(x,LinkOption.NOFOLLOW_LINKS)).toList()){
   String key=root.relativize(p).toString().replace(java.io.File.separatorChar,'/');
   if(key.matches("c[1-9][0-9]*/[a-f0-9-]{36}/(full\\.(jpg|png|gif)|preview.jpg)")&&!referenced.contains(key)&&Files.getLastModifiedTime(p).toMillis()<before)Files.deleteIfExists(path(key));
  }}
 }
 public byte[] read(String key)throws IOException{return Files.readAllBytes(path(key));}
 public Stored store(long company,byte[] full,String mime)throws IOException{
  String ext=switch(mime){case "image/jpeg"->"jpg";case "image/png"->"png";case "image/gif"->"gif";default->throw new IOException("Unsupported image type");};
  byte[] thumb=thumbnail(full);String prefix="c"+company+"/"+UUID.randomUUID()+"/",key=prefix+"full."+ext,preview=prefix+"preview.jpg";
  write(key,full);write(preview,thumb);
  // DB is switched only after both exact bytes and the preview have been read back and verified.
  if(!sha(full).equals(sha(read(key)))||!sha(thumb).equals(sha(read(preview))))throw new IOException("Photo write verification failed");
  return new Stored(key,preview,sha(full),sha(thumb),thumb.length);
 }
 static byte[] thumbnail(byte[] bytes)throws IOException{
  BufferedImage input;
  try(var stream=ImageIO.createImageInputStream(new ByteArrayInputStream(bytes))){var readers=ImageIO.getImageReaders(stream);if(!readers.hasNext())throw new IOException("Unsupported photo");var reader=readers.next();try{reader.setInput(stream);int w=reader.getWidth(0),h=reader.getHeight(0);if(w<=0||h<=0||(long)w*h>80_000_000L)throw new IOException("Photo dimensions exceed limit");input=reader.read(0);}finally{reader.dispose();}}
  if(input==null)throw new IOException("Unreadable photo");double scale=Math.min(1,500.0/Math.max(input.getWidth(),input.getHeight()));int w=Math.max(1,(int)Math.round(input.getWidth()*scale)),h=Math.max(1,(int)Math.round(input.getHeight()*scale));
  BufferedImage small=new BufferedImage(w,h,BufferedImage.TYPE_INT_RGB);Graphics2D g=small.createGraphics();g.setColor(Color.WHITE);g.fillRect(0,0,w,h);g.setRenderingHint(RenderingHints.KEY_INTERPOLATION,RenderingHints.VALUE_INTERPOLATION_BICUBIC);g.drawImage(input,0,0,w,h,null);g.dispose();input.flush();
  int orientation=orientation(bytes);BufferedImage result=new BufferedImage(orientation>=5?h:w,orientation>=5?w:h,BufferedImage.TYPE_INT_RGB);
  for(int y=0;y<h;y++)for(int x=0;x<w;x++){int dx=x,dy=y;switch(orientation){case 2->dx=w-1-x;case 3->{dx=w-1-x;dy=h-1-y;}case 4->dy=h-1-y;case 5->{dx=y;dy=x;}case 6->{dx=h-1-y;dy=x;}case 7->{dx=h-1-y;dy=w-1-x;}case 8->{dx=y;dy=w-1-x;}}result.setRGB(dx,dy,small.getRGB(x,y));}
  var output=new ByteArrayOutputStream();var writer=ImageIO.getImageWritersByFormatName("jpeg").next();try(var stream=new MemoryCacheImageOutputStream(output)){writer.setOutput(stream);var params=writer.getDefaultWriteParam();params.setCompressionMode(ImageWriteParam.MODE_EXPLICIT);params.setCompressionQuality(.80f);writer.write(null,new IIOImage(result,null,null),params);}finally{writer.dispose();small.flush();result.flush();}return output.toByteArray();
 }
 // JPEG EXIF orientation is applied to previews; the full file remains byte-for-byte intact.
 static int orientation(byte[] bytes){try{if(bytes.length<4||(bytes[0]&255)!=255||(bytes[1]&255)!=216)return 1;int at=2;while(at+4<=bytes.length){if((bytes[at]&255)!=255)break;int marker=bytes[at+1]&255;if(marker==218||marker==217)break;int length=((bytes[at+2]&255)<<8)|(bytes[at+3]&255);if(length<2||at+2+length>bytes.length)break;if(marker==225&&length>=16&&bytes[at+4]=='E'&&bytes[at+5]=='x'&&bytes[at+6]=='i'&&bytes[at+7]=='f'&&bytes[at+8]==0&&bytes[at+9]==0){int base=at+10,end=at+2+length;ByteBuffer b=ByteBuffer.wrap(bytes).order(bytes[base]=='I'?ByteOrder.LITTLE_ENDIAN:ByteOrder.BIG_ENDIAN);if(b.getShort(base+2)!=42)return 1;long offset=Integer.toUnsignedLong(b.getInt(base+4));if(offset>end-base-2)return 1;int dir=base+(int)offset,count=Short.toUnsignedInt(b.getShort(dir));for(int i=0;i<count;i++){int entry=dir+2+12*i;if(entry+12>end)return 1;if(Short.toUnsignedInt(b.getShort(entry))==274&&b.getShort(entry+2)==3&&b.getInt(entry+4)==1){int value=Short.toUnsignedInt(b.getShort(entry+8));return value>=1&&value<=8?value:1;}}}at+=2+length;}}catch(RuntimeException ignored){}return 1;}
}
