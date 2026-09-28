package com.pentaworks.monitoring;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("app.mrtb-sync")
public class MrtbSyncProperties {
    private boolean enabled;
    private String url = "";
    private String username = "";
    private String password = "";
    private int batchSize = 1_000;
    private int maxBatchesPerRun = 100;

    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }
    public String getUrl() { return url; }
    public void setUrl(String url) { this.url = url; }
    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }
    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }
    public int getBatchSize() { return batchSize; }
    public void setBatchSize(int batchSize) { this.batchSize = batchSize; }
    public int getMaxBatchesPerRun() { return maxBatchesPerRun; }
    public void setMaxBatchesPerRun(int maxBatchesPerRun) { this.maxBatchesPerRun = maxBatchesPerRun; }
}
