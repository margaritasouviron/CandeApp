-- Paso 1/2: agregar rol standby al enum.
-- Ejecutá SOLO este archivo en el SQL Editor y esperá «Success» antes de 027.

ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'standby';
