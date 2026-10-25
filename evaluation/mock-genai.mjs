export class GoogleGenAI {
  models = { generateContent: async request => {
    globalThis.__requests.push(request);
    let item = globalThis.__responses.shift();
    if(typeof item === "function") item=await item(request);
    if(item?.references && request.config?.responseJsonSchema?.properties?.title?.type==="object"){
      const refs=new Map(item.references.map(x=>[x.unitId,x.sourceIds]));
      const content=(text,id)=>({text,sourceIds:refs.get(id)??[]});
      item={title:content(item.title,"title"),slides:item.slides.map((s,i)=>({role:s.role,heading:content(s.heading,"slide."+i+".heading"),bullets:s.bullets.map((b,j)=>content(b,"slide."+i+".bullet."+j)),speakerNotes:content(s.speakerNotes,"slide."+i+".notes"),imageIds:s.imageIds}))};
    }
    if (item instanceof Error) throw item;
    return { text: typeof item === 'string' ? item : JSON.stringify(item) };
  }};
}
