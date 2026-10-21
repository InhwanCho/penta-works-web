package com.pentaworks.monitoring.workspace;
import java.util.*;
import java.nio.file.*;
import org.springframework.stereotype.Component;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
@Component
@ConditionalOnProperty(name="app.workspace.enabled",havingValue="true")
public class WorkspacePhotoMaintenance {
 private final JdbcTemplate db;private final WorkspacePhotoStorage storage;private final TransactionTemplate tx;
 private static final Logger log=LoggerFactory.getLogger(WorkspacePhotoMaintenance.class);
 public WorkspacePhotoMaintenance(JdbcTemplate db,WorkspacePhotoStorage storage,PlatformTransactionManager manager){this.db=db;this.storage=storage;tx=new TransactionTemplate(manager);}
 private final java.util.concurrent.ExecutorService worker=java.util.concurrent.Executors.newSingleThreadExecutor(r->{var t=new Thread(r,"workspace-photo-maintenance");t.setDaemon(true);return t;});
 private final java.util.concurrent.atomic.AtomicBoolean running=new java.util.concurrent.atomic.AtomicBoolean();
 @jakarta.annotation.PreDestroy public void stop(){worker.shutdownNow();}
 private void dispatch(Runnable action){if(!running.compareAndSet(false,true))return;try{worker.execute(()->{try{action.run();}catch(RuntimeException failure){log.warn("Workspace photo maintenance deferred");}finally{running.set(false);}});}catch(java.util.concurrent.RejectedExecutionException stopped){running.set(false);}}
 @Scheduled(fixedDelay=60000,initialDelay=1000) public void migrateLater(){dispatch(this::migrate);}
 @Scheduled(fixedDelay=3600000,initialDelay=300000) public void cleanupLater(){dispatch(()->{try{cleanup();}catch(java.io.IOException e){throw new IllegalStateException(e);}});}
 public void migrate(){
  for(int batch=0;batch<10;batch++){
   var ids=db.queryForList("SELECT id FROM workspace_photo WHERE storage_key IS NULL AND image_data IS NOT NULL ORDER BY id LIMIT 100",Long.class);if(ids.isEmpty())return;
   int migrated=0;
   for(long id:ids)try{Boolean ok=tx.execute(status->{var rows=db.queryForList("SELECT company_id,mime_type,image_data FROM workspace_photo WHERE id=? AND storage_key IS NULL AND image_data IS NOT NULL FOR UPDATE",id);if(rows.isEmpty())return false;var r=rows.get(0);try{var files=storage.store(((Number)r.get("company_id")).longValue(),(byte[])r.get("image_data"),r.get("mime_type").toString());db.update("UPDATE workspace_photo SET storage_key=?,thumbnail_key=?,content_sha256=?,thumbnail_sha256=?,thumbnail_bytes=?,image_data=NULL WHERE id=? AND storage_key IS NULL",files.key(),files.thumbnailKey(),files.checksum(),files.thumbnailChecksum(),files.thumbnailBytes(),id);return true;}catch(java.io.IOException e){throw new IllegalStateException("Photo migration failed",e);}});if(Boolean.TRUE.equals(ok))migrated++;}catch(RuntimeException error){log.warn("Photo storage migration deferred for photo {}",id);}
   if(migrated==0||ids.size()<100)return;
  }
 }
 public void cleanup()throws java.io.IOException{
  db.update("DELETE FROM workspace_photo WHERE record_id IS NULL AND created_at<DATE_SUB(NOW(),INTERVAL 1 DAY)");
  var keys=new HashSet<String>();for(var row:db.queryForList("SELECT storage_key,thumbnail_key FROM workspace_photo"))for(Object key:row.values())if(key!=null)keys.add(key.toString());
  storage.cleanup(keys,System.currentTimeMillis()-86400000L);
 }
}
