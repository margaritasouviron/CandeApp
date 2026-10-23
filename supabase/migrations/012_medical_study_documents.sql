-- PDFs de estudios médicos (Storage + metadata)

CREATE TABLE IF NOT EXISTS medical_study_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patient(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  keywords TEXT,
  study_date DATE NOT NULL DEFAULT CURRENT_DATE,
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  uploaded_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS medical_study_documents_patient_date
  ON medical_study_documents (patient_id, study_date DESC);

ALTER TABLE medical_study_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY medical_study_documents_select ON medical_study_documents
  FOR SELECT TO authenticated USING (true);

CREATE POLICY medical_study_documents_insert ON medical_study_documents
  FOR INSERT TO authenticated
  WITH CHECK (
    uploaded_by = auth.uid()
    AND (is_organizador() OR is_enfermera())
  );

CREATE POLICY medical_study_documents_delete ON medical_study_documents
  FOR DELETE TO authenticated
  USING (is_organizador());

INSERT INTO storage.buckets (id, name, public)
VALUES ('medical-studies', 'medical-studies', false)
ON CONFLICT (id) DO UPDATE SET public = false;

CREATE POLICY medical_studies_storage_select ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'medical-studies');

CREATE POLICY medical_studies_storage_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'medical-studies');

CREATE POLICY medical_studies_storage_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'medical-studies' AND is_organizador());
