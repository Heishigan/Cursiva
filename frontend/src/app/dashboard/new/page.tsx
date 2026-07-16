import { redirect } from 'next/navigation';

export default function OldPipelineRedirect() {
  redirect('/dashboard/pipeline');
}
