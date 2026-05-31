import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AccountForm } from "./AccountForm";

export default async function AccountPage() {
  const session = await getSession();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-daw-bg p-8">
      <div className="max-w-lg mx-auto">
        <h1 className="text-2xl font-bold text-white mb-8">Account</h1>
        <AccountForm user={session.user} />
      </div>
    </div>
  );
}
