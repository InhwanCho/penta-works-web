package com.pentaworks.monitoring.platform;

import com.pentaworks.monitoring.common.BadRequestException;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.web.MockMultipartFile;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class CompanyDocumentStorageTest {
    @TempDir Path directory;

    @Test
    void storesAndReadsAllowedDocument() {
        CompanyDocumentStorage storage = new CompanyDocumentStorage(directory.toString());
        byte[] content = "registration".getBytes(java.nio.charset.StandardCharsets.UTF_8);
        var stored = storage.store(new MockMultipartFile("file", "registration.pdf", "application/pdf", content));

        assertArrayEquals(content, storage.read(stored.key()));
    }

    @Test
    void rejectsExecutableDocument() {
        CompanyDocumentStorage storage = new CompanyDocumentStorage(directory.toString());
        assertThrows(BadRequestException.class, () -> storage.store(
            new MockMultipartFile("file", "registration.exe", "application/octet-stream", new byte[] {1})));
    }

    @Test
    void rejectsDocumentLargerThanTenMegabytes() {
        CompanyDocumentStorage storage = new CompanyDocumentStorage(directory.toString());
        assertThrows(BadRequestException.class, () -> storage.store(
            new MockMultipartFile("file", "registration.jpg", "image/jpeg",
                new byte[10 * 1024 * 1024 + 1])));
    }
}
