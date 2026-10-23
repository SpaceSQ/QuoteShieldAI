function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return btoa(binary);
}

export async function uriToBase64(uri: string): Promise<string> {
  if (uri.startsWith("data:")) {
    const comma = uri.indexOf(",");
    return comma >= 0 ? uri.slice(comma + 1) : uri;
  }
  try {
    const { File } = await import("expo-file-system");
    const file = new File(uri);
    return bytesToBase64(new Uint8Array(await file.arrayBuffer()));
  } catch {
    const response = await fetch(uri);
    if (!response.ok) throw new Error("Could not read that file.");
    return bytesToBase64(new Uint8Array(await response.arrayBuffer()));
  }
}
