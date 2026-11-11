package com.pentaworks.monitoring.importedhistory;

import com.pentaworks.monitoring.auth.CurrentUserService;
import com.pentaworks.monitoring.site.SiteService;
import java.util.concurrent.TimeUnit;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/sites")
public class ImportedHospitalAssetsController {
    private final ImportedHospitalAssetsService service;
    private final CurrentUserService currentUsers;

    public ImportedHospitalAssetsController(ImportedHospitalAssetsService service, CurrentUserService currentUsers) {
        this.service = service;
        this.currentUsers = currentUsers;
    }

    @GetMapping({"/{siteId}/imported-hospital-assets", "/{siteId}/office-assets"})
    public ImportedHospitalAssetsResponse assets(@PathVariable String siteId, Authentication authentication) {
        currentUsers.requireSiteAccess(currentUsers.require(authentication), SiteService.normalizeSiteId(siteId));
        return service.bySite(siteId,currentUsers.require(authentication).companyId());
    }

    @GetMapping({"/{siteId}/imported-hospital-assets/maintenance/{maintenanceId}/photos/{photoId}",
        "/{siteId}/office-assets/maintenance/{maintenanceId}/photos/{photoId}"})
    public ResponseEntity<byte[]> photo(@PathVariable String siteId, @PathVariable long maintenanceId,
        @PathVariable long photoId, Authentication authentication) {
        currentUsers.requireSiteAccess(currentUsers.require(authentication), SiteService.normalizeSiteId(siteId));
        var photo = service.photo(siteId, maintenanceId, photoId,currentUsers.require(authentication).companyId());
        return ResponseEntity.ok()
            .cacheControl(CacheControl.maxAge(1, TimeUnit.DAYS).cachePrivate())
            .contentType(photo.mediaType())
            .body(photo.data());
    }
}
