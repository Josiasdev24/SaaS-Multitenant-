import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

/**
 * Photos des élèves, enregistrées une seule fois (à l'inscription ou sur la fiche de l'élève)
 * et affichées automatiquement dans le cadre photo du bulletin.
 * Les photos sont privées : on les affiche avec des adresses temporaires.
 */

export const PHOTO_BUCKET = "student-photos";
const MAX_SIDE = 640; // pixels : suffisant pour un cadre de bulletin, et léger (≈ 50 Ko)
const MAX_BYTES = 8 * 1024 * 1024; // photo d'origine

/** Réduit la photo (comme le fait un téléphone pour un message) et la convertit en JPEG. */
export async function resizeImage(file: File, maxSide = MAX_SIDE, quality = 0.85): Promise<Blob> {
  if (!file.type.startsWith("image/")) throw new Error("Ce fichier n'est pas une image.");
  if (file.size > MAX_BYTES) throw new Error("La photo est trop lourde (8 Mo au maximum).");
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("Ce format de photo n'est pas pris en charge. Utilisez une photo JPEG ou PNG.");
  }
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Impossible de préparer la photo.");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Impossible de préparer la photo."))), "image/jpeg", quality),
  );
}

function fail(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

/** Enregistre la photo d'un élève, remplace l'ancienne et renvoie son chemin. */
export async function uploadStudentPhoto(studentId: string, file: File | Blob, previousPath?: string | null): Promise<string> {
  const blob = file instanceof File ? await resizeImage(file) : file;
  const path = `${studentId}/${Date.now()}.jpg`;
  const up = await supabase.storage.from(PHOTO_BUCKET).upload(path, blob, { contentType: "image/jpeg", upsert: false });
  fail(up.error);
  const upd = await supabase.from("students").update({ photo_path: path } as never).eq("id", studentId);
  if (upd.error) {
    await supabase.storage.from(PHOTO_BUCKET).remove([path]);
    throw new Error(upd.error.message);
  }
  if (previousPath) await supabase.storage.from(PHOTO_BUCKET).remove([previousPath]);
  return path;
}

export async function removeStudentPhoto(studentId: string, path: string): Promise<void> {
  const upd = await supabase.from("students").update({ photo_path: null } as never).eq("id", studentId);
  fail(upd.error);
  await supabase.storage.from(PHOTO_BUCKET).remove([path]);
}

/* ---- adresses temporaires, demandées par lots (50 bulletins = une seule demande) ---- */

type Waiting = { path: string; resolve: (url: string | null) => void };
let queue: Waiting[] = [];
let timer: number | undefined;

async function flush(): Promise<void> {
  const batch = queue;
  queue = [];
  timer = undefined;
  const paths = [...new Set(batch.map((b) => b.path))];
  const urls = new Map<string, string>();
  try {
    const { data } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrls(paths, 3600);
    for (const row of data ?? []) {
      if (row.path && row.signedUrl) urls.set(row.path, row.signedUrl);
    }
  } catch {
    /* pas de photo affichée : le cadre reste vide */
  }
  for (const b of batch) b.resolve(urls.get(b.path) ?? null);
}

export function signedPhotoUrl(path: string): Promise<string | null> {
  return new Promise((resolve) => {
    queue.push({ path, resolve });
    if (timer === undefined) timer = window.setTimeout(() => void flush(), 20);
  });
}

/** Adresse de la photo d'un élève (ou null s'il n'en a pas). */
export function usePhotoUrl(path: string | null | undefined): string | null {
  const query = useQuery({
    queryKey: ["student-photo", path ?? ""],
    queryFn: () => signedPhotoUrl(path as string),
    enabled: Boolean(path),
    staleTime: 50 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
  return path ? (query.data ?? null) : null;
}
