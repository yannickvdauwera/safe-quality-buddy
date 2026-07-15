export type VideoProvider = "youtube" | "vimeo" | "url";

export function detectVideo(url: string): { provider: VideoProvider; externalId: string | null } {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    if (host.includes("youtube.com") || host === "youtu.be" || host === "www.youtu.be") {
      let id: string | null = null;
      if (host === "youtu.be" || host === "www.youtu.be") id = u.pathname.slice(1).split("/")[0] || null;
      else if (u.pathname.startsWith("/embed/")) id = u.pathname.split("/")[2] || null;
      else if (u.pathname.startsWith("/shorts/")) id = u.pathname.split("/")[2] || null;
      else id = u.searchParams.get("v");
      return { provider: "youtube", externalId: id };
    }
    if (host.includes("vimeo.com")) {
      const seg = u.pathname.split("/").filter(Boolean);
      return { provider: "vimeo", externalId: seg[0] || null };
    }
  } catch {
    /* ignore */
  }
  return { provider: "url", externalId: null };
}

export function getEmbedUrl(provider: VideoProvider, externalId: string | null, url: string): string {
  if (provider === "youtube" && externalId)
    return `https://www.youtube.com/embed/${externalId}?enablejsapi=1&rel=0&modestbranding=1`;
  if (provider === "vimeo" && externalId) return `https://player.vimeo.com/video/${externalId}`;
  return url;
}

export function getThumbnail(provider: VideoProvider, externalId: string | null): string | null {
  if (provider === "youtube" && externalId) return `https://i.ytimg.com/vi/${externalId}/hqdefault.jpg`;
  return null;
}
