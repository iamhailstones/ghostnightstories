-- PostgreSQL schema for the production upgrade (the shipped Go API uses a JSON file store; see README).
create table users(id serial primary key, email text unique not null, name text, password_hash text not null, salt text not null, role text not null default 'reader', created_at timestamptz default now());
create table categories(id serial primary key, name text unique not null);
create table stories(id serial primary key, title text not null, category_id int references categories(id), author text, description text, cover_url text, minutes int, intensity int check (intensity between 1 and 5), status text not null default 'draft', kind text default 'story', triggers int[] default '{}', created_at timestamptz default now());
create table chapters(id serial primary key, story_id int references stories(id) on delete cascade, position int not null, body text not null);
create table interactive_stories(id serial primary key, name text not null, start_node text not null, nodes jsonb not null);
create table bookmarks(user_id int references users(id) on delete cascade, story_id int references stories(id) on delete cascade, primary key(user_id, story_id));
create table reading_progress(user_id int references users(id) on delete cascade, story_id int references stories(id) on delete cascade, pct int not null, updated_at timestamptz default now(), primary key(user_id, story_id));
create table submissions(id serial primary key, story_id int references stories(id), submitter_ip inet, status text default 'pending', reviewer_note text);
create table mysteries(id serial primary key, title text not null, body text, clues text, reveal text, publish_on date not null);
create table theories(id serial primary key, mystery_id int references mysteries(id) on delete cascade, author text, body text not null, created_at timestamptz default now());
create table archive_cases(id serial primary key, code text unique, location text, incident_date date, level int, evidence text, witness text, notes text, status text);
create table jumpscare_videos(id serial primary key, url text unique not null, category text, level text check (level in ('Mild','Extreme','Nightmare')), enabled boolean default true, ok boolean default false, checked_at timestamptz, last_error text);
create table audio_assets(id serial primary key, story_id int references stories(id), url text not null, kind text);
create table site_settings(key text primary key, value jsonb not null);
