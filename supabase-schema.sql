create table if not exists public.portfolio_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.is_portfolio_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.portfolio_admins
    where user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_portfolio_admin() from public, anon;
grant execute on function public.is_portfolio_admin() to authenticated;

create table if not exists public.portfolio_profile (
  id integer primary key check (id = 1),
  first_name text not null default '',
  last_name text not null default '',
  eyebrow text not null default '',
  title text not null default '',
  tagline text not null default '',
  about_text text not null default '',
  motto text not null default '',
  formation text not null default '',
  origin text not null default '',
  specialization text not null default '',
  objective text not null default '',
  contact_email text not null default '',
  photo_path text,
  cv_path text,
  updated_at timestamptz not null default now()
);

alter table public.portfolio_profile
  add column if not exists cv_path text;

create table if not exists public.portfolio_journey (
  id uuid primary key default gen_random_uuid(),
  period text not null default '',
  title text not null,
  organization text not null default '',
  description text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (title, organization)
);

create table if not exists public.portfolio_projects (
  id uuid primary key default gen_random_uuid(),
  content_type text not null check (content_type in ('project', 'work')),
  title text not null,
  category text not null default '',
  description text not null default '',
  tags text[] not null default '{}',
  emoji text not null default '',
  image_paths text[] not null default '{}',
  project_url text not null default '',
  project_kind text not null default 'Projet académique',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (content_type, title)
);

alter table public.portfolio_projects
  add column if not exists project_url text not null default '';

alter table public.portfolio_projects
  add column if not exists project_kind text not null default 'Projet académique';

update public.portfolio_projects
set project_kind = 'Création visuelle'
where content_type = 'work'
  and project_kind = 'Projet académique';

alter table public.portfolio_projects
  drop constraint if exists portfolio_projects_project_kind_check;

alter table public.portfolio_projects
  add constraint portfolio_projects_project_kind_check
  check (project_kind in (
    'Projet académique',
    'Projet personnel',
    'Projet professionnel',
    'Création visuelle'
  ));

create table if not exists public.portfolio_skills (
  id uuid primary key default gen_random_uuid(),
  title text not null unique,
  items text[] not null default '{}',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant usage on schema public to anon, authenticated;
grant select on public.portfolio_profile, public.portfolio_journey, public.portfolio_projects, public.portfolio_skills to anon, authenticated;
grant update on public.portfolio_profile to authenticated;
grant insert, update, delete on public.portfolio_journey, public.portfolio_projects, public.portfolio_skills to authenticated;
grant select on public.portfolio_admins to authenticated;

alter table public.portfolio_admins enable row level security;
alter table public.portfolio_profile enable row level security;
alter table public.portfolio_journey enable row level security;
alter table public.portfolio_projects enable row level security;
alter table public.portfolio_skills enable row level security;

drop policy if exists "Admins can read their own access" on public.portfolio_admins;
create policy "Admins can read their own access"
  on public.portfolio_admins for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Public can read portfolio profile" on public.portfolio_profile;
create policy "Public can read portfolio profile"
  on public.portfolio_profile for select to anon, authenticated using (true);
drop policy if exists "Admins can update portfolio profile" on public.portfolio_profile;
create policy "Admins can update portfolio profile"
  on public.portfolio_profile for update to authenticated
  using ((select public.is_portfolio_admin()))
  with check ((select public.is_portfolio_admin()));

drop policy if exists "Public can read portfolio journey" on public.portfolio_journey;
create policy "Public can read portfolio journey"
  on public.portfolio_journey for select to anon, authenticated using (true);
drop policy if exists "Admins can manage portfolio journey" on public.portfolio_journey;
create policy "Admins can manage portfolio journey"
  on public.portfolio_journey for all to authenticated
  using ((select public.is_portfolio_admin()))
  with check ((select public.is_portfolio_admin()));

drop policy if exists "Public can read portfolio projects" on public.portfolio_projects;
create policy "Public can read portfolio projects"
  on public.portfolio_projects for select to anon, authenticated using (true);
drop policy if exists "Admins can manage portfolio projects" on public.portfolio_projects;
create policy "Admins can manage portfolio projects"
  on public.portfolio_projects for all to authenticated
  using ((select public.is_portfolio_admin()))
  with check ((select public.is_portfolio_admin()));

drop policy if exists "Public can read portfolio skills" on public.portfolio_skills;
create policy "Public can read portfolio skills"
  on public.portfolio_skills for select to anon, authenticated using (true);
drop policy if exists "Admins can manage portfolio skills" on public.portfolio_skills;
create policy "Admins can manage portfolio skills"
  on public.portfolio_skills for all to authenticated
  using ((select public.is_portfolio_admin()))
  with check ((select public.is_portfolio_admin()));

insert into public.portfolio_profile (
  id, first_name, last_name, eyebrow, title, tagline, about_text, motto,
  formation, origin, specialization, objective, contact_email
) values (
  1,
  'Angie Sohane',
  'Ndaghy Pambo',
  'Étudiante MMI · INPTIC · Gabon',
  'Créatrice digitale',
  'Passionnée par le design graphique, la communication numérique et la production audiovisuelle. Je transforme les idées en expériences visuelles mémorables.',
  'Je suis Angie Sohane Ndaghy Pambo, 22 ans, étudiante en troisième année du parcours Métiers du Multimédia et de l''Internet (MMI) à l''INPTIC.

Ma passion : la communication visuelle, le design graphique, la création de contenus numériques et les médias digitaux. Je combine créativité, compétences techniques et sens de l''esthétique pour donner vie à des projets innovants.

Mon ambition à long terme est de créer plusieurs activités génératrices de revenus dans les secteurs du numérique et de la création, en plaçant la créativité et l''excellence au cœur de tout ce que j''entreprends.',
  'Transformer les idées en expériences visuelles mémorables.',
  'MMI — 3ème année · INPTIC',
  'Gabon · Libreville',
  'Design Graphique · Communication Digitale · Audiovisuel',
  'Direction Artistique · Entrepreneuriat Numérique',
  'angiesohane@gmail.com'
)
on conflict (id) do nothing;

insert into public.portfolio_journey (period, title, organization, description, sort_order)
values
  ('En cours', 'DTS en Métiers du Multimédia et de l’Internet', 'INPTIC · Libreville', 'Troisième année du parcours MMI.', 1),
  ('Formation', 'Baccalauréat', 'Lycée George Mabignath · Libreville', '', 2),
  ('Projets créatifs', 'Projets Shine, R-hair et Prépa Berthe & Émile', 'Design graphique · Branding', '', 3),
  ('En cours', 'Campagne numérique sur la santé mentale au Gabon', 'Communication digitale', '', 4)
on conflict (title, organization) do nothing;

insert into public.portfolio_projects (
  content_type, project_kind, title, category, description, tags, emoji, sort_order
)
values
  ('project', 'Projet académique', 'INPTIC MAG', 'Audiovisuel · Web TV', 'Projet de Web TV étudiant incluant la production de reportages, interviews, scripts voix-off, conducteurs de tournage et teasers pour les réseaux sociaux.', array['Interviews', 'Reportages', 'Voix-off', 'Conducteur de tournage'], '', 1),
  ('project', 'Projet académique', 'MindCare', 'Entrepreneuriat · Bien-être', 'Projet entrepreneurial autour du bien-être mental avec étude de marché, modèle économique et stratégie de communication digitale.', array['Étude de marché', 'Modèle économique', 'Stratégie marketing'], '', 2),
  ('project', 'Projet académique', 'Portfolio Professionnel', 'Web Design · Personal Branding', 'Création d''un portfolio numérique complet avec présentation personnelle, galerie de projets, animations CSS et responsive design.', array['HTML / CSS', 'Animations CSS', 'Responsive Design', 'UX Design'], '', 3),
  ('work', 'Création visuelle', 'Identité visuelle Shine', 'Branding', '', array[]::text[], '', 1),
  ('work', 'Création visuelle', 'Affiche R-hair', 'Design graphique', '', array[]::text[], '', 2),
  ('work', 'Création visuelle', 'Teaser INPTIC MAG', 'Audiovisuel', '', array[]::text[], '', 3),
  ('work', 'Création visuelle', 'Campagne santé mentale', 'Design graphique', '', array[]::text[], '', 4),
  ('work', 'Création visuelle', 'Portfolio professionnel', 'Web', '', array[]::text[], '', 5),
  ('work', 'Création visuelle', 'Pub Prépa Berthe & Émile', 'Design graphique', '', array[]::text[], '', 6)
on conflict (content_type, title) do nothing;

insert into public.portfolio_skills (title, items, sort_order)
values
  ('Design Graphique', array['Création d''affiches', 'Flyers', 'Identité visuelle', 'Branding', 'Motion Design', 'Direction artistique'], 1),
  ('Production Audiovisuelle', array['Storyboard', 'Script vidéo', 'Conducteur de tournage', 'Production Web TV', 'Voix-off'], 2),
  ('Développement Web', array['HTML', 'CSS', 'JavaScript', 'Portfolio design', 'Responsive Design', 'Web Design'], 3),
  ('Communication Digitale', array['Rédaction web', 'SEO', 'SEA', 'Stratégie de contenu', 'Community Management', 'Personal Branding', 'Marketing digital'], 4),
  ('Gestion de Projet', array['Diagramme de Gantt', 'Méthode PERT', 'Planification', 'Gestion des risques', 'Organisation d''équipe'], 5),
  ('Création de Contenu', array['Réseaux sociaux', 'Teasers', 'Stratégie éditoriale', 'Animations CSS', 'UX Writing'], 6)
on conflict (title) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'portfolio-images',
  'portfolio-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can view portfolio images" on storage.objects;
create policy "Public can view portfolio images"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'portfolio-images');

drop policy if exists "Portfolio admins can upload images" on storage.objects;
create policy "Portfolio admins can upload images"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'portfolio-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select public.is_portfolio_admin())
  );

drop policy if exists "Portfolio admins can update images" on storage.objects;
create policy "Portfolio admins can update images"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'portfolio-images'
    and (select public.is_portfolio_admin())
  )
  with check (
    bucket_id = 'portfolio-images'
    and (select public.is_portfolio_admin())
  );

drop policy if exists "Portfolio admins can delete images" on storage.objects;
create policy "Portfolio admins can delete images"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'portfolio-images'
    and (select public.is_portfolio_admin())
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'portfolio-documents',
  'portfolio-documents',
  true,
  10485760,
  array['application/pdf']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can view portfolio documents" on storage.objects;
create policy "Public can view portfolio documents"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'portfolio-documents');

drop policy if exists "Portfolio admins can upload documents" on storage.objects;
create policy "Portfolio admins can upload documents"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'portfolio-documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select public.is_portfolio_admin())
  );

drop policy if exists "Portfolio admins can delete documents" on storage.objects;
create policy "Portfolio admins can delete documents"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'portfolio-documents'
    and (select public.is_portfolio_admin())
  );
