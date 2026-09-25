package com.pentaworks.monitoring.office;

import java.util.concurrent.TimeUnit;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/sites")
public class OfficeAssetsController {
    private final OfficeAssetsService service;

    public OfficeAssetsController(OfficeAssetsService service) {
        this.service = service;
    }

    @GetMapping("/{siteId}/office-assets")
    public OfficeAssetsResponse assets(@PathVariable String siteId) {
        return service.bySite(siteId);
    }

    @GetMapping("/{siteId}/office-assets/maintenance/{maintenanceId}/photos/{photoId}")
    public ResponseEntity<byte[]> photo(@PathVariable String siteId, @PathVariable long maintenanceId,
        @PathVariable long photoId) {
        var photo = service.photo(siteId, maintenanceId, photoId);
        return ResponseEntity.ok()
            .cacheControl(CacheControl.maxAge(1, TimeUnit.DAYS).cachePrivate())
            .contentType(photo.mediaType())
            .body(photo.data());
    }
}
