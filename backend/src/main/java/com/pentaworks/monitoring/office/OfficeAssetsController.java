package com.pentaworks.monitoring.office;

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
}
