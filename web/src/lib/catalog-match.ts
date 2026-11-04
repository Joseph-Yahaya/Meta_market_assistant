const filler=new Set(["i","im","i'm","me","my","need","want","wan","buy","find","where","can","get","please","abeg","a","an","the","some","of","for","to","dey","sell","looking","near","nearby","shop","shops"]);
export function catalogWords(query:string) {
  return query.toLowerCase().replace(/(\d+)\s+(kg|g|ml|l)\b/g,"$1$2").replace(/[^a-z0-9\s]/g," ").split(/\s+/).filter(word=>word&&!filler.has(word));
}
export function catalogMatches(query:string,product:{brand:string;name:string;variant:string;size:string}) {
  const words=catalogWords(query),haystack=`${product.brand} ${product.name} ${product.variant} ${product.size}`.toLowerCase();
  return words.length>0&&words.every(word=>haystack.includes(word));
}
