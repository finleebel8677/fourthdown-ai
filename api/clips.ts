export default async function handler(req: any, res: any) {
  res.setHeader("Cache-Control", "s-maxage=900, stale-while-revalidate=1800");
  res.setHeader("Access-Control-Allow-Origin", "*");
  const channels = [
    { id: "UCDVYQ4Zhbm3S2dlz7P1GBDg", name: "NFL", league: "nfl" },
    { id: "UCuFia3XbgJkX74PlvJzHmjQ", name: "NCAA Football", league: "college" }
  ];
  const decode = (value: string) => value
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">").replace(/&#(\d+);/g, (_m, n) => String.fromCodePoint(Number(n)));
  const feeds = await Promise.all(channels.map(async channel => {
    try {
      const response = await fetch(
        `https://www.youtube.com/feeds/videos.xml?channel_id=${channel.id}`,
        { headers: { "User-Agent": "Mozilla/5.0 GRIDIRON-IQ-Clips/1.0" } }
      );
      if (!response.ok) throw new Error(`YouTube feed returned HTTP ${response.status}`);
      const xml = await response.text();
      const entries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)];
      return entries.map(match => {
        const entry = match[1];
        const get = (tag: string) => {
          const found = entry.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
          return found ? decode(found[1].trim()) : "";
        };
        const videoId = get("yt:videoId");
        if (!videoId) return null;
        return {
          id: videoId, videoId, title: get("title"),
          published: get("published"), channel: channel.name,
          league: channel.league,
          url: `https://www.youtube.com/watch?v=${videoId}`,
          thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
        };
      }).filter(Boolean);
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Feed unavailable", channel: channel.name, league: channel.league };
    }
  }));
  const videos = feeds.flat().filter((item: any) => item && item.videoId)
    .sort((a: any, b: any) => Date.parse(b.published) - Date.parse(a.published));
  const errors = feeds.flat().filter((item: any) => item && item.error);
  res.status(200).json({ videos, errors, updatedAt: new Date().toISOString(), sources: channels });
}