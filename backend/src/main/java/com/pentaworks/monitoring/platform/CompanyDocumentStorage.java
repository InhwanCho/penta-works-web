package com.pentaworks.monitoring.platform;

import com.pentaworks.monitoring.common.BadRequestException;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.Map;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
public class CompanyDocumentStorage {
    private static final long MAX_SIZE = 900 * 1024;
    private static final Map<String, String> EXTENSIONS = Map.of(
        "application/pdf", ".pdf",
        "image/jpeg", ".jpg",
        "image/png", ".png");
    private final Path root;

    public CompanyDocumentStorage(@Value("${app.company-documents.directory:./data/company-documents}") String directory) {
        root = Path.of(directory).toAbsolutePath().normalize();
    }

    public StoredDocument store(MultipartFile file) {
        if (file == null || file.isEmpty()) throw new BadRequestException("사업자등록증 파일을 첨부해주세요.");
        if (file.getSize() > MAX_SIZE) throw new BadRequestException("사업자등록증 파일은 900KB 이하여야 합니다.");
        String contentType = file.getContentType() == null ? "" : file.getContentType().toLowerCase();
        String extension = EXTENSIONS.get(contentType);
        if (extension == null) throw new BadRequestException("사업자등록증은 PDF, JPG, PNG 파일만 등록할 수 있습니다.");
        String key = UUID.randomUUID() + extension;
        Path target = resolve(key);
        try {
            Files.createDirectories(root);
            Files.copy(file.getInputStream(), target, StandardCopyOption.REPLACE_EXISTING);
            String originalName = file.getOriginalFilename() == null ? "사업자등록증" + extension
                : Path.of(file.getOriginalFilename()).getFileName().toString();
            return new StoredDocument(key, originalName, contentType);
        } catch (IOException error) {
            throw new IllegalStateException("사업자등록증 파일을 저장하지 못했습니다.", error);
        }
    }

    public byte[] read(String key) {
        try {
            return Files.readAllBytes(resolve(key));
        } catch (IOException error) {
            throw new IllegalStateException("사업자등록증 파일을 읽지 못했습니다.", error);
        }
    }

    public void deleteQuietly(String key) {
        try { Files.deleteIfExists(resolve(key)); } catch (IOException ignored) { }
    }

    private Path resolve(String key) {
        Path value = root.resolve(key).normalize();
        if (!value.startsWith(root)) throw new BadRequestException("올바르지 않은 파일 경로입니다.");
        return value;
    }

    public record StoredDocument(String key, String originalName, String contentType) {}
}
