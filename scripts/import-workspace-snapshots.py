#!/usr/bin/env python3
"""Development-only, additive import. Never deletes or overwrites source/native records.

Requires V46. Optional decoded Firebase backup enriches PM/ACR forms; it is not
fetched from Firebase. Each maintenance item is atomic with its photos. Items with
missing photos remain on the legacy read path. Re-running skips existing source IDs.
"""
import argparse, datetime, hashlib, json, pathlib, shlex, subprocess

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--host', required=True)
parser.add_argument('--host-key-alias', default='192.168.0.210')
parser.add_argument('--company-code', default='PENTAWORKS')
parser.add_argument('--importer-email', required=True)
parser.add_argument('--decoded-backup', type=pathlib.Path)
parser.add_argument('--legacy-log-map', type=pathlib.Path)
parser.add_argument('--output', type=pathlib.Path, required=True)
parser.add_argument('--apply', action='store_true')
args = parser.parse_args()
args.output.mkdir(parents=True, exist_ok=True)
ssh = ['ssh', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', '-o', 'StrictHostKeyChecking=yes', '-o', 'HostKeyAlias='+args.host_key_alias, args.host]

def remote(command, data=None):
    result = subprocess.run(ssh+[command], input=data, capture_output=True)
    if result.returncode:
        raise RuntimeError(result.stderr.decode()[-2000:])
    return result.stdout

def query(sql):
    command = 'mariadb --batch --raw -N --default-character-set=utf8mb4 -uroot -p"$MARIADB_ROOT_PASSWORD" pentaworks_mreyes_dev'
    return remote('docker exec -i pentaworks-mri-db sh -lc '+shlex.quote(command), sql.encode()).decode()

def value(x):
    if x is None: return 'NULL'
    if isinstance(x, bool): return '1' if x else '0'
    if isinstance(x, (int, float)): return str(x)
    return "CONVERT(UNHEX('"+str(x).encode().hex()+"') USING utf8mb4) COLLATE utf8mb4_unicode_ci"

def jsonvalue(x): return value(json.dumps(x, ensure_ascii=False, separators=(',', ':')))
def rows(sql): return [json.loads(x) for x in query(sql).splitlines() if x]
def date(x):
    if not x: return None
    try: return datetime.date.fromisoformat(str(x)[:10]).isoformat()
    except ValueError: return None

def stamp(x):
    if not x: return None
    try:
        if isinstance(x, (int, float)): dt=datetime.datetime.fromtimestamp(x/1000, datetime.timezone.utc)
        else: dt=datetime.datetime.fromisoformat(str(x).replace('Z','+00:00'))
        if dt.tzinfo: dt=dt.astimezone(datetime.timezone(datetime.timedelta(hours=9)))
        return dt.replace(tzinfo=None).isoformat(' ', timespec='microseconds')
    except (ValueError, OverflowError): return None

identity=rows("SELECT JSON_OBJECT('company',c.id,'user',u.id) FROM company c JOIN app_user u ON u.company_id=c.id WHERE c.code="+value(args.company_code)+" AND u.email="+value(args.importer_email))
if len(identity)!=1: raise RuntimeError('Importer must belong to exactly one explicitly selected company')
cid,uid=identity[0]['company'],identity[0]['user']
if query('SELECT DATABASE();').strip()!='pentaworks_mreyes_dev': raise RuntimeError('Development database required')
snapshots=rows(f"SELECT JSON_OBJECT('siteId',s.site_id,'hash',SHA2(s.response_json,256),'snapshot',JSON_EXTRACT(s.response_json,'$')) FROM workspace_office_snapshot s JOIN company_site cs ON cs.site_id=s.site_id AND cs.company_id=s.company_id WHERE s.company_id={cid}")
# Existing native equipment needs explicit matching, never guess based only on names.
if int(query(f'SELECT COUNT(*) FROM workspace_asset WHERE company_id={cid} AND source_id IS NULL')):
    raise RuntimeError('Native assets exist: supply an explicitly reviewed asset mapping before importing')
photo_meta=rows("SELECT JSON_OBJECT('site',site_id,'record',maintenance_id,'photo',photo_id) FROM workspace_office_photo")
photos={(p['site'],p['record'],p['photo']) for p in photo_meta}
source_logs={}
if args.decoded_backup:
    decoded=json.loads(args.decoded_backup.read_text())
    legacy=json.loads(args.legacy_log_map.read_text()) if args.legacy_log_map else []
    legacy_ids={r['sourceId']:r['id'] for r in legacy}
    hospital_names={r['id']:r.get('name') for r in decoded['hospitals']}
    for r in decoded['logs']:
        rid=legacy_ids.get(r['id']) or 1000000000000+int(hashlib.sha256(r['id'].encode()).hexdigest()[:10],16)
        source_logs[rid]=(r,hospital_names.get(r.get('hospitalId')))

statements=['SET NAMES utf8mb4;',"SET time_zone='+09:00';",'CREATE TEMPORARY TABLE import_guard(ok INT CHECK(ok=1));','START TRANSACTION;']
statements.append(f'SELECT id FROM workspace_asset WHERE company_id={cid} FOR UPDATE;')
statements.append(f'INSERT INTO import_guard VALUES((SELECT COUNT(*)=0 FROM workspace_asset WHERE company_id={cid} AND source_id IS NULL));')
report={'companyId':cid,'snapshots':len(snapshots),'recordsPrepared':0,'assetsPrepared':0,'photosPrepared':0,'pending':[]}
for row in snapshots:
    sid=row['siteId']; snap=row['snapshot']; prefix='office:'+sid+':'
    statements += [f'SELECT site_id FROM workspace_office_snapshot WHERE site_id={value(sid)} AND company_id={cid} FOR UPDATE;', f'INSERT INTO import_guard VALUES((SELECT COUNT(*)=1 FROM workspace_office_snapshot WHERE site_id={value(sid)} AND company_id={cid} AND SHA2(response_json,256)={value(row["hash"])}));']
    equipment=snap.get('equipment',[])
    for kind,items in [('equipment',equipment),('component',snap.get('components',[]))]:
        for item in items:
            origin=prefix+kind+':'+str(item['id'])
            atype='MRI' if kind=='equipment' else {'GRADIENT_CHILLER':'CHILLER','CHILLER':'CHILLER','COLDHEAD':'COLDHEAD','COLD_HEAD':'COLDHEAD'}.get(item.get('componentType'),'OTHER')
            name=(item.get('model') or item.get('equipmentType') or 'MRI 장비') if kind=='equipment' else item.get('name') or '부품'
            notes='\n'.join(str(x) for x in [item.get('notes'),('제조사: '+item['manufacturer']) if item.get('manufacturer') else '',('자장: '+str(item['magneticFieldTesla'])+'T') if item.get('magneticFieldTesla') else '',('부품 번호: '+item['partNumber']) if item.get('partNumber') else '',('교체일: '+str(item['replacedAt'])) if item.get('replacedAt') else ''] if x)
            status=item.get('status') or 'ACTIVE'
            if status not in ['ACTIVE','REPLACED','REMOVED']:
                report['pending'].append({'site':sid,'asset':item['id'],'reason':'unsupported asset status'});continue
            values=[cid,sid,atype,name,item.get('model') or '',item.get('softwareVersion') or '',item.get('serialNumber') or '',date(item.get('installedAt')),status,notes,origin]
            statements.append('INSERT INTO workspace_asset(company_id,site_id,asset_type,name,model,version,serial_number,installed_at,status,notes,source_id,metadata_json) SELECT '+','.join(map(value,values))+','+jsonvalue(item)+f' WHERE NOT EXISTS(SELECT 1 FROM workspace_asset WHERE company_id={cid} AND source_id={value(origin)});')
            report['assetsPrepared']+=1
    for r in snap.get('maintenanceHistory',[]):
        rid=r['id']; origin=prefix+'maintenance:'+str(rid)
        pictures=r.get('photos') or []
        missing=[p['id'] for p in pictures if (sid,rid,p['id']) not in photos]
        if missing or not date(r.get('workDate')) or r.get('status') not in ['COMPLETED','IN_PROGRESS','REVISIT']:
            report['pending'].append({'site':sid,'record':rid,'reason':'missing photos/date or unsupported status','missingPhotos':missing});continue
        source,source_hospital=source_logs.get(rid,({},None))
        if source and source_hospital!=snap['site']['name']: raise RuntimeError('Source hospital mismatch: '+origin)
        details={
          'engineer':r.get('engineerName') or '', 'model':r.get('modelName') or '',
          'symptom':r.get('symptom') or '', 'contractType':r.get('contractType') or '',
          'parts':r.get('partsDetails') or '', 'startTime':r.get('workStartTime') or '',
          'endTime':r.get('workEndTime') or '', 'followUp':r.get('followUp') or '',
          'heLevel':str(source.get('heLevel') or ''), 'countsAsPm':bool(source.get('countsAsPm')),
          'acrKind':source.get('acrKind') or ('doc' if r.get('serviceType')=='ACR' else ''),
          'coldheadPosition':source.get('coldheadPos') or '', 'coldheadSerial':source.get('coldheadSerial') or '',
          'coldheadInDate':source.get('coldheadInDate') or '', 'pm':source.get('pm') or [],
          # Preserve original fields which the current editor does not understand yet.
          'legacyMaintenance':r, 'legacyForm':{k:v for k,v in source.items() if k not in ['createTime','updateTime']},
        }
        acr=source.get('acrFull')
        if isinstance(acr,dict):
            details.update(acr={k:v for k,v in acr.items() if isinstance(v,dict) and k!='pulse'},acrPulse=acr.get('pulse') or {},acrVerdicts={k:v.get('eval','') for k,v in acr.items() if isinstance(v,dict) and k!='pulse'})
        title=r.get('serviceTitle') or r.get('equipmentName') or r.get('serviceType') or '서비스 기록'
        body=r.get('description') or r.get('symptom') or title
        for label,key in [('특이사항','specialNotes'),('비고','remarks')]:
            if r.get(key):body+='\n\n'+label+'\n'+r[key]
        service=r.get('serviceType') or 'ETC'
        if service not in ['REPAIR','PM','ACR','CALL','COLDHEAD','INSTALL','ETC']:
            report['pending'].append({'site':sid,'record':rid,'reason':'unsupported service type'});continue
        # Link only an unambiguous, explicitly named system, never every asset at a hospital.
        matches=[e for e in equipment if r.get('modelName') and e.get('model')==r['modelName']]
        asset_source=prefix+'equipment:'+str(matches[0]['id']) if len(matches)==1 else None
        created=stamp(source.get('createdAt')) or stamp(source.get('createTime'))
        updated=stamp(source.get('updatedAt')) or stamp(r.get('updatedAt'))
        values=[cid,uid,sid,'FIELD',service,title,body,date(r['workDate']),r['status'],origin,details['engineer'],details['countsAsPm'],details['acrKind'] or None]
        statements.append('INSERT INTO workspace_record(company_id,author_id,site_id,kind,service_type,title,body,work_date,status,source_id,engineer_name,counts_as_pm,acr_kind,details_json,created_at,updated_at) SELECT '+','.join(map(value,values))+','+jsonvalue(details)+',COALESCE('+value(created)+',CURRENT_TIMESTAMP(6)),COALESCE('+value(updated)+',CURRENT_TIMESTAMP(6))'+f' WHERE NOT EXISTS(SELECT 1 FROM workspace_record WHERE company_id={cid} AND source_id={value(origin)});')
        statements += ['SET @new_record=ROW_COUNT();',f'SET @record=(SELECT id FROM workspace_record WHERE company_id={cid} AND source_id={value(origin)});']
        if asset_source:
            statements.append(f'UPDATE workspace_record SET details_json=JSON_SET(details_json,\'$.assetIds\',JSON_ARRAY((SELECT id FROM workspace_asset WHERE company_id={cid} AND source_id={value(asset_source)}))),updated_at=updated_at WHERE id=@record AND @new_record=1;')
            # Historical relation is known, but historical serial/version at the service date is not.
            statements.append(f"INSERT INTO workspace_asset_history(company_id,asset_id,record_id,snapshot_json,change_kind) SELECT company_id,id,@record,JSON_OBJECT('imported',TRUE,'historicalStateKnown',FALSE,'sourceModel',{value(r.get('modelName'))}),'SERVICE' FROM workspace_asset WHERE company_id={cid} AND source_id={value(asset_source)} AND @new_record=1;")
        for p in pictures:
            psource=prefix+'photo:'+str(rid)+':'+str(p['id'])
            statements.append('INSERT INTO workspace_photo(company_id,author_id,record_id,original_name,mime_type,image_data,byte_size,width_px,height_px,source_id) SELECT '+f'{cid},{uid},@record,'+value(p.get('originalName') or '사진')+',mime_type,image_data,OCTET_LENGTH(image_data),'+str(p.get('width') or 0)+','+str(p.get('height') or 0)+','+value(psource)+f' FROM workspace_office_photo WHERE site_id={value(sid)} AND maintenance_id={rid} AND photo_id={p["id"]} AND @new_record=1;')
            report['photosPrepared']+=1
        report['recordsPrepared']+=1
statements += ['COMMIT;']
sql='\n'.join(statements)
(args.output/'import.sql').write_text(sql);(args.output/'import.sql').chmod(0o600)
(args.output/'plan.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print(json.dumps(report,ensure_ascii=False))
if args.apply:
    backup='/home/inhwan/backups/mreyes-dev/before-workspace-unification-'+datetime.datetime.now().strftime('%Y%m%d-%H%M%S')+'.sql.gz'
    dump='mariadb-dump --single-transaction --hex-blob -uroot -p"$MARIADB_ROOT_PASSWORD" pentaworks_mreyes_dev workspace_record workspace_asset workspace_asset_history workspace_photo workspace_schedule workspace_preparation workspace_hospital_plan workspace_office_snapshot workspace_office_photo'
    remote('umask 077; mkdir -p /home/inhwan/backups/mreyes-dev; set -o pipefail; docker exec pentaworks-mri-db sh -lc '+shlex.quote(dump)+' | gzip > '+shlex.quote(backup))
    query(sql)
    report['backup']=backup
    report['totals']=rows(f"SELECT JSON_OBJECT('records',(SELECT COUNT(*) FROM workspace_record WHERE company_id={cid} AND source_id LIKE 'office:%'),'assets',(SELECT COUNT(*) FROM workspace_asset WHERE company_id={cid} AND source_id LIKE 'office:%'),'photos',(SELECT COUNT(*) FROM workspace_photo WHERE company_id={cid} AND source_id LIKE 'office:%'))")
    (args.output/'result.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps(report,ensure_ascii=False))
