import type {Locale,Localized,ProductGroup,ProductItem} from './types';
import {blankText} from './types';
/** Baseline: working assumption from the WeRide master handover (§4, §6, §8, §31): not confirmed scope. English follows the handover; vi/sv are working translations. */
const L=(en:string,vi=en,sv=en):Localized=>({en,vi,sv});
export const groups={access:L('Access & Actor','Truy cập & Actor','Åtkomst & aktörer'),core:L('Core Business','Nghiệp vụ lõi','Kärnverksamhet'),ops:L('Channels & Operations','Kênh & Vận hành','Kanaler & drift'),control:L('Control & Platform','Kiểm soát & Nền tảng','Styrning & plattform')};
interface Module {name:Localized;group:keyof typeof groups;subs:Localized[];}
const modules:Record<string,Module>={
  auth:{name:L('Auth & Access','Xác thực & Truy cập','Inloggning & åtkomst'),group:'access',subs:[L('Authentication','Xác thực','Autentisering'),L('Authorization','Phân quyền','Behörighet'),L('Role / permission','Vai trò / quyền','Roll / behörighet'),L('Account access','Truy cập tài khoản','Kontoåtkomst'),L('Session / security','Phiên / bảo mật','Session / säkerhet'),L('Partner / API access','Truy cập đối tác / API','Partner- / API-åtkomst')]},
  passenger:{name:L('Passenger Management','Quản lý hành khách','Passagerarhantering'),group:'access',subs:[L('Passenger identity / profile','Danh tính / hồ sơ hành khách','Passageraridentitet / profil'),L('Contact info','Thông tin liên hệ','Kontaktuppgifter'),L('Passenger history','Lịch sử hành khách','Passagerarhistorik'),L('Booking / trip association','Liên kết booking / chuyến','Koppling till bokning / resa'),L('Payment / support context','Ngữ cảnh thanh toán / hỗ trợ','Betalnings- / supportkontext')]},
  driver:{name:L('Driver Management','Quản lý tài xế','Förarhantering'),group:'access',subs:[L('Driver profile','Hồ sơ tài xế','Förarprofil'),L('Driver documents','Giấy tờ tài xế','Förardokument'),L('Verification / KYC','Xác minh / KYC','Verifiering / KYC'),L('Tax data','Dữ liệu thuế','Skatteuppgifter'),L('Driver status','Trạng thái tài xế','Förarstatus'),L('Fleet association','Liên kết đội xe','Flottkoppling'),L('Trip history','Lịch sử chuyến','Resehistorik'),L('Earnings / ledger context','Thu nhập / sổ cái','Intäkter / huvudbok'),L('Document / compliance state','Trạng thái giấy tờ / tuân thủ','Dokument- / efterlevnadsstatus')]},
  hotel:{name:L('Hotel / B2B Management','Quản lý khách sạn / B2B','Hotell- / B2B-hantering'),group:'access',subs:[L('Hotel / B2B organization','Tổ chức khách sạn / B2B','Hotell- / B2B-organisation'),L('Hotel users','Người dùng khách sạn','Hotellanvändare'),L('Guest / passenger relationship','Quan hệ khách / hành khách','Relation gäst / passagerare'),L('Booking history','Lịch sử booking','Bokningshistorik'),L('Pricing / commercial context','Giá / điều khoản thương mại','Pris- / affärsvillkor'),L('Billing / reporting context','Hoá đơn / báo cáo','Fakturering / rapportering')]},
  fleet:{name:L('Fleet Management','Quản lý đội xe','Flotthantering'),group:'access',subs:[L('Fleet partner profile','Hồ sơ đối tác đội xe','Flottpartnerprofil'),L('Fleet users','Người dùng đội xe','Flottanvändare'),L('Vehicles','Phương tiện','Fordon'),L('Drivers belonging to fleet','Tài xế thuộc đội xe','Förare i flottan'),L('Capacity','Năng lực','Kapacitet'),L('Availability','Tình trạng sẵn sàng','Tillgänglighet'),L('Assigned jobs','Chuyến được giao','Tilldelade uppdrag'),L('Fleet performance','Hiệu suất đội xe','Flottans prestanda'),L('Financial / settlement context','Tài chính / quyết toán','Ekonomi / avräkning')]},
  booking:{name:L('Booking Management','Quản lý booking','Bokningshantering'),group:'core',subs:[L('Create','Tạo','Skapa'),L('View','Xem','Visa'),L('Modify','Sửa','Ändra'),L('Cancel','Huỷ','Avboka'),L('Booking status','Trạng thái booking','Bokningsstatus'),L('Booking timeline','Dòng thời gian booking','Bokningstidslinje'),L('Source / channel','Nguồn / kênh','Källa / kanal'),L('History','Lịch sử','Historik')]},
  pricing:{name:L('Pricing & Quote','Giá & Báo giá','Prissättning & offert'),group:'core',subs:[L('Quote','Báo giá','Offert'),L('Fare / rate','Giá cước / biểu giá','Taxa / pris'),L('Pricing policy','Chính sách giá','Prispolicy'),L('Currency','Tiền tệ','Valuta'),L('Partner / hotel pricing context','Giá cho đối tác / khách sạn','Partner- / hotellpriser'),L('Adjustment context','Điều chỉnh giá','Prisjusteringar')]},
  trip:{name:L('Trip & Dispatch','Chuyến đi & Điều phối','Resor & trafikledning'),group:'core',subs:[L('Trip creation','Tạo chuyến','Skapa resa'),L('Assignment','Phân công','Tilldelning'),L('Reassignment','Phân công lại','Omfördelning'),L('Dispatch','Điều phối','Trafikledning'),L('Trip status','Trạng thái chuyến','Resestatus'),L('Trip timeline','Dòng thời gian chuyến','Resetidslinje'),L('Exception handling','Xử lý ngoại lệ','Avvikelsehantering'),L('Driver / fleet operational state','Trạng thái vận hành tài xế / đội xe','Driftstatus för förare / flotta')]},
  payment:{name:L('Payment, Ledger & Settlement','Thanh toán, Sổ cái & Quyết toán','Betalning, huvudbok & avräkning'),group:'core',subs:[L('Pay before','Trả trước','Betala i förväg'),L('Pay after','Trả sau','Betala efteråt'),L('Wallet','Ví','Plånbok'),L('Ledger','Sổ cái','Huvudbok'),L('Settlement / reconciliation','Quyết toán / đối soát','Avräkning / avstämning')]},
  channels:{name:L('Channels & Open API','Kênh & Open API','Kanaler & Open API'),group:'ops',subs:[L('Booking.com'),L('Future booking channels','Kênh booking tương lai','Framtida bokningskanaler'),L('External partners','Đối tác bên ngoài','Externa partner'),L('Open API clients','Client Open API','Open API-klienter'),L('Webhooks','Webhook','Webhooks'),L('Channel configuration','Cấu hình kênh','Kanalkonfiguration'),L('Credentials / access','Thông tin xác thực / quyền truy cập','Inloggningsuppgifter / åtkomst'),L('Event reception','Nhận sự kiện','Mottagning av händelser')]},
  notification:{name:L('Notification & Support','Thông báo & Hỗ trợ','Aviseringar & support'),group:'ops',subs:[L('In-app','Trong app','I appen'),L('Push'),L('SMS'),L('Email','Email','E-post'),L('Support','Hỗ trợ','Support')]},
  sync:{name:L('Sync, Exception & Data Reliability','Đồng bộ, Ngoại lệ & Độ tin cậy dữ liệu','Synk, avvikelser & datatillförlitlighet'),group:'ops',subs:[L('Event ID / external ID','Event ID / external ID','Händelse-ID / externt ID'),L('Idempotency key','Khoá idempotency','Idempotensnyckel'),L('Duplicate detection','Phát hiện trùng lặp','Dubblettdetektering'),L('Processing status','Trạng thái xử lý','Bearbetningsstatus'),L('Raw payload storage','Lưu raw payload','Lagring av rå payload'),L('Retry','Thử lại (retry)','Nytt försök'),L('Replay / reprocess','Chạy lại / xử lý lại','Uppspelning / ombearbetning'),L('Drift detection','Phát hiện drift','Avvikelsedetektering (drift)'),L('Reconciliation','Đối soát','Avstämning'),L('Manual intervention','Can thiệp thủ công','Manuellt ingripande')]},
  reporting:{name:L('Reporting, Audit & Compliance','Báo cáo, Kiểm toán & Tuân thủ','Rapportering, revision & efterlevnad'),group:'control',subs:[L('Operational reports','Báo cáo vận hành','Driftrapporter'),L('Booking / trip reports','Báo cáo booking / chuyến','Boknings- / reserapporter'),L('Driver / fleet reports','Báo cáo tài xế / đội xe','Förar- / flottrapporter'),L('Hotel / B2B reports','Báo cáo khách sạn / B2B','Hotell- / B2B-rapporter'),L('Financial reports','Báo cáo tài chính','Finansiella rapporter'),L('Audit trail','Nhật ký kiểm toán','Revisionsspår'),L('Compliance reporting','Báo cáo tuân thủ','Efterlevnadsrapportering'),L('DAC7')]},
  admin:{name:L('Admin & System Configuration','Quản trị & Cấu hình hệ thống','Administration & systemkonfiguration'),group:'control',subs:[L('User management','Quản lý người dùng','Användarhantering'),L('Role / permission','Vai trò / quyền','Roll / behörighet'),L('Master data','Dữ liệu gốc','Masterdata'),L('Channel configuration','Cấu hình kênh','Kanalkonfiguration'),L('Notification configuration','Cấu hình thông báo','Aviseringskonfiguration'),L('Payment configuration','Cấu hình thanh toán','Betalningskonfiguration'),L('Compliance configuration','Cấu hình tuân thủ','Efterlevnadskonfiguration'),L('System settings','Cài đặt hệ thống','Systeminställningar'),L('Monitoring','Giám sát','Övervakning'),L('Error logs','Log lỗi','Felloggar'),L('Audit logs','Log kiểm toán','Granskningsloggar')]},
};
/** `indirect` = ✓* in §8: indirect, read-only or context; exact capability still needs clarification. */
interface Actor {key:string;name:Localized;channel:Localized;modules:string[];indirect:string[];}
const actors:Actor[]=[
  {key:'passenger',name:L('Passenger','Hành khách','Passagerare'),channel:L('Passenger Web / App','Web / App hành khách','Passagerarwebb / app'),modules:['auth','passenger','booking','pricing','trip','payment','notification'],indirect:['trip']},
  {key:'driver',name:L('Driver','Tài xế','Förare'),channel:L('Driver Mobile App','App di động tài xế','Förarapp (mobil)'),modules:['auth','driver','fleet','booking','trip','payment','notification','reporting'],indirect:['fleet','booking','reporting']},
  {key:'hotel',name:L('Hotel Manager','Quản lý khách sạn','Hotellchef'),channel:L('Hotel Web Portal','Cổng web khách sạn','Hotellportal (webb)'),modules:['auth','passenger','hotel','booking','pricing','trip','payment','notification','reporting'],indirect:['trip','reporting']},
  {key:'admin',name:L('Admin / Operator','Admin / Vận hành','Admin / operatör'),channel:L('Admin Web Portal','Cổng web Admin','Adminportal (webb)'),modules:Object.keys(modules),indirect:[]},
  {key:'fleet',name:L('Fleet Partner','Đối tác đội xe','Flottpartner'),channel:L('Fleet Web Portal','Cổng web đội xe','Flottportal (webb)'),modules:['auth','driver','fleet','trip','payment','notification','reporting'],indirect:['reporting']},
  {key:'partner',name:L('External Partner','Đối tác bên ngoài','Extern partner'),channel:L('Open API / Webhook'),modules:['auth','booking','pricing','payment','channels','notification','sync'],indirect:['payment']},
];
export const groupKeys=Object.keys(groups) as Exclude<ProductGroup,''>[];
const stamp={description:blankText(),originalLocale:'en' as Locale,channel:blankText(),actors:[] as string[],indirect:[] as string[],group:'' as ProductGroup,parentId:'',version:0,createdBy:'',createdByName:'',updatedBy:'',updatedByName:''};
/** The handover as product items with stable ids, so a second import is refused instead of duplicated. */
export function baselineItems():ProductItem[]{
  const keys=Object.keys(modules);
  return [
    ...actors.map((a,order):ProductItem=>({...stamp,id:'a-'+a.key,kind:'actor',name:a.name,channel:a.channel,status:'confirmed',order})),
    ...keys.map((k,order):ProductItem=>({...stamp,id:'m-'+k,kind:'module',name:modules[k].name,group:modules[k].group,status:'confirmed',order,actors:actors.filter(a=>a.modules.includes(k)).map(a=>'a-'+a.key),indirect:actors.filter(a=>a.indirect.includes(k)).map(a=>'a-'+a.key)})),
    ...keys.flatMap(k=>modules[k].subs.map((name,order):ProductItem=>({...stamp,id:`s-${k}-${order+1}`,kind:'sub',parentId:'m-'+k,name,status:'derived',order}))),
  ];
}
/** Items that came from the handover import (stable ids), as opposed to ones the team authored. */
export const baselineIds=new Set(baselineItems().map(i=>i.id));
export const newProductItem=(kind:ProductItem['kind'],items:ProductItem[],extra:Partial<ProductItem>={}):ProductItem=>{
  const siblings=items.filter(i=>i.kind===kind&&i.parentId===(extra.parentId||''));
  return {...stamp,id:crypto.randomUUID(),kind,name:blankText(),status:'derived',order:siblings.reduce((n,i)=>Math.max(n,i.order+1),0),...extra};
};
export const productError=(item:ProductItem)=>!item.name.en.trim()?'ptNameRequired':item.kind==='module'&&!item.group?'ptGroupRequired':item.kind==='sub'&&!item.parentId?'notFound':'';
const byOrder=(a:ProductItem,b:ProductItem)=>a.order-b.order||a.id.localeCompare(b.id);
/** Read model for the UI. Links to deleted actors and subs of deleted modules simply drop out. */
export function buildTree(items:ProductItem[]=[]){
  const actorList=items.filter(i=>i.kind==='actor').sort(byOrder),actorIds=new Set(actorList.map(a=>a.id));
  const moduleList=items.filter(i=>i.kind==='module').sort((a,b)=>groupKeys.indexOf(a.group as never)-groupKeys.indexOf(b.group as never)||byOrder(a,b));
  const subs=new Map<string,ProductItem[]>();
  for(const s of items.filter(i=>i.kind==='sub').sort(byOrder))subs.set(s.parentId,[...(subs.get(s.parentId)||[]),s]);
  return {
    actors:actorList,modules:moduleList,
    subsOf:(moduleId:string)=>subs.get(moduleId)||[],
    usersOf:(m:ProductItem)=>actorList.filter(a=>m.actors.includes(a.id)),
    modulesOf:(a:ProductItem)=>moduleList.filter(m=>m.actors.includes(a.id)&&actorIds.has(a.id)),
    /** Modules listing a submodule with the same English name (e.g. "Role / permission" in Auth and Admin). */
    modulesWithSub:(en:string)=>moduleList.filter(m=>(subs.get(m.id)||[]).some(s=>s.name.en===en)).map(m=>m.id),
  };
}
export type ProductTree=ReturnType<typeof buildTree>;
