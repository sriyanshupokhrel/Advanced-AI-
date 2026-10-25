import sharp from "sharp";
import { inspectImage, type InspectionResult } from "./image-inspection";
import { MAX_IMAGE_BYTES, MAX_IMAGE_PIXELS } from "@/lib/validation/image-schema";
/** Header limits first, then full pixel decode with libvips resource limits. Original bytes are preserved. */
export async function decodeImage(bytes:Uint8Array):Promise<InspectionResult>{
  if(bytes.length>MAX_IMAGE_BYTES) return {ok:false,error:"Image must be 5 MB or smaller."};
  const header=inspectImage(bytes);
  if(!header.ok)return header;
  try{
    const decoder=sharp(Buffer.from(bytes),{limitInputPixels:MAX_IMAGE_PIXELS,failOn:"warning",animated:true});
    const metadata=await decoder.metadata();
    const frames=metadata.pages??1;
    if(frames>100 || header.image.width*header.image.height*frames>MAX_IMAGE_PIXELS) return {ok:false,error:"Image frames exceed the 40 megapixel decoding limit."};
    await decoder.timeout({seconds:10}).raw().toBuffer();
    return header;
  }catch{return {ok:false,error:"This image is damaged or incomplete and cannot be decoded. Upload a valid PNG, JPEG, WebP or GIF."};}
}
