import {auth} from './firebase';
import {questionnaireRequest} from './client-questionnaire-http';
import type {Publication,PublishOptions,Submission} from '../../functions/src/questionnaire-model';
export type PublicationSummary=Publication&{questionCount:number};
export interface RespondentSummary{id:string;name:string;email:string;state:'draft'|'submitted';savedAt:string;submittedAt:string|null;counts:{completed:number;answered:number;followUp:number};}
export interface QuestionnaireDetail {publication:Publication;respondents:RespondentSummary[];}
export interface SubmissionDetail {submission:Submission;sourceState:Record<string,'deleted'|'changed'|'current'>;}
export async function clientManagement<T>(path:string,body?:unknown):Promise<T>{
  const user=auth?.currentUser;if(!user)throw Error('AUTH_REQUIRED');
  return questionnaireRequest<T>('mine'+path,body,await user.getIdToken());
}
export const publishClientQuestions=(options:PublishOptions,requestId:string,expectedSourceHash:string,code:string)=>clientManagement<Publication>('',{options,requestId,expectedSourceHash,code,acknowledge:true});
export function clientInvitation(p:Publication):string{
  const q=p.snapshot,language=q.language,deadline=p.dueDate||p.expiresAt.slice(0,10);
  const text={
    en:`Hello,\n\nPlease help us clarify the WeRide discovery questions using the link below. You can save your draft, indicate items needing clarification, and submit a partial response.\n\n${q.title}\n${p.url}\n\nRequested response date: ${deadline}.\n${p.protected?'The access code will be provided separately.\n':''}No Madison account is needed. Please do not forward the link outside the intended project team.\n\nThank you,\nMadison project team`,
    vi:`Chào anh/chị,\n\nNhờ anh/chị trả lời các câu hỏi làm rõ dự án WeRide tại link bên dưới. Có thể lưu nháp, đánh dấu câu cần làm rõ và gửi phản hồi một phần.\n\n${q.title}\n${p.url}\n\nNgày mong muốn nhận phản hồi: ${deadline}.\n${p.protected?'Mã truy cập sẽ được gửi riêng.\n':''}Không cần tài khoản Madison. Vui lòng không chuyển tiếp link ngoài nhóm dự án được chỉ định.\n\nCảm ơn anh/chị,\nNhóm dự án Madison`,
    sv:`Hej,\n\nHjälp oss att förtydliga frågorna för WeRide via länken nedan. Du kan spara ett utkast, markera frågor som behöver förtydligas och skicka ett delvis ifyllt svar.\n\n${q.title}\n${p.url}\n\nÖnskat svarsdatum: ${deadline}.\n${p.protected?'Åtkomstkoden skickas separat.\n':''}Inget Madison-konto behövs. Vidarebefordra inte länken utanför den avsedda projektgruppen.\n\nTack,\nMadisons projektteam`,
  };return text[language];
}
