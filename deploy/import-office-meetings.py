#!/usr/bin/env python3
"""Run on the deployment host. Copy intranet meetings once, without modifying office.
Defaults to a read-only preview. Existing MReyes copies are never overwritten.
"""
import argparse
import datetime
import hashlib
import json
import os
import pathlib
import subprocess


def sql(container, database, query):
    command = ['docker', 'exec', '-i', container, 'sh', '-c',
               'exec mariadb --default-character-set=utf8mb4 --batch --raw --skip-column-names -uroot -p"$MARIADB_ROOT_PASSWORD" "$1"', 'sh', database]
    return subprocess.run(command, input=query.encode(), stdout=subprocess.PIPE,
                          stderr=subprocess.PIPE, check=True).stdout.decode()


def literal(value):
    return 'NULL' if value is None else "CONVERT(0x" + str(value).encode().hex() + " USING utf8mb4)" if str(value) else "''"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--target', choices=['dev', 'prod'], required=True)
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    source_db = sql('pentaworks-intranet-db', 'information_schema', "SELECT SCHEMA_NAME FROM SCHEMATA WHERE SCHEMA_NAME NOT IN ('information_schema','mysql','performance_schema','sys')").strip().splitlines()
    if len(source_db) != 1:
        raise RuntimeError('Select the intranet database explicitly: unexpected schema count')
    source_db = source_db[0]
    attachments = int(sql('pentaworks-intranet-db', source_db, "SELECT COUNT(*) FROM file_links l JOIN meetings m ON m.id=l.target_id WHERE l.target_type='MEETING' AND m.deleted_at IS NULL").strip())
    inline = int(sql('pentaworks-intranet-db', source_db, "SELECT COUNT(*) FROM meetings WHERE deleted_at IS NULL AND content_markdown REGEXP '<img|/files/|/uploads/'").strip())
    if attachments or inline:
        raise RuntimeError('Meetings include attachments; migrate files before importing to avoid broken documents')
    rows = [json.loads(bytes.fromhex(line).decode()) for line in sql('pentaworks-intranet-db', source_db, """
      SET SESSION group_concat_max_len=100000;
      SELECT HEX(JSON_OBJECT('id',m.id,'title',m.title,'meetingAt',DATE_FORMAT(m.meeting_at,'%Y-%m-%d %H:%i:%s.%f'),
        'content',m.content_markdown,'authorName',u.name,'authorEmail',u.email,'editorName',editor.name,'editorEmail',editor.email,
        'participants',COALESCE((SELECT GROUP_CONCAT(pu.name ORDER BY pu.name SEPARATOR ', ') FROM meeting_participants p JOIN users pu ON pu.id=p.user_id WHERE p.meeting_id=m.id),''),
        'createdAt',DATE_FORMAT(m.created_at,'%Y-%m-%d %H:%i:%s.%f'),'updatedAt',DATE_FORMAT(m.updated_at,'%Y-%m-%d %H:%i:%s.%f')))
      FROM meetings m JOIN users u ON u.id=m.author_id JOIN users editor ON editor.id=m.updated_by_id
      WHERE m.deleted_at IS NULL ORDER BY m.id;
      """).splitlines() if line]
    target = 'pentaworks_mri_db' if args.target == 'prod' else 'pentaworks_mreyes_dev'
    company = sql('pentaworks-mri-db', target, "SELECT id FROM company WHERE code='PENTAWORKS' AND status='ACTIVE'").strip()
    if not company.isdigit():
        raise RuntimeError('Expected exactly one active PENTAWORKS company')
    print(json.dumps({'target': args.target, 'meetings': len(rows), 'attachments': attachments, 'apply': args.apply}))
    if not args.apply:
        return
    backup = pathlib.Path('/home/inhwan/backups/mreyes-office-meetings')
    backup.mkdir(mode=0o700, parents=True, exist_ok=True)
    snapshot = backup / (datetime.datetime.now().strftime('%Y%m%d-%H%M%S') + '-' + args.target + '.json')
    with snapshot.open('x', encoding='utf-8') as handle:
        os.chmod(snapshot, 0o600)
        json.dump(rows, handle, ensure_ascii=False)
    statements = ['START TRANSACTION;']
    for row in rows:
        source = literal('office:meeting:' + str(row['id']))
        fields = [company, source, literal(row['title']), literal(row['meetingAt']), literal(row['content']),
                  f"(SELECT id FROM app_user WHERE company_id={company} AND email={literal(row['authorEmail'])} LIMIT 1)",
                  literal(row['authorName']),
                  f"(SELECT id FROM app_user WHERE company_id={company} AND email={literal(row['editorEmail'])} LIMIT 1)",
                  literal(row['editorName']), literal(row['participants']), literal(row['createdAt']), literal(row['updatedAt'])]
        statements.append('INSERT INTO workspace_meeting(company_id,source_id,title,meeting_at,content_markdown,author_id,author_name,updated_by_id,updated_by_name,participant_names,created_at,updated_at) SELECT '
                          + ','.join(fields) + f' WHERE NOT EXISTS(SELECT 1 FROM workspace_meeting WHERE company_id={company} AND source_id={source});')
    statements.append('COMMIT;')
    sql('pentaworks-mri-db', target, '\n'.join(statements))
    verified = 0
    for row in rows:
        result = sql('pentaworks-mri-db', target, f"SELECT revision,SHA2(content_markdown,256),title= {literal(row['title'])},meeting_at={literal(row['meetingAt'])},author_name={literal(row['authorName'])},updated_by_name={literal(row['editorName'])},participant_names={literal(row['participants'])},created_at={literal(row['createdAt'])},updated_at={literal(row['updatedAt'])} FROM workspace_meeting WHERE company_id={company} AND source_id={literal('office:meeting:'+str(row['id']))}").strip().split('\t')
        if not result:
            raise RuntimeError('Missing imported meeting')
        if result[0] == '1':
            if result[1] != hashlib.sha256(row['content'].encode()).hexdigest() or any(value != '1' for value in result[2:]):
                raise RuntimeError('Imported content or metadata verification failed')
            verified += 1
    print(json.dumps({'importedOrExisting': len(rows), 'exactContentAndMetadataVerified': verified, 'snapshot': str(snapshot)}))


if __name__ == '__main__':
    main()
