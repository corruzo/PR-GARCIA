import { getSupabaseClient } from '../_lib/db.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const supabase = getSupabaseClient();

    if (!supabase) {
      return res.status(500).json({
        ok: false,
        error: 'El servicio de tasas no está disponible.',
      });
    }

    // Prefiere la última tasa oficial; si nunca se guardó una, la referencial.
    const latestOf = (official) => {
      let query = supabase.from('tasa_bcv').select('tasa,fuente,fecha_hora,estado');
      if (official) query = query.eq('estado', 'ok');
      return query.order('fecha_hora', { ascending: false }).limit(1).maybeSingle();
    };
    let { data, error } = await latestOf(true);
    if (!error && !data) ({ data, error } = await latestOf(false));

    if (error) {
      res.setHeader('Cache-Control', 'no-store');
      console.error('[api/bcv/latest] No se pudo consultar la tasa guardada.');
      return res.status(500).json({ ok: false, error: 'No se pudo consultar la tasa BCV guardada.' });
    }

    if (!data) {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(404).json({ ok: false, error: 'No hay tasa BCV guardada aún.' });
    }

    return res.status(200).json({
      ok: true,
      value: Number(data.tasa),
      source: data.fuente,
      fetchedAt: data.fecha_hora,
      verifiedAgainstBCV: data.estado === 'ok',
    });
  } catch {
    res.setHeader('Cache-Control', 'no-store');
    console.error('[api/bcv/latest] Error interno al consultar la tasa guardada.');
    return res.status(500).json({ ok: false, error: 'Error interno del servidor.' });
  }
}
