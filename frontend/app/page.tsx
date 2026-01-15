import { redirect } from 'next/navigation';

export default function Home() {
  // メインページ（automation）にリダイレクト
  redirect('/automation');
}
