-- ════════════════════════════════════════════════════════════════════════════
-- Alta rápida de clientes: basta con el nombre; el documento y los demás datos
-- se completan después en la ficha. Si se indica documento, sigue siendo único
-- por usuario (los valores nulos no chocan entre sí).
-- ════════════════════════════════════════════════════════════════════════════

alter table public.clientes alter column numero_documento drop not null;
alter table public.clientes alter column tipo_documento set default 'V';
