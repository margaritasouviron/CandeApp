-- Paso 1: tipo turno_medico en care_log_type (ejecutar solo; luego 031)

ALTER TYPE care_log_type ADD VALUE IF NOT EXISTS 'turno_medico';
