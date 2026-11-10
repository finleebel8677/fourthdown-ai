export default async function handler(req:any,res:any) {
 const base=process.env.SUPABASE_URL, key=process.env.SUPABASE_ANON_KEY;
 res.setHeader("Cache-Control","s-maxage=900, stale-while-revalidate=1800");
 res.setHeader("Access-Control-Allow-Origin","*");
 const channels=[{id:"UCDVYQ4Zhbm3S2dlz7P1GBDg",name:"NFL",league:"nfl"},{id:"UCuFia3XbgJkX74PlvJzHmjQ",name:"NCAA Football",league:"college"}];
 const decode=(value:string)=>value.replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&#(\d+);/g,(_m,n)=>String.fromCodePoint(Number(n)));
 const feeds=await Promise.all(channels.map(async channel=>{
  try{
   const response=await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${channel.id}`,{headers:{"User-Agent":"Mozilla/5.0 GRIDIRON-IQ-Clips/1.0"}});
   if(!response.ok)throw new Error(`YouTube feed returned HTTP ${response.status}`);
   const xml=await response.text();
   return [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map(match=>{
    const entry=match[1];const get=(tag:string)=>{const found=entry.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));return found?decode(found[1].trim()):"";};
    const videoId=get("yt:videoId");if(!videoId)return null;
    return {video_id:videoId,title:get("title"),published:get("published"),channel:channel.name,league:channel.league,url:`https://www.youtube.com/watch?v=${videoId}`,thumbnail:`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`};
   }).filter(Boolean);
  }catch(error){return {error:error instanceof Error?error.message:"Feed unavailable",channel:channel.name,league:channel.league};}
 }));
 const fresh=feeds.flat().filter((x:any)=>x?.video_id);
 const errors=feeds.flat().filter((x:any)=>x?.error);
 let videos:any[]=fresh.map((x:any)=>({...x,id:x.video_id,videoId:x.video_id}));
 let archiveEnabled=false;
 if(base&&key){
  const headers={apikey:key,Authorization:"Bearer "+key,"Content-Type":"application/json"};
  if(fresh.length){
   const saved=await fetch(base+"/rest/v1/clip_archive?on_conflict=video_id",{method:"POST",headers:{...headers,Prefer:"resolution=merge-duplicates,return=minimal"},body:JSON.stringify(fresh)});
   if(!saved.ok)errors.push({channel:"Shared archive",error:"Could not save new clips to database."});
  }
  const archived=await fetch(base+"/rest/v1/clip_archive?select=video_id,title,published,channel,league,url,thumbnail,discovered_at&order=published.desc&limit=5000",{headers});
  if(archived.ok){
   const rows:ClipRow[]=await archived.json();archiveEnabled=true;
   videos=rows.map(x=>({id:x.video_id,videoId:x.video_id,title:x.title,published:x.published,channel:x.channel,league:x.league,url:x.url,thumbnail:x.thumbnail}));
  }else errors.push({channel:"Shared archive",error:"Could not load archived clips."});
 }
 videos.sort((a:any,b:any)=>Date.parse(b.published)-Date.parse(a.published));
 res.status(200).json({videos,errors,archiveEnabled,updatedAt:new Date().toISOString(),sources:channels,refreshHours:2});
}
type ClipRow={video_id:string;title:string;published:string;channel:string;league:string;url:string;thumbnail:string;discovered_at:string};
