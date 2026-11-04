export function nairaToKobo(text: string): number|null {
  const value=text.trim();if(!value)return null;
  if(!/^\d+(\.\d{1,2})?$/.test(value))throw new Error("Use a price with at most two decimal places.");
  const [whole,fraction=""]=value.split("."),kobo=Number(whole)*100+Number(fraction.padEnd(2,"0"));
  if(!Number.isSafeInteger(kobo) || kobo>100000000000)throw new Error("Price is too large.");
  return kobo;
}
