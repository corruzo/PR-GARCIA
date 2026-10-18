-- ════════════════════════════════════════════════════════════════════════════
-- Tasa BCV: desde ahora solo la página del BCV (www.bcv.org.ve) cuenta como
-- tasa oficial. Las tasas guardadas antes desde dolarapi.com (que no siempre
-- coinciden con el BCV) pasan a 'referencial', así no sirven de base para
-- validar préstamos y pagos.
-- ════════════════════════════════════════════════════════════════════════════

update public.tasa_bcv set estado = 'referencial'
where estado = 'ok' and fuente ilike '%dolarapi%';

insert into public.app_migraciones (version) values ('20261018000200') on conflict do nothing;
