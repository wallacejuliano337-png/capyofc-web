export const PROFILE_MEDIA_LIMIT = 5 * 1024 * 1024;
export const PROFILE_MEDIA_ACCEPT = "image/png,image/jpeg,image/webp,image/gif";
export async function validateProfileMedia(file: File) {
  const extensions: Record<string, string[]> = {
    "image/png": ["png"],
    "image/jpeg": ["jpg", "jpeg"],
    "image/webp": ["webp"],
    "image/gif": ["gif"],
  };
  if (
    !extensions[file.type]?.includes(
      file.name.split(".").at(-1)?.toLowerCase() || "",
    )
  )
    throw new Error(
      "Escolha um arquivo PNG, JPG, WEBP ou GIF com extensão e tipo correspondentes.",
    );
  if (!file.size || file.size > PROFILE_MEDIA_LIMIT)
    throw new Error("O arquivo deve ter até 5 MB e não pode estar vazio.");
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const ascii = (start: number, end: number) =>
    String.fromCharCode(...bytes.slice(start, end));
  const valid =
    file.type === "image/gif"
      ? ["GIF87a", "GIF89a"].includes(ascii(0, 6))
      : file.type === "image/png"
        ? [137, 80, 78, 71, 13, 10, 26, 10].every((n, i) => bytes[i] === n)
        : file.type === "image/jpeg"
          ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
          : ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP";
  if (!valid)
    throw new Error(
      "O conteúdo do arquivo não corresponde ao formato informado.",
    );
}
