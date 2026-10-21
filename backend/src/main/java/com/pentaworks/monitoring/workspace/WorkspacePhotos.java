package com.pentaworks.monitoring.workspace;

import com.pentaworks.monitoring.auth.CurrentUserService;
import com.pentaworks.monitoring.auth.CurrentUserService.CurrentUser;
import com.pentaworks.monitoring.common.*;
import java.awt.Color;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.*;
import java.util.*;
import javax.imageio.ImageIO;
import javax.imageio.stream.ImageInputStream;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/v1/workspace/photos")
@ConditionalOnProperty(name="app.workspace.enabled",havingValue="true")
public class WorkspacePhotos {
    static final long MAX_BYTES=10L*1024*1024, MAX_TOTAL=200L*1024*1024;
    static final int MAX_COUNT=40;
    private final JdbcTemplate db;
    private final CurrentUserService users;
    public WorkspacePhotos(JdbcTemplate db,CurrentUserService users){this.db=db;this.users=users;}
    @GetMapping("/limits")
    public Map<String,Object> limits(){return Map.of("maxFileBytes",MAX_BYTES,"maxTotalBytes",MAX_TOTAL,"maxCount",MAX_COUNT,"formats",List.of("JPEG","PNG","GIF"));}
    record ImageData(byte[] bytes,String mime,int width,int height) {}
    static ImageData validateImage(byte[] bytes) {
        if(bytes.length==0||bytes.length>MAX_BYTES)throw new BadRequestException("사진 한 장은 10MB 이하여야 합니다.");
        try(ImageInputStream stream=ImageIO.createImageInputStream(new ByteArrayInputStream(bytes))){
            var readers=ImageIO.getImageReaders(stream);if(!readers.hasNext())throw new BadRequestException("JPG·PNG·GIF 사진을 선택해주세요. HEIC·WebP는 JPG로 변환 후 첨부해주세요.");
            var reader=readers.next();
            try {
                reader.setInput(stream,true,true);int w=reader.getWidth(0),h=reader.getHeight(0);
                if(w<=0||h<=0||(long)w*h>80_000_000L)throw new BadRequestException("사진 해상도가 너무 큽니다. 8천만 화소 이하로 첨부해주세요.");
                String format=reader.getFormatName().toLowerCase(Locale.ROOT);
                String mime=switch(format){case "jpeg","jpg"->"image/jpeg";case "png"->"image/png";case "gif"->"image/gif";default->throw new BadRequestException("JPG·PNG·GIF 사진만 첨부할 수 있습니다.");};
                BufferedImage image=reader.read(0);if(image==null)throw new BadRequestException("사진을 읽을 수 없습니다.");
                // Keep normal uploads byte-for-byte (including EXIF orientation). Larger files
                // are resized in the browser before upload; this fallback also bounds DB packets.
                if(bytes.length<=8L*1024*1024)return new ImageData(bytes,mime,w,h);
                int width=(int)Math.round(w*Math.min(1,2560.0/Math.max(w,h))),height=(int)Math.round(h*Math.min(1,2560.0/Math.max(w,h)));
                BufferedImage scaled=new BufferedImage(width,height,BufferedImage.TYPE_INT_RGB);var g=scaled.createGraphics();g.setColor(Color.WHITE);g.fillRect(0,0,width,height);g.setRenderingHint(RenderingHints.KEY_INTERPOLATION,RenderingHints.VALUE_INTERPOLATION_BICUBIC);g.drawImage(image,0,0,width,height,null);g.dispose();
                ByteArrayOutputStream output=new ByteArrayOutputStream();ImageIO.write(scaled,"jpeg",output);return new ImageData(output.toByteArray(),"image/jpeg",width,height);
            } finally {reader.dispose();}
        }catch(IOException error){throw new BadRequestException("손상되었거나 읽을 수 없는 사진입니다.");}
    }
    @PostMapping @Transactional
    public Map<String,Object> upload(@RequestParam("file") MultipartFile file,Authentication auth) throws IOException {
        var u=users.require(auth);if(file.isEmpty()||file.getSize()>MAX_BYTES)throw new BadRequestException("사진 한 장은 10MB 이하여야 합니다.");
        db.queryForList("SELECT id FROM app_user WHERE id=? FOR UPDATE",u.id());
        // Unsaved uploads expire after a day; committed record photos are not touched.
        db.update("DELETE FROM workspace_photo WHERE company_id=? AND author_id=? AND record_id IS NULL AND created_at<DATE_SUB(NOW(),INTERVAL 1 DAY)",u.companyId(),u.id());
        Long staged=db.queryForObject("SELECT COALESCE(SUM(byte_size),0) FROM workspace_photo WHERE company_id=? AND author_id=? AND record_id IS NULL",Long.class,u.companyId(),u.id());
        if(staged+file.getSize()>MAX_TOTAL)throw new BadRequestException("작성 중인 사진 합계는 200MB 이하여야 합니다. 사용하지 않는 사진을 제거해주세요.");
        var image=validateImage(file.getBytes());String name=Objects.toString(file.getOriginalFilename(),"photo").replaceAll("[\\\\/\\p{Cntrl}]","_");if(name.length()>255)name=name.substring(name.length()-255);
        db.update("INSERT INTO workspace_photo(company_id,author_id,original_name,mime_type,image_data,byte_size,width_px,height_px) VALUES(?,?,?,?,?,?,?,?)",u.companyId(),u.id(),name,image.mime(),image.bytes(),image.bytes().length,image.width(),image.height());
        long id=db.queryForObject("SELECT LAST_INSERT_ID()",Long.class);return Map.of("id",id,"name",name,"byteSize",image.bytes().length,"width",image.width(),"height",image.height());
    }
    private Map<String,Object> photo(CurrentUser u,long id){
        var rows=db.queryForList("SELECT p.id,p.author_id authorId,p.record_id recordId,p.mime_type mimeType,r.site_id siteId,r.deleted_at recordDeleted FROM workspace_photo p LEFT JOIN workspace_record r ON r.id=p.record_id WHERE p.id=? AND p.company_id=?",id,u.companyId());
        if(rows.isEmpty())throw new NotFoundException("사진을 찾을 수 없습니다.");var r=rows.get(0);
        if(r.get("recordId")==null){if(((Number)r.get("authorId")).longValue()!=u.id())throw new NotFoundException("사진을 찾을 수 없습니다.");}
        else {if(r.get("recordDeleted")!=null)throw new NotFoundException("사진을 찾을 수 없습니다.");if(r.get("siteId")!=null)users.requireSiteAccess(u,r.get("siteId").toString());}
        return r;
    }
    @GetMapping
    public List<Map<String,Object>> list(@RequestParam long recordId,Authentication auth){var u=users.require(auth);var rows=db.queryForList("SELECT site_id FROM workspace_record WHERE id=? AND company_id=? AND deleted_at IS NULL",recordId,u.companyId());if(rows.isEmpty())throw new NotFoundException("기록을 찾을 수 없습니다.");if(rows.get(0).get("site_id")!=null)users.requireSiteAccess(u,rows.get(0).get("site_id").toString());return db.queryForList("SELECT id,original_name name,byte_size byteSize,width_px width,height_px height FROM workspace_photo WHERE record_id=? AND company_id=? ORDER BY id",recordId,u.companyId());}
    @GetMapping("/{id}/metadata")
    public Map<String,Object> metadata(@PathVariable long id,Authentication auth){var u=users.require(auth);photo(u,id);return db.queryForMap("SELECT id,original_name name,byte_size byteSize,width_px width,height_px height FROM workspace_photo WHERE id=? AND company_id=?",id,u.companyId());}
    @GetMapping("/{id}")
    public ResponseEntity<byte[]> image(@PathVariable long id,Authentication auth){var u=users.require(auth);var r=photo(u,id);byte[] bytes=db.queryForObject("SELECT image_data FROM workspace_photo WHERE id=?",byte[].class,id);return ResponseEntity.ok().contentType(MediaType.parseMediaType(r.get("mimeType").toString())).header("X-Content-Type-Options","nosniff").cacheControl(CacheControl.noStore()).body(bytes);}
    @DeleteMapping("/{id}")
    public Map<String,Boolean> remove(@PathVariable long id,Authentication auth){var u=users.require(auth);var r=photo(u,id);if(r.get("recordId")!=null)throw new BadRequestException("저장된 사진은 작업일지 수정 화면에서 제거해주세요.");db.update("DELETE FROM workspace_photo WHERE id=? AND company_id=? AND author_id=? AND record_id IS NULL",id,u.companyId(),u.id());return Map.of("deleted",true);}
    void attach(CurrentUser u,long recordId,List<Long> requested){
        if(requested==null)return;
        if(requested.stream().anyMatch(Objects::isNull)||requested.size()>MAX_COUNT||new HashSet<>(requested).size()!=requested.size())throw new BadRequestException("사진은 중복 없이 최대 40장 첨부할 수 있습니다.");
        db.queryForList("SELECT id FROM workspace_record WHERE id=? AND company_id=? FOR UPDATE",recordId,u.companyId());
        long total=0;for(long id:requested.stream().sorted().toList()){
            var rows=db.queryForList("SELECT record_id,author_id,byte_size FROM workspace_photo WHERE id=? AND company_id=? FOR UPDATE",id,u.companyId());
            if(rows.isEmpty())throw new BadRequestException("첨부 사진을 찾을 수 없습니다.");var p=rows.get(0);Object parent=p.get("record_id");
            if(parent==null&&((Number)p.get("author_id")).longValue()!=u.id()||parent!=null&&((Number)parent).longValue()!=recordId)throw new ForbiddenException("다른 기록의 사진을 첨부할 수 없습니다.");total+=((Number)p.get("byte_size")).longValue();
        }
        if(total>MAX_TOTAL)throw new BadRequestException("기록당 사진 합계는 200MB 이하여야 합니다.");
        for(var row:db.queryForList("SELECT id FROM workspace_photo WHERE record_id=? AND company_id=?",recordId,u.companyId())){long id=((Number)row.get("id")).longValue();if(!requested.contains(id))db.update("DELETE FROM workspace_photo WHERE id=? AND record_id=?",id,recordId);}
        for(long id:requested)db.update("UPDATE workspace_photo SET record_id=? WHERE id=? AND company_id=?",recordId,id,u.companyId());
    }
}
