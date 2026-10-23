import * as DocumentPicker from 'expo-document-picker';
import { supabase } from './supabase';

export const MEDICAL_STUDIES_BUCKET = 'medical-studies';

export type MedicalStudyDocument = {
  id: string;
  patient_id: string;
  title: string;
  keywords: string | null;
  study_date: string;
  storage_path: string;
  file_name: string;
  uploaded_by: string;
  created_at: string;
};

export type StudyListFilters = {
  search?: string;
  fromDate?: string;
  toDate?: string;
};

function escapeIlike(value: string) {
  return value.replace(/[%_\\]/g, '\\$&');
}

export async function fetchMedicalStudies(
  patientId: string,
  filters: StudyListFilters = {}
): Promise<MedicalStudyDocument[]> {
  let q = supabase
    .from('medical_study_documents')
    .select('*')
    .eq('patient_id', patientId)
    .order('study_date', { ascending: false })
    .order('created_at', { ascending: false });

  const search = filters.search?.trim();
  if (search) {
    const s = escapeIlike(search);
    q = q.or(`title.ilike.%${s}%,keywords.ilike.%${s}%`);
  }
  if (filters.fromDate) q = q.gte('study_date', filters.fromDate);
  if (filters.toDate) q = q.lte('study_date', filters.toDate);

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as MedicalStudyDocument[];
}

export async function getMedicalStudySignedUrl(storagePath: string, expiresIn = 3600) {
  const { data, error } = await supabase.storage
    .from(MEDICAL_STUDIES_BUCKET)
    .createSignedUrl(storagePath, expiresIn);
  if (error) throw error;
  return data.signedUrl;
}

export async function pickPdfDocument() {
  const result = await DocumentPicker.getDocumentAsync({
    type: 'application/pdf',
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled || !result.assets?.[0]) return null;
  const asset = result.assets[0];
  if (asset.mimeType && asset.mimeType !== 'application/pdf') {
    throw new Error('Solo se permiten archivos PDF');
  }
  return asset;
}

async function uriToArrayBuffer(uri: string): Promise<ArrayBuffer> {
  const response = await fetch(uri);
  if (!response.ok) throw new Error('No se pudo leer el archivo');
  return response.arrayBuffer();
}

export async function uploadMedicalStudy(params: {
  patientId: string;
  userId: string;
  title: string;
  keywords?: string;
  studyDate: string;
  fileUri: string;
  fileName: string;
}) {
  const title = params.title.trim();
  if (!title) throw new Error('Indica un título');

  const studyDate = /^\d{4}-\d{2}-\d{2}$/.test(params.studyDate)
    ? params.studyDate
    : new Date().toISOString().slice(0, 10);

  const safeName = params.fileName.replace(/[^\w.\-() ]+/g, '_') || 'estudio.pdf';
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const storagePath = `${params.patientId}/${unique}-${safeName}`;

  const body = await uriToArrayBuffer(params.fileUri);
  const { error: uploadError } = await supabase.storage
    .from(MEDICAL_STUDIES_BUCKET)
    .upload(storagePath, body, { contentType: 'application/pdf', upsert: false });

  if (uploadError) throw uploadError;

  const { data, error } = await supabase
    .from('medical_study_documents')
    .insert({
      patient_id: params.patientId,
      title,
      keywords: params.keywords?.trim() || null,
      study_date: studyDate,
      storage_path: storagePath,
      file_name: safeName,
      uploaded_by: params.userId,
    })
    .select('*')
    .single();

  if (error) {
    await supabase.storage.from(MEDICAL_STUDIES_BUCKET).remove([storagePath]);
    throw error;
  }

  return data as MedicalStudyDocument;
}

export async function deleteMedicalStudy(doc: MedicalStudyDocument) {
  const { error: storageError } = await supabase.storage
    .from(MEDICAL_STUDIES_BUCKET)
    .remove([doc.storage_path]);
  if (storageError) throw storageError;

  const { error } = await supabase.from('medical_study_documents').delete().eq('id', doc.id);
  if (error) throw error;
}
