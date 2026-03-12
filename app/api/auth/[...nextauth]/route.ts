import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

const handler = NextAuth({
    providers: [
        CredentialsProvider({
            name: "Demo Account",
            credentials: {
                email: { label: "Email", type: "text", placeholder: "demo@example.com" },
                password: { label: "Password", type: "password" }
            },
            async authorize() {
                // Any login works for demo purposes
                return { id: "1", name: "Demo User", email: "demo@example.com" };
            }
        })
    ],
    pages: {
        signIn: "/login",
    },
    session: {
        strategy: "jwt"
    }
});

export { handler as GET, handler as POST };
