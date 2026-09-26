-- Keep the existing authorization checks; qualify the new row's reply target.
alter policy messages_insert on public.messages
with check (
  author_id = (select auth.uid())
  and private.can_write_channel(channel_id)
  and exists (
    select 1 from public.channels
    where channels.id = messages.channel_id and channels.kind = 'text'
  )
  and (
    messages.reply_to is null
    or exists (
      select 1 from public.messages parent
      where parent.id = messages.reply_to
        and parent.channel_id = messages.channel_id
    )
  )
);
