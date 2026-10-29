const PC_POINTS = [
    "Full context travels, nothing to re-explain",
    "Lands as a real session, ready to continue",
    "Push back when you return",
] as const;

const WEB_POINTS = [
    "Watch sessions as they work",
    "Send instructions or questions",
    "Approve with a tap",
] as const;

export default function FeaturesSection() {
    return (
        <section className="border-t border-line">
            <div className="mx-auto w-full max-w-6xl px-4 py-16">
                <h2 className="text-2xl font-bold tracking-tight">One session, every machine</h2>
                <div className="mt-8 grid gap-10 md:grid-cols-2 md:gap-0 md:divide-x md:divide-line">
                    <div className="md:pr-12">
                        <h3 className="text-lg font-bold">Move between PCs</h3>
                        <p className="mt-1 text-sm text-dim">
                            Laptop day? Take the tab with you.
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
                    <div className="md:pl-12">
                        <h3 className="text-lg font-bold">Check in from your phone</h3>
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
                </div>
            </div>
        </section>
    );
}
