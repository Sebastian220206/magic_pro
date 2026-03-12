import { supabase } from "./supabase";

/**
 * Uploads an audio file to Supabase Storage
 * @param file The file to upload
 * @param path The path in storage (e.g., 'samples/name.wav')
 * @returns The public URL of the uploaded file
 */
export const uploadAudio = async (
    file: File,
    path: string
): Promise<string> => {
    // 1. Upload the file to the 'audio-assets' bucket
    const { data, error } = await supabase.storage
        .from('audio-assets')
        .upload(path, file, {
            cacheControl: '3600',
            upsert: true
        });

    if (error) {
        console.error("Supabase upload error:", error);
        throw error;
    }

    // 2. Get the public URL for the file
    const { data: { publicUrl } } = supabase.storage
        .from('audio-assets')
        .getPublicUrl(path);

    return publicUrl;
};
