export type CatalogProduct={id:string;name:string;brand:string;variant:string;size:string;unit:string;perishable:boolean;status:string};
export type NearbyShop={shop_id:string;name:string;landmark:string;latitude:number;longitude:number;simulated:true;product_id:string;confirmed_at:string;confidence:"high"|"medium";distance_km:number;feedbackToken:string};
export type BuyerResults={simulated:true;requestedRadiusKm:number;searchedRadiusKm:number;shops:NearbyShop[];nextOffset:number|null;searchToken:string;refreshSeconds:number};
