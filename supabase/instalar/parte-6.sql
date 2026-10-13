-- PRGARCÍA · Instalación, parte 6 de 6. Generado por npm run db:bundle.
-- Ejecuta las partes en orden (1 a 6) en Supabase → SQL Editor, una sola vez cada una.
begin;
-- 20261013000100_cliente_rapido.sql
alter table public.clientes alter column numero_documento drop not null;
alter table public.clientes alter column tipo_documento set default 'V';
commit;
