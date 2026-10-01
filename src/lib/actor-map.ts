import type {Requirement} from './types';
import {text} from './i18n';
import {csvCell} from './helpers';
/** Madison working proposal: who uses which RFP requirement. `unsure` = inferred, not stated in the RFP; confirm with Weride. */
export interface Actor {key:string;ids:string[];unsure:string[];}
export const actors:Actor[]=[
  {key:'actorPassenger',ids:['FN-BKG-01','FN-BKG-02','FN-PAS-01','FN-PAS-02','FN-COM-01','FN-VOU-01','EXP-PAS-01','EXP-DRV-01'],unsure:[]},
  {key:'actorDriver',ids:['FN-DIS-01','FN-DRV-01','FN-DRV-02','FN-COM-01','REG-PWD-01','REG-PWD-02','REG-PWD-03','REG-PWD-04','REG-DAC-01','REG-DAC-02','EXP-AI-01','EXP-DRV-01'],unsure:['EXP-AI-01']},
  {key:'actorHotel',ids:['FN-BKG-01','FN-BKG-02','FN-HTL-01','EXP-FLT-01','EXP-M365-01'],unsure:['EXP-FLT-01']},
  {key:'actorAdmin',ids:['FN-BKG-01','FN-BKG-02','FN-DIS-01','FN-DIS-02','FN-COM-01','FN-VOU-01','FN-INT-01','FN-SUP-01','REG-PWD-01','REG-PWD-02','REG-PWD-03','REG-PWD-05','REG-DAC-01','REG-DAC-02','REG-DAC-03','REG-SWE-01','REG-SWE-02','REG-SWE-03','EXP-AI-01','EXP-FLT-01','EXP-M365-02','EXP-DRV-01'],unsure:['FN-SUP-01']},
  {key:'actorCarrier',ids:['FN-SUP-01','REG-DAC-01','REG-SWE-03'],unsure:['REG-DAC-01','REG-SWE-03']},
];
export const actorsOf=(id:string)=>actors.filter(a=>a.ids.includes(id));
/** Big product features; every requirement belongs to exactly one. */
export const features:{key:string;label:string;ids:string[]}[]=[
  {key:'auth',label:'actorFeatureAuth',ids:['FN-INT-01']},
  {key:'booking',label:'actorFeatureBooking',ids:['FN-BKG-01','FN-PAS-01','FN-HTL-01','EXP-M365-01']},
  {key:'pricing',label:'actorFeaturePricing',ids:['FN-BKG-02','FN-VOU-01','EXP-DRV-01']},
  {key:'dispatch',label:'actorFeatureDispatch',ids:['FN-DIS-01','FN-DIS-02','EXP-AI-01','EXP-FLT-01','EXP-M365-02']},
  {key:'trip',label:'actorFeatureTrip',ids:['FN-DRV-01','FN-DRV-02','FN-COM-01']},
  {key:'payments',label:'actorFeaturePayments',ids:['FN-PAS-02','EXP-PAS-01','REG-SWE-02','REG-SWE-03']},
  {key:'fleet',label:'actorFeatureFleet',ids:['FN-SUP-01']},
  {key:'driver-rights',label:'actorFeatureDriverRights',ids:['REG-PWD-01','REG-PWD-02','REG-PWD-03','REG-PWD-04','REG-PWD-05']},
  {key:'tax',label:'actorFeatureTax',ids:['REG-DAC-01','REG-DAC-02','REG-DAC-03','REG-SWE-01']},
];
export const featureOf=(id:string)=>features.find(f=>f.ids.includes(id));
/** One row per actor × requirement kept by `keep`, in feature order. */
export function actorMapCsv(requirements:Requirement[],keep:(a:Actor,id:string)=>boolean,label:(key:string)=>string,language:string):string{
  const byId=new Map(requirements.map(r=>[r.id,r])),lines=[['Actor','Feature','ID','Tier','Module','Title','Inferred','Shared by']];
  for(const a of actors)for(const f of features)for(const id of f.ids){const r=byId.get(id);if(r&&a.ids.includes(id)&&keep(a,id))lines.push([label(a.key),label(f.label),id,r.tier,r.module,text(r.title,language),a.unsure.includes(id)?'yes':'no',actorsOf(id).map(x=>label(x.key)).join(' / ')]);}
  return '\uFEFF'+lines.map(row=>row.map(csvCell).join(',')).join('\r\n');
}
