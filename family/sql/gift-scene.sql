-- Room for a drawing, placed words and a small photo on a gift card. The check open.blog's
-- gifts.sql creates caps a card at 8 KB, which is enough for a design and stickers and too small
-- for a photo. This raises that cap. Running it twice changes nothing. A card is still JSON, still
-- checked by the family service before it is stored, and still never markup.

do $$
declare name text;
begin
  for name in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'openblog_gifts'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) like '%pg_column_size(card)%'
  loop
    execute format('alter table public.openblog_gifts drop constraint %I', name);
  end loop;
end $$;

alter table public.openblog_gifts
  add constraint openblog_gifts_card_size
  check (card is null or (jsonb_typeof(card) = 'object' and pg_column_size(card) < 180000));
