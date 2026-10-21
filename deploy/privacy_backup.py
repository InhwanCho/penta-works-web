#!/usr/bin/env python3
"""Encrypted MReyes backups, independent deletion journal and guarded restore.
Never restores production without an explicit flag; never starts applications.
"""
import argparse, datetime as dt, fcntl, gzip, hashlib, hmac, json, os, pathlib, re, secrets, shutil, subprocess, sys, tarfile, tempfile
DB_CONTAINER = 'pentaworks-mri-db'
MODES = {'prod': ('pentaworks_mri_db','pentaworks-prod-backend-1'), 'dev': ('pentaworks_mreyes_dev','pentaworks-backend-1')}
ROOT = pathlib.Path('/home/inhwan/backups/mreyes-managed')
KEY = pathlib.Path('/home/inhwan/pentaworks-secrets/mreyes-backup.key')
JOURNALS = pathlib.Path('/home/inhwan/privacy-journal')

def run(args, **kwargs):
    return subprocess.run(args, check=True, **kwargs)

def db(database, sql):
    if not re.fullmatch(r'[A-Za-z0-9_]+', database): raise ValueError('Invalid database')
    # Credentials expand only within the DB container and never enter the host command/log.
    cmd = ['docker','exec','-i',DB_CONTAINER,'sh','-c','exec mariadb --batch --raw --skip-column-names -uroot -p"$MARIADB_ROOT_PASSWORD" "$1"','sh',database]
    return run(cmd,input=sql.encode(),stdout=subprocess.PIPE,stderr=subprocess.PIPE).stdout.decode()

def read_journal(path):
    entries={}
    if not path.exists(): return entries
    for line in path.read_text().splitlines():
        e=json.loads(line); ident=e['id']
        if not re.fullmatch(r'[a-fA-F0-9-]{36}',ident): raise ValueError('Invalid journal id')
        if e.get('state') not in ('PREPARE','COMMIT','ABORT'): raise ValueError('Invalid journal state')
        if not all(isinstance(e.get(k),int) and e[k]>0 for k in ('company','user')):raise ValueError('Invalid journal identity')
        e['created']=dt.datetime.fromisoformat(e['created']).isoformat(timespec='microseconds')
        previous=entries.get(ident)
        if previous and any(previous[k]!=e[k] for k in ('company','user','created')):raise ValueError('Journal identity changed')
        if previous and previous['state'] in ('COMMIT','ABORT') and previous['state']!=e['state']:raise ValueError('Journal resolution changed')
        entries[ident]=e
    return entries

def append(path,e):
    path.parent.mkdir(mode=0o700,parents=True,exist_ok=True)
    with open(path,'a',encoding='utf-8') as f:
        os.chmod(path,0o600);f.write(json.dumps(e,separators=(',',':'))+'\n');f.flush();os.fsync(f.fileno())

def sync_markers(database,path):
    entries=read_journal(path)
    for line in db(database,"SELECT id,company_id,user_id,DATE_FORMAT(user_created_at,'%Y-%m-%dT%H:%i:%s.%f') FROM privacy_deletion_marker").splitlines():
        ident,company,user,created=line.split('\t')
        if ident not in entries or entries[ident]['state']=='PREPARE':
            append(path,{'id':ident,'company':int(company),'user':int(user),'created':created,'state':'COMMIT'})
    entries=read_journal(path)
    if any(e['state']=='PREPARE' for e in entries.values()):
        raise ValueError('Unresolved deletion PREPARE. Verify original live DB/transaction outcome before resolving; restore is blocked.')
    return entries

def digest(path,key):
    mac=hmac.new(hashlib.sha256(b'mreyes-backup-hmac-v1'+key).digest(),digestmod=hashlib.sha256)
    with open(path,'rb') as f:
        for chunk in iter(lambda:f.read(1024*1024),b''):mac.update(chunk)
    return mac.hexdigest()

def openssl(source,target,decrypt=False):
    args=['openssl','enc','-aes-256-cbc','-pbkdf2','-iter','200000','-salt','-pass',f'file:{KEY}','-in',str(source),'-out',str(target)]
    if decrypt:args.append('-d')
    run(args,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)

def backup(mode):
    database,container=MODES[mode];base=ROOT/mode;base.mkdir(mode=0o700,parents=True,exist_ok=True)
    if not KEY.is_file():raise ValueError('Backup encryption key is missing. Initialize first.')
    key=KEY.read_bytes();journal=JOURNALS/mode/'deletions.jsonl'
    with open(base/'.backup.lock','w') as lock:
        fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        sync_markers(database,journal)
        stamp=dt.datetime.now(dt.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
        final=base/f'mreyes-{mode}-{stamp}.tar.gz.enc'
        with tempfile.TemporaryDirectory(prefix='.creating-',dir=base) as temp:
            tmp=pathlib.Path(temp)
            with gzip.open(tmp/'database.sql.gz','wb') as out:
                cmd=['docker','exec',DB_CONTAINER,'sh','-c','exec mariadb-dump --single-transaction --quick --hex-blob --routines --triggers --events -uroot -p"$MARIADB_ROOT_PASSWORD" "$1"','sh',database]
                proc=subprocess.Popen(cmd,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
                shutil.copyfileobj(proc.stdout,out);err=proc.stderr.read();code=proc.wait()
                if code:raise RuntimeError('Database dump failed')
            files=tmp/'company-documents';files.mkdir()
            run(['docker','cp',container+':/app/data/company-documents/.',str(files)],stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
            sync_markers(database,journal)
            if not journal.exists():journal.touch(mode=0o600)
            shutil.copyfile(journal,tmp/'deletions-at-backup.jsonl')
            (tmp/'manifest.json').write_text(json.dumps({'format':1,'mode':mode,'database':database,'createdUtc':stamp,'scope':['database','company-documents'],'retentionDays':30}))
            archive=tmp/'archive.tar.gz'
            with tarfile.open(archive,'w:gz') as tar:
                for name in ['database.sql.gz','company-documents','deletions-at-backup.jsonl','manifest.json']:tar.add(tmp/name,arcname=name)
            encrypted=tmp/'backup.enc';openssl(archive,encrypted)
            mac=digest(encrypted,key)
            os.replace(encrypted,final);os.chmod(final,0o600)
            macpath=pathlib.Path(str(final)+'.hmac');macpath.write_text(mac+'\n');os.chmod(macpath,0o600)
            # Verify archive and signature before pruning older managed backups.
            if not hmac.compare_digest(digest(final,key),macpath.read_text().strip()):raise ValueError('Backup integrity check failed')
        cutoff=dt.datetime.now(dt.timezone.utc).timestamp()-30*86400
        for old in base.glob(f'mreyes-{mode}-*.tar.gz.enc'):
            if old!=final and old.stat().st_mtime<cutoff:
                old.unlink();pathlib.Path(str(old)+'.hmac').unlink(missing_ok=True)
        print('Created verified encrypted backup:',final)

def replay_sql(entries):
    sql=['START TRANSACTION;']
    for e in entries.values():
        if e['state']=='PREPARE':raise ValueError('Unresolved deletion PREPARE; refusing replay')
        if e['state']!='COMMIT':continue
        company,user=int(e['company']),int(e['user']);created=dt.datetime.fromisoformat(e['created']).strftime('%Y-%m-%d %H:%M:%S.%f')
        ident=e['id'];anon=f'deleted-{user}-{ident}@deleted.invalid'
        sql += [f"SET @uid=(SELECT id FROM app_user WHERE id={user} AND company_id={company} AND created_at='{created}');",
                "DELETE FROM user_site WHERE user_id=@uid;", "DELETE FROM site_alert_recipient WHERE user_id=@uid;",
                "UPDATE user_session SET revoked_at=CURRENT_TIMESTAMP(6) WHERE user_id=@uid;",
                "UPDATE password_reset_token SET revoked_at=CURRENT_TIMESTAMP(6) WHERE user_id=@uid;",
                "DELETE o FROM calendar_oauth_state o JOIN user_calendar_connection c ON c.id=o.connection_id WHERE c.user_id=@uid;",
                "UPDATE user_calendar_connection SET status='DISCONNECTED',refresh_token_encrypted=NULL WHERE user_id=@uid;",
                "UPDATE alert_rule SET is_enabled=FALSE WHERE user_id=@uid;",
                f"UPDATE app_user SET email='{anon}',username='{anon}',name='삭제된 사용자',phone=NULL,role='USER',status='DELETED',password_hash='!DELETED!',failed_login_count=0,locked_until=NULL WHERE id=@uid;",
                f"INSERT IGNORE INTO privacy_deletion_marker(id,company_id,user_id,user_created_at) SELECT '{ident}',company_id,id,created_at FROM app_user WHERE id=@uid;"]
    sql.append('COMMIT;');return '\n'.join(sql)

def restore(args):
    if not args.target or not re.fullmatch(r'[A-Za-z0-9_]+',args.target):raise ValueError('Explicit target DB required')
    if args.target in {x[0] for x in MODES.values()} and not args.allow_production:raise ValueError('Live target blocked; use isolated QA DB for testing')
    if args.target in {x[0] for x in MODES.values()}:
        for container in [MODES[args.mode][1],MODES[args.mode][1].replace('backend','frontend')]:
            running=run(['docker','inspect','--format','{{.State.Running}}',container],stdout=subprocess.PIPE,stderr=subprocess.PIPE).stdout.strip()
            if running==b'true':raise ValueError('Stop frontend/backend before a live restore')
    if not args.documents_output or pathlib.Path(args.documents_output).exists():raise ValueError('A new --documents-output path is required')
    journal=JOURNALS/args.mode/'deletions.jsonl'
    if not journal.exists():raise ValueError('Independent live deletion journal required; do not substitute the old backup journal')
    entries=read_journal(journal);replay_sql(entries) # Check unresolved entries BEFORE importing anything.
    source=pathlib.Path(args.archive).resolve();signature=pathlib.Path(str(source)+'.hmac').read_text().strip()
    if not hmac.compare_digest(digest(source,KEY.read_bytes()),signature):raise ValueError('Backup integrity check failed')
    with tempfile.TemporaryDirectory(prefix='mreyes-restore-') as temp:
        tmp=pathlib.Path(temp);archive=tmp/'archive.tar.gz';openssl(source,archive,True)
        with tarfile.open(archive,'r:gz') as tar:
            for member in tar.getmembers():
                if member.name.startswith('/') or '..' in pathlib.PurePosixPath(member.name).parts or member.issym() or member.islnk():raise ValueError('Unsafe archive entry')
            tar.extractall(tmp/'content',filter='data')
        content=tmp/'content';manifest=json.loads((content/'manifest.json').read_text())
        if manifest['mode']!=args.mode:raise ValueError('Backup environment mismatch')
        db('mysql',f'CREATE DATABASE IF NOT EXISTS `{args.target}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;')
        # Restores can only target an EMPTY schema. Never overwrite a live database silently.
        if db('information_schema',f"SELECT COUNT(*) FROM tables WHERE table_schema='{args.target}'").strip()!='0':raise ValueError('Target database must be empty')
        command=['docker','exec','-i',DB_CONTAINER,'sh','-c','exec mariadb -uroot -p"$MARIADB_ROOT_PASSWORD" "$1"','sh',args.target]
        with gzip.open(content/'database.sql.gz','rb') as incoming:
            proc=subprocess.Popen(command,stdin=subprocess.PIPE,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
            try:shutil.copyfileobj(incoming,proc.stdin);proc.stdin.close()
            except BrokenPipeError:pass
            err=proc.stderr.read();code=proc.wait()
            if code:raise RuntimeError('Restore import failed; target must remain offline')
        # Prevent accidental external sends from restored OAuth/queued deliveries.
        db(args.target,"UPDATE user_calendar_connection SET status='DISCONNECTED',refresh_token_encrypted=NULL; DELETE FROM calendar_oauth_state;")
        db(args.target,replay_sql(entries))
        if not args.documents_output:raise ValueError('Specify --documents-output for restored files')
        output=pathlib.Path(args.documents_output)
        if output.exists():raise ValueError('Documents output already exists')
        output.parent.mkdir(mode=0o700,parents=True,exist_ok=True)
        shutil.copytree(content/'company-documents',output)
        print('Restore and deletion replay complete:',args.target)
        print('Documents exported to:',output)
        print('Applications remain stopped. Review mail/alert providers and permissions before starting.')

def main():
    os.umask(0o077)
    parser=argparse.ArgumentParser();parser.add_argument('command',choices=['init','backup','restore','check-journal']);parser.add_argument('--mode',choices=MODES,default='prod');parser.add_argument('--target');parser.add_argument('--archive');parser.add_argument('--documents-output');parser.add_argument('--allow-production',action='store_true')
    args=parser.parse_args()
    if args.command=='init':
        KEY.parent.mkdir(mode=0o700,parents=True,exist_ok=True)
        if not KEY.exists():
            with open(KEY,'x') as f:f.write(secrets.token_hex(32)+'\n')
            os.chmod(KEY,0o600)
        print('Backup key ready; store an offline protected copy separately.')
    elif args.command=='backup':backup(args.mode)
    elif args.command=='check-journal':
        values=read_journal(JOURNALS/args.mode/'deletions.jsonl');replay_sql(values);print('Journal checked:',len(values),'entries')
    else:restore(args)
if __name__=='__main__':
    try:main()
    except Exception as e:
        print(type(e).__name__+': '+str(e) if not isinstance(e,subprocess.CalledProcessError) else 'External command failed; no credential or provider response logged.',file=sys.stderr);sys.exit(1)
