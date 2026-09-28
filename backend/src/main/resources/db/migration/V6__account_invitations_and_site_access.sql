CREATE TABLE account_invitation (
    id CHAR(36) NOT NULL,
    company_id BIGINT UNSIGNED NOT NULL,
    email VARCHAR(254) NOT NULL,
    name VARCHAR(80) NOT NULL,
    role VARCHAR(20) NOT NULL,
    token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    invited_by BIGINT UNSIGNED NOT NULL,
    expires_at DATETIME(6) NOT NULL,
    accepted_at DATETIME(6) NULL,
    revoked_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_account_invitation_token (token_hash),
    KEY ix_account_invitation_company_created (company_id, created_at),
    KEY ix_account_invitation_email (email),
    CONSTRAINT fk_account_invitation_company FOREIGN KEY (company_id) REFERENCES company (id),
    CONSTRAINT fk_account_invitation_inviter FOREIGN KEY (invited_by) REFERENCES app_user (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE account_invitation_site (
    invitation_id CHAR(36) NOT NULL,
    site_id VARCHAR(32) NOT NULL,
    PRIMARY KEY (invitation_id, site_id),
    CONSTRAINT fk_invitation_site_invitation FOREIGN KEY (invitation_id)
        REFERENCES account_invitation (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE password_reset_token (
    id CHAR(36) NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    created_by BIGINT UNSIGNED NOT NULL,
    expires_at DATETIME(6) NOT NULL,
    used_at DATETIME(6) NULL,
    revoked_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_password_reset_token (token_hash),
    KEY ix_password_reset_user_created (user_id, created_at),
    CONSTRAINT fk_password_reset_user FOREIGN KEY (user_id) REFERENCES app_user (id) ON DELETE CASCADE,
    CONSTRAINT fk_password_reset_creator FOREIGN KEY (created_by) REFERENCES app_user (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- The initial PentaWorks tenant owns all registered production sites.
-- Test site 040 intentionally remains outside the application site registry.
INSERT IGNORE INTO company_site (company_id, site_id)
SELECT company.id, site.site
FROM company
CROSS JOIN site
WHERE company.code = 'PENTAWORKS';
