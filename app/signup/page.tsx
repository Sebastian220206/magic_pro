import { googleAuthEnabled } from "@/lib/auth";
import SignupForm from "./SignupForm";

/** Server component wrapper — see `app/login/page.tsx` for why. */
export default function SignupPage() {
    return <SignupForm googleEnabled={googleAuthEnabled} />;
}
