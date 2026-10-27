const WEB_POINTS = [
    "Watch sessions as they work",
    "Send instructions or questions",
    "Approve with a tap",
] as const;

const PC_POINTS = [
    "It lands as a real session, ready to continue",
    "Full context travels, nothing to re-explain",
    "Push back when you return",
] as const;

export default function FeaturesSection() {
    return (
        <section className="border-t border-line">
            <div className="mx-auto w-full max-w-6xl px-4 py-16">
                <h2 className="text-2xl font-bold tracking-tight">Wherever you are</h2>
                <div className="mt-8 grid gap-10 md:grid-cols-2 md:gap-0 md:divide-x md:divide-line">
                    <div className="md:pr-12">
                        <h3 className="text-lg font-bold">Walk away</h3>
                        <p className="mt-1 text-sm text-dim">
                            PC stays on. Your phone is the remote.
                        </p>
                        <ul className="mt-4 space-y-2">
                            {WEB_POINTS.map((point) => (
                                <li key={point} className="flex gap-2 text-sm text-fog">
                                    <span className="font-mono text-go">&gt;</span>
                                    {point}
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div className="md:pl-12">
                        <h3 className="text-lg font-bold">Take it with you</h3>
                        <p className="mt-1 text-sm text-dim">
                            Laptop day? Pull the tab over.
                        </p>
                        <ul className="mt-4 space-y-2">
                            {PC_POINTS.map((point) => (
                                <li key={point} className="flex gap-2 text-sm text-fog">
                                    <span className="font-mono text-go">&gt;</span>
                                    {point}
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </div>
        </section>
    );
}
