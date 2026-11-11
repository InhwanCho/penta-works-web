package com.pentaworks.monitoring.importedhistory;

import com.pentaworks.monitoring.common.NotFoundException;
import com.pentaworks.monitoring.site.SiteService;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;

/** Reads hospital history and photos retained in the MReyes database. */
@Service
public class ImportedHospitalAssetsService {
    private final ImportedHospitalSnapshot snapshot;

    public ImportedHospitalAssetsService(ObjectProvider<ImportedHospitalSnapshot> snapshots) {
        this.snapshot = snapshots.getIfAvailable();
    }

    public ImportedHospitalAssetsResponse bySite(String rawSiteId, Long companyId) {
        var data = snapshot == null ? null : snapshot.bySite(SiteService.normalizeSiteId(rawSiteId), companyId);
        if (data == null) throw new NotFoundException("병원 이관 데이터를 찾을 수 없습니다.");
        return data;
    }

    public ImportedPhoto photo(String rawSiteId, long maintenanceId, long photoId, Long companyId) {
        var photo = snapshot == null ? null : snapshot.photo(SiteService.normalizeSiteId(rawSiteId), maintenanceId, photoId, companyId);
        if (photo == null) throw new NotFoundException("정비 사진을 찾을 수 없습니다.");
        return photo;
    }

    public record ImportedPhoto(byte[] data, MediaType mediaType) {}
}
