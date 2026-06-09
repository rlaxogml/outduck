-- Create feedback table to store customer inquiries and feedback
create table if not exists public.feedback (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  type text not null,
  title text not null,
  content text not null,
  email text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security (RLS)
alter table public.feedback enable row level security;

-- Allow anyone (authenticated or anonymous) to submit feedback
create policy "Enable insert for all users" on public.feedback
  for insert with check (true);

-- Only admins (profiles.is_admin = true) can read feedback
create policy "Enable read access for admins only" on public.feedback
  for select using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and is_admin = true
    )
  );
