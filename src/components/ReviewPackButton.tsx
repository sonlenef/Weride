import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Sparkles } from 'lucide-react';
export default function ReviewPackButton({requirementId,module}:{requirementId?:string;module?:string}){
  const {t}=useTranslation();
  const query=requirementId?`?requirement=${encodeURIComponent(requirementId)}`:module&&['A','B','C'].includes(module)?`?module=${module}`:'';
  return <Link className="button secondary ai-review-button" to={`/review-packs${query}`}><Sparkles size={16}/>{t('aiReview')}</Link>;
}
