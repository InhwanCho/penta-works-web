import importlib.util, pathlib, tempfile, unittest
spec=importlib.util.spec_from_file_location('backup',pathlib.Path(__file__).resolve().parents[1]/'privacy_backup.py')
backup=importlib.util.module_from_spec(spec);spec.loader.exec_module(backup)
class JournalTests(unittest.TestCase):
 def entry(self,state='PREPARE'):
  return {'id':'11111111-1111-1111-1111-111111111111','company':1,'user':7,'created':'2026-10-01T09:00','state':state}
 def test_unresolved_deletion_blocks_restore_and_normalizes_timestamps(self):
  with tempfile.TemporaryDirectory() as d:
   p=pathlib.Path(d)/'journal';backup.append(p,self.entry())
   with self.assertRaises(ValueError):backup.replay_sql(backup.read_journal(p))
   committed=self.entry('COMMIT');committed['created']='2026-10-01T09:00:00.000000';backup.append(p,committed)
   sql=backup.replay_sql(backup.read_journal(p));self.assertIn("created_at='2026-10-01 09:00:00.000000'",sql);self.assertIn('company_id=1',sql);self.assertIn('status=\'DISCONNECTED\'',sql)
 def test_abort_does_not_delete_and_resolution_cannot_change(self):
  with tempfile.TemporaryDirectory() as d:
   p=pathlib.Path(d)/'journal';backup.append(p,self.entry());backup.append(p,self.entry('ABORT'))
   self.assertNotIn('UPDATE app_user',backup.replay_sql(backup.read_journal(p)))
   backup.append(p,self.entry('COMMIT'))
   with self.assertRaises(ValueError):backup.read_journal(p)
 def test_changed_ciphertext_has_different_authenticated_digest(self):
  with tempfile.TemporaryDirectory() as d:
   p=pathlib.Path(d)/'encrypted';p.write_bytes(b'example ciphertext');one=backup.digest(p,b'key')
   p.write_bytes(b'altered ciphertext');self.assertNotEqual(one,backup.digest(p,b'key'))
 def test_corrupted_or_missing_identity_fails_closed(self):
  with tempfile.TemporaryDirectory() as d:
   p=pathlib.Path(d)/'journal';p.write_text('{"bad":true}\n')
   with self.assertRaises(KeyError):backup.read_journal(p)
if __name__=='__main__':unittest.main()
