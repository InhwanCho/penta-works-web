-- Site history reads filter by site and order by newest timestamp/index.
-- InnoDB secondary indexes include the primary key (`index`) for tie breaking.
CREATE INDEX ix_mrtb_site_date ON mrtb (siteid, date);
