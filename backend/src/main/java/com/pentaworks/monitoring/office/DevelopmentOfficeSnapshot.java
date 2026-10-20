package com.pentaworks.monitoring.office;

import com.fasterxml.jackson.databind.ObjectMapper;
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
    public OfficeAssetsResponse bySite(String siteId) {
        String json=db.query("SELECT response_json FROM workspace_office_snapshot WHERE site_id=?",rs->{return rs.next()?rs.getString(1):null;},siteId);
        if(json==null)return null;
        try {return mapper.readValue(json,OfficeAssetsResponse.class);}
        catch(Exception e){throw new IllegalStateException("개발계 이관 데이터 형식을 확인해주세요.",e);}
    }
    public OfficeAssetsService.OfficePhoto photo(String siteId,long maintenanceId,long photoId) {
        return db.query("SELECT image_data,mime_type FROM workspace_office_photo WHERE site_id=? AND maintenance_id=? AND photo_id=?",rs->{return rs.next()?new OfficeAssetsService.OfficePhoto(rs.getBytes(1),MediaType.parseMediaType(rs.getString(2))):null;},siteId,maintenanceId,photoId);
    }
}
