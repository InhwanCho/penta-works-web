package com.pentaworks.monitoring.office;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.pentaworks.monitoring.common.NotFoundException;
import java.util.HashSet;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/** Isolated, explicitly imported source snapshot for the development workspace. */
@Service
@ConditionalOnProperty(name="app.workspace.enabled",havingValue="true")
public class DevelopmentOfficeSnapshot {
    private final JdbcTemplate db;
    private final ObjectMapper mapper;
    public DevelopmentOfficeSnapshot(JdbcTemplate db,ObjectMapper mapper) {this.db=db;this.mapper=mapper;}
    public OfficeAssetsResponse bySite(String siteId) {return bySite(siteId,null);}
    public OfficeAssetsResponse bySite(String siteId,Long companyId) {
        String json=db.query("SELECT response_json FROM workspace_office_snapshot WHERE site_id=?",rs->{return rs.next()?rs.getString(1):null;},siteId);
        if(json==null) {
            if(companyId==null)return null;
            return db.query("SELECT h.id,h.name,p.address,h.notes FROM workspace_hospital h JOIN site s ON s.site=h.site_id LEFT JOIN site_profile p ON p.site_id=h.site_id WHERE h.company_id=? AND h.site_id=?",rs->rs.next()?new OfficeAssetsResponse(new OfficeAssetsResponse.Site(rs.getLong(1),siteId,rs.getString(2),null,rs.getString(3),rs.getString(4)),java.util.List.of(),java.util.List.of(),java.util.List.of(),java.time.Instant.now().toString()):null,companyId,siteId);
        }
        try {
            var response=mapper.readValue(json,OfficeAssetsResponse.class);
            if(companyId==null)return response;
            requireCompany(siteId,companyId);
            var records=new HashSet<>(db.queryForList("SELECT source_id FROM workspace_record WHERE company_id=? AND source_id LIKE ?",String.class,companyId,"office:"+siteId+":maintenance:%"));
            var assets=new HashSet<>(db.queryForList("SELECT source_id FROM workspace_asset WHERE company_id=? AND site_id=? AND source_id IS NOT NULL",String.class,companyId,siteId));
            // Retain the snapshot. Only the items already represented in the tenant's new tables disappear here.
            String prefix="office:"+siteId+":";
            return new OfficeAssetsResponse(response.site(),
                response.equipment().stream().filter(e->!assets.contains(prefix+"equipment:"+e.id())).toList(),
                response.components().stream().filter(c->!assets.contains(prefix+"component:"+c.id())).toList(),
                response.maintenanceHistory().stream().filter(r->!records.contains(prefix+"maintenance:"+r.id())).toList(),response.generatedAt());
        }
        catch(NotFoundException e){throw e;}
        catch(Exception e){throw new IllegalStateException("개발계 이관 데이터 형식을 확인해주세요.",e);}
    }
    private void requireCompany(String siteId,long companyId) {
        if(!Boolean.TRUE.equals(db.queryForObject("SELECT EXISTS(SELECT 1 FROM workspace_office_snapshot WHERE site_id=? AND company_id=?)",Boolean.class,siteId,companyId)))throw new NotFoundException("병원 이관 데이터를 찾을 수 없습니다.");
    }
    public OfficeAssetsService.OfficePhoto photo(String siteId,long maintenanceId,long photoId) {return photo(siteId,maintenanceId,photoId,null);}
    public OfficeAssetsService.OfficePhoto photo(String siteId,long maintenanceId,long photoId,Long companyId) {
        if(companyId!=null) {
            requireCompany(siteId,companyId);
            String source="office:"+siteId+":maintenance:"+maintenanceId;
            if(Boolean.TRUE.equals(db.queryForObject("SELECT EXISTS(SELECT 1 FROM workspace_record WHERE company_id=? AND source_id=?)",Boolean.class,companyId,source))) {
                var photo=db.query("SELECT p.image_data,p.mime_type FROM workspace_photo p JOIN workspace_record r ON r.id=p.record_id AND r.company_id=p.company_id WHERE r.company_id=? AND r.source_id=? AND r.deleted_at IS NULL AND r.site_id=? AND p.source_id=?",rs->rs.next()?new OfficeAssetsService.OfficePhoto(rs.getBytes(1),MediaType.parseMediaType(rs.getString(2))):null,companyId,source,siteId,"office:"+siteId+":photo:"+maintenanceId+":"+photoId);
                if(photo==null)throw new NotFoundException("사진을 찾을 수 없습니다.");
                return photo;
            }
        }
        return db.query("SELECT image_data,mime_type FROM workspace_office_photo WHERE site_id=? AND maintenance_id=? AND photo_id=?",rs->{return rs.next()?new OfficeAssetsService.OfficePhoto(rs.getBytes(1),MediaType.parseMediaType(rs.getString(2))):null;},siteId,maintenanceId,photoId);
    }
}
