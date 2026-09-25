package com.pentaworks.monitoring.office;

import java.util.List;

public record OfficeAssetsResponse(Site site, List<Equipment> equipment, List<Component> components,
    List<Maintenance> maintenanceHistory, String generatedAt) {
    public record Site(long id, String mreyesSiteId, String name, String region, String address, String notes) {}
    public record Equipment(long id, String equipmentType, String manufacturer, String model, String serialNumber,
        String magneticFieldTesla, String softwareVersion, String installedAt, String status) {}
    public record Component(long id, long equipmentId, String name, String componentType, String partNumber,
        String serialNumber, String installedAt, String replacedAt, String status, String notes) {}
    public record Maintenance(long id, String equipmentName, String modelName, String serviceType, String serviceTitle,
        String engineerName, String symptom, String description, String contractType, String workDate,
        String workStartTime, String workEndTime, String specialNotes, String partsDetails, String remarks,
        String followUp, String status, String completedAt, String updatedAt, int photoCount) {}
}
