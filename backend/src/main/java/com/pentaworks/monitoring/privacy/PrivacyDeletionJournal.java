package com.pentaworks.monitoring.privacy;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.ByteBuffer;
import java.nio.channels.FileChannel;
import java.nio.file.*;
import java.nio.file.attribute.PosixFilePermissions;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.*;

/** Outside the SQL backup: unresolved prepared entries make restore fail closed. */
@Service
public class PrivacyDeletionJournal {
    private final JdbcTemplate db;
    private final ObjectMapper json;
    private final Path directory;
    public PrivacyDeletionJournal(JdbcTemplate db,ObjectMapper json,
            @Value("${app.privacy.journal-directory:./data/privacy-journal}") String directory) {
        this.db=db;this.json=json;this.directory=Path.of(directory);
    }
    public void prepare(long company,long user) {
        if(!TransactionSynchronizationManager.isSynchronizationActive())throw new IllegalStateException("Deletion requires a transaction");
        var created=db.queryForObject("SELECT created_at FROM app_user WHERE id=? AND company_id=?",java.sql.Timestamp.class,user,company);
        if(created==null)throw new IllegalStateException("Missing account identity");
        String id=UUID.randomUUID().toString();
        var entry=new LinkedHashMap<String,Object>();entry.put("id",id);entry.put("company",company);entry.put("user",user);entry.put("created",created.toLocalDateTime().toString());
        append(entry,"PREPARE");
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization(){
            @Override public void afterCompletion(int status){append(entry,status==STATUS_COMMITTED?"COMMIT":"ABORT");}
        });
        db.update("INSERT INTO privacy_deletion_marker(id,company_id,user_id,user_created_at) VALUES(?,?,?,?)",id,company,user,created);
    }
    private synchronized void append(Map<String,Object> entry,String state) {
        try {
            Files.createDirectories(directory);
            Files.setPosixFilePermissions(directory,PosixFilePermissions.fromString("rwx------"));
            Path file=directory.resolve("deletions.jsonl");
            var line=new LinkedHashMap<>(entry);line.put("state",state);
            byte[] bytes=(json.writeValueAsString(line)+"\n").getBytes(java.nio.charset.StandardCharsets.UTF_8);
            try(var channel=FileChannel.open(file,StandardOpenOption.CREATE,StandardOpenOption.WRITE,StandardOpenOption.APPEND)) {
                Files.setPosixFilePermissions(file,PosixFilePermissions.fromString("rw-------"));
                var buffer=ByteBuffer.wrap(bytes);while(buffer.hasRemaining())channel.write(buffer);channel.force(true);
            }
        } catch(java.io.IOException e){throw new IllegalStateException("삭제 복원방지 기록을 저장하지 못했습니다. 관리자에게 문의해주세요.",e);}
    }
}
