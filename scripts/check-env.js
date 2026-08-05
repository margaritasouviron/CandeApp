const required = ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_ANON_KEY'];

function isPlaceholder(url, key) {
  return (
    !url ||
    !key ||
    url.includes('your-project') ||
    key.includes('your-anon') ||
    url.includes('placeholder')
  );
}

const missing = required.filter((key) => !process.env[key]?.trim());
const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

if (missing.length > 0 || isPlaceholder(url, key)) {
  const where = process.env.VERCEL
    ? 'Vercel → Project Settings → Environment Variables'
    : 'archivo .env en la raíz del proyecto';

  console.error(
    `\n[candeApp] Supabase NO configurado correctamente en el BUILD:\n` +
      (missing.length
        ? missing.map((k) => `  - Falta: ${k}`).join('\n') + '\n'
        : '') +
      (isPlaceholder(url, key)
        ? '  - Usaste valores de ejemplo (your-project / your-anon-key). Pon las claves REALES de Supabase → Settings → API.\n'
        : '') +
      `\nConfigúralas en ${where} y vuelve a desplegar (Redeploy).\n`
  );

  if (process.env.VERCEL === '1') {
    process.exit(1);
  }
}
