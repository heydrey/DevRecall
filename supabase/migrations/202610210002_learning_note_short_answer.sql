alter table public.learning_notes
  add column if not exists short_answer text not null default '';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'learning_notes_short_answer_length'
  ) then
    alter table public.learning_notes
      add constraint learning_notes_short_answer_length
      check (char_length(short_answer) <= 1000);
  end if;
end $$;
