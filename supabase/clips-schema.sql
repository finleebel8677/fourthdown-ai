-- GRIDIRON IQ shared clips database
create table if not exists public.clip_archive (
  video_id text primary key,
  title text not null,
  published timestamptz,
  channel text not null,
  league text not null check (league in ('nfl','college')),
  url text not null,
  thumbnail text not null,
  discovered_at timestamptz not null default now()
);
create table if not exists public.clip_likes (
  video_id text not null references public.clip_archive(video_id) on delete cascade,
  user_id text not null,
  created_at timestamptz not null default now(),
  primary key (video_id, user_id)
);
create table if not exists public.clip_comments (
  id bigint generated always as identity primary key,
  video_id text not null references public.clip_archive(video_id) on delete cascade,
  user_id text not null,
  body text not null check (char_length(body) between 1 and 240),
  created_at timestamptz not null default now()
);
create index if not exists clip_comments_video_created_idx on public.clip_comments(video_id, created_at desc);
alter table public.clip_archive enable row level security;
alter table public.clip_likes enable row level security;
alter table public.clip_comments enable row level security;
drop policy if exists "Public read clips" on public.clip_archive;
create policy "Public read clips" on public.clip_archive for select using (true);
drop policy if exists "Public insert clips" on public.clip_archive;
create policy "Public insert clips" on public.clip_archive for insert with check (true);
drop policy if exists "Public update clips" on public.clip_archive;
create policy "Public update clips" on public.clip_archive for update using (true) with check (true);
drop policy if exists "Public read likes" on public.clip_likes;
create policy "Public read likes" on public.clip_likes for select using (true);
drop policy if exists "Public add likes" on public.clip_likes;
create policy "Public add likes" on public.clip_likes for insert with check (true);
drop policy if exists "Public remove likes" on public.clip_likes;
create policy "Public remove likes" on public.clip_likes for delete using (true);
drop policy if exists "Public read comments" on public.clip_comments;
create policy "Public read comments" on public.clip_comments for select using (true);
drop policy if exists "Public add comments" on public.clip_comments;
create policy "Public add comments" on public.clip_comments for insert with check (true);
