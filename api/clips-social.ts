type ClipRow = { video_id:string; title:string; published:string; channel:string; league:string; url:string; thumbnail:string; discovered_at:string };
export default async function handler(req:any,res:any) {
 const base=process.env.SUPABASE_URL, key=process.env.SUPABASE_ANON_KEY;
 if(!base||!key){res.status(503).json({enabled:false,error:"Shared clips database is not configured yet."});return;}
 const headers={apikey:key,Authorization:"Bearer "+key,"Content-Type":"application/json"};
 const videoIds=String(req.query?.videoIds||"").split(",").filter((x:string)=>/^[\w-]{6,20}$/.test(x)).slice(0,60);
 try {
  if(req.method==="GET") {
   if(!videoIds.length){res.status(200).json({enabled:true,likes:[],comments:[]});return;}
   const filter=encodeURIComponent("("+videoIds.join(",")+")");
   const [likes,comments]=await Promise.all([
    fetch(base+"/rest/v1/clip_likes?select=video_id,user_id&video_id=in."+filter,{headers}),
    fetch(base+"/rest/v1/clip_comments?select=id,video_id,user_id,body,created_at&video_id=in."+filter+"&order=created_at.desc&limit=500",{headers})
   ]);
   if(!likes.ok||!comments.ok)throw new Error("Could not read shared clip activity.");
   res.status(200).json({enabled:true,likes:await likes.json(),comments:await comments.json()});return;
  }
  if(req.method!=="POST"){res.setHeader("Allow","GET, POST");res.status(405).end();return;}
  const {action,videoId,userId,liked,body}=req.body||{};
  if(!/^[\w-]{6,20}$/.test(videoId||"")||typeof userId!=="string"||userId.length<12||userId.length>80){res.status(400).json({error:"Invalid clip or user."});return;}
  if(action==="like") {
   const url=base+"/rest/v1/clip_likes?video_id=eq."+encodeURIComponent(videoId)+"&user_id=eq."+encodeURIComponent(userId);
   const response=liked
    ? await fetch(base+"/rest/v1/clip_likes?on_conflict=video_id,user_id",{method:"POST",headers:{...headers,Prefer:"resolution=ignore-duplicates,return=minimal"},body:JSON.stringify({video_id:videoId,user_id:userId})})
    : await fetch(url,{method:"DELETE",headers:{...headers,Prefer:"return=minimal"}});
   if(!response.ok)throw new Error("Could not update shared like.");
   res.status(200).json({ok:true});return;
  }
  if(action==="comment") {
   const clean=String(body||"").trim().slice(0,240);if(!clean){res.status(400).json({error:"Comment cannot be empty."});return;}
   const response=await fetch(base+"/rest/v1/clip_comments",{method:"POST",headers:{...headers,Prefer:"return=representation"},body:JSON.stringify({video_id:videoId,user_id:userId,body:clean})});
   if(!response.ok)throw new Error("Could not post shared comment.");
   res.status(201).json({ok:true,comment:(await response.json())[0]});return;
  }
  res.status(400).json({error:"Unknown action."});
 } catch(error:any){res.status(500).json({enabled:true,error:error?.message||"Shared clips service error."});}
}
