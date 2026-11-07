begin;
update storage.buckets set public=false where id='candy-design-assets';
commit;
