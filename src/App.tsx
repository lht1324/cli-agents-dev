import { Route, Routes } from "react-router";
import Header from "./components/Header";
import SessionsPage from "./pages/SessionsPage";
import SessionDetailPage from "./pages/SessionDetailPage";
import DeviceAuthorizePage from "./pages/DeviceAuthorizePage";
import DevicesPage from "./pages/DevicesPage";
import ProfilePage from "./pages/ProfilePage";
import BillingLockedPage from "./pages/BillingLockedPage";
import LandingPage from "./pages/LandingPage";
import SignInPage from "./pages/SignInPage";
import LegalPage from "./pages/LegalPage";

function Shell({ children }: { children: React.ReactNode }) {
    return (
        <>
            <Header />
            {children}
        </>
    );
}


function Stub({ title, body }: { title: string; body: string }) {
    return (
        <main className="mx-auto max-w-5xl px-6 py-10">
            <h1 className="font-mono text-xl font-bold">{title}</h1>
            <p className="mt-4 text-sm text-dim">{body}</p>
        </main>
    );
}


export default function App() {
    return (
        <Routes>
            <Route path="/" element={<Shell><LandingPage /></Shell>} />
            <Route path="/auth/sign-in" element={<SignInPage />} />
            <Route
                path="/sessions"
                element={
                    <Shell>
                        <SessionsPage />
                    </Shell>
                }
            />
            <Route
                path="/sessions/:id"
                element={
                    <Shell>
                        <SessionDetailPage />
                    </Shell>
                }
            />
            <Route
                path="/sessions/:id/:childId"
                element={
                    <Shell>
                        <SessionDetailPage />
                    </Shell>
                }
            />
            <Route
                path="/device/authorize"
                element={
                    <Shell>
                        <DeviceAuthorizePage />
                    </Shell>
                }
            />
            <Route
                path="/devices"
                element={
                    <Shell>
                        <DevicesPage />
                    </Shell>
                }
            />
            <Route
                path="/profile"
                element={
                    <Shell>
                        <ProfilePage />
                    </Shell>
                }
            />
            <Route
                path="/legal/terms"
                element={
                    <Shell>
                        <LegalPage kind="terms" />
                    </Shell>
                }
            />
            <Route
                path="/legal/privacy"
                element={
                    <Shell>
                        <LegalPage kind="privacy" />
                    </Shell>
                }
            />
            <Route
                path="/legal/refunds"
                element={
                    <Shell>
                        <LegalPage kind="refunds" />
                    </Shell>
                }
            />
            <Route
                path="/billing/locked"
                element={
                    <Shell>
                        <BillingLockedPage />
                    </Shell>
                }
            />
            <Route
                path="*"
                element={
                    <Shell>
                        <Stub title="Not found" body="This page does not exist." />
                    </Shell>
                }
            />
        </Routes>
    );
}
